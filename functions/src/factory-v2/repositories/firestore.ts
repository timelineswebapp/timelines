import type { CollectionReference, DocumentData, DocumentReference, Firestore } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID } from "../../config";
import { db } from "../../firestore";
import { V2_CORPUS_COLLECTIONS, v2CorpusCollection, type V2CorpusCollectionName } from "../../corpus";
import { verifyPayloadHash } from "../hashing";

export type V2RepositoryDependencies = {
  firestore?: Firestore;
  corpusId?: string;
};

const allowed = new Set<string>(V2_CORPUS_COLLECTIONS);

export class V2FirestoreRepository {
  private readonly firestore: Firestore;
  private readonly corpusId: string;

  constructor(dependencies: V2RepositoryDependencies = {}) {
    this.firestore = dependencies.firestore || db;
    this.corpusId = dependencies.corpusId || ACTIVE_CORPUS_ID;
  }

  activeCorpusId(): string {
    return this.corpusId;
  }

  collection(name: V2CorpusCollectionName): CollectionReference {
    if (!allowed.has(name)) throw new Error(`Collection ${name} is not in the V2 Production Memory allowlist.`);
    if (this.firestore === db && this.corpusId === ACTIVE_CORPUS_ID) return v2CorpusCollection(name);
    return this.firestore.collection("corpora").doc(this.corpusId).collection(name);
  }

  async createImmutable(name: V2CorpusCollectionName, artifact: Record<string, unknown>): Promise<"CREATED" | "IDEMPOTENT"> {
    if (artifact.corpusId !== this.corpusId) throw new Error("Cross-corpus V2 artifact write rejected.");
    if (artifact.executionMode !== "SHADOW" || artifact.publicationEligible !== false || artifact.governanceSubmissionAllowed !== false || artifact.immutable !== true) {
      throw new Error("V2-A immutable artifacts must be non-publishable SHADOW Production Memory.");
    }
    if (!verifyPayloadHash(artifact)) throw new Error("V2 artifact payload hash is invalid.");
    const artifactId = String(artifact.artifactId || "");
    if (!artifactId) throw new Error("Immutable artifacts require artifactId.");
    const reference = this.collection(name).doc(artifactId);
    return this.firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (current.exists) {
        if (current.data()?.payloadHash !== artifact.payloadHash) throw new Error("Immutable artifact ID collision with a different payload.");
        return "IDEMPOTENT" as const;
      }
      transaction.create(reference, artifact);
      return "CREATED" as const;
    });
  }

  async createImmutableBatch(name: V2CorpusCollectionName, artifacts: Record<string, unknown>[]): Promise<{ created: number; idempotent: number }> {
    if (artifacts.length < 1 || artifacts.length > 200) throw new Error("Immutable V2 batches require 1-200 artifacts.");
    const ids = new Set<string>();
    for (const artifact of artifacts) {
      if (artifact.corpusId !== this.corpusId) throw new Error("Cross-corpus V2 artifact write rejected.");
      if (artifact.executionMode !== "SHADOW" || artifact.publicationEligible !== false || artifact.governanceSubmissionAllowed !== false || artifact.immutable !== true) {
        throw new Error("V2-A immutable artifacts must be non-publishable SHADOW Production Memory.");
      }
      if (!verifyPayloadHash(artifact)) throw new Error("V2 artifact payload hash is invalid.");
      const artifactId = String(artifact.artifactId || "");
      if (!artifactId || ids.has(artifactId)) throw new Error("Immutable V2 batches require unique artifact IDs.");
      ids.add(artifactId);
    }
    const references = artifacts.map((artifact) => this.collection(name).doc(String(artifact.artifactId)));
    return this.firestore.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(...references);
      let created = 0;
      let idempotent = 0;
      for (let index = 0; index < artifacts.length; index += 1) {
        const artifact = artifacts[index]!;
        const snapshot = snapshots[index]!;
        if (snapshot.exists) {
          if (snapshot.data()?.payloadHash !== artifact.payloadHash) throw new Error("Immutable artifact ID collision with a different payload.");
          idempotent += 1;
        } else {
          transaction.create(references[index]!, artifact);
          created += 1;
        }
      }
      return { created, idempotent };
    });
  }

  async advanceHead(input: {
    collection: Extract<V2CorpusCollectionName, "v2PublisherAuthorityRecords" | "v2SourceDocuments" | "v2AtomicClaims" | "v2CanonicalEntities" | "v2CanonicalEvents" | "v2TopicOperations">;
    headId: string;
    expectedCurrentVersionId: string | null;
    nextVersionId: string;
    data: Record<string, unknown>;
  }): Promise<"CREATED" | "ADVANCED" | "IDEMPOTENT"> {
    const reference = this.collection(input.collection).doc(input.headId);
    return this.firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (!current.exists) {
        if (input.expectedCurrentVersionId !== null) throw new Error("Head is absent but an existing version was expected.");
        transaction.create(reference, { ...input.data, corpusId: this.corpusId, currentVersionId: input.nextVersionId });
        return "CREATED" as const;
      }
      const currentVersionId = current.data()?.currentVersionId;
      if (currentVersionId === input.nextVersionId) return "IDEMPOTENT" as const;
      if (currentVersionId !== input.expectedCurrentVersionId) throw new Error("V2 head compare-and-set failed; a concurrent version won.");
      transaction.update(reference, { ...input.data, corpusId: this.corpusId, currentVersionId: input.nextVersionId });
      return "ADVANCED" as const;
    });
  }

  async upsertSourceDocument(source: Record<string, unknown>): Promise<"CREATED" | "ADVANCED" | "IDEMPOTENT"> {
    if (source.corpusId !== this.corpusId) throw new Error("Cross-corpus source write rejected.");
    const sourceId = String(source.sourceId || "");
    const nextSnapshotId = source.currentSnapshotId;
    if (!sourceId) throw new Error("Source document requires sourceId.");
    const reference = this.collection("v2SourceDocuments").doc(sourceId);
    return this.firestore.runTransaction(async (transaction) => {
      const current = await transaction.get(reference);
      if (!current.exists) {
        transaction.create(reference, source);
        return "CREATED" as const;
      }
      if (current.data()?.identityHash !== source.identityHash || current.data()?.canonicalUrl !== source.canonicalUrl) throw new Error("Source identity collision.");
      if (current.data()?.currentSnapshotId === nextSnapshotId) return "IDEMPOTENT" as const;
      transaction.set(reference, source);
      return "ADVANCED" as const;
    });
  }

  async setOperation(operationId: string, operation: Record<string, unknown>): Promise<void> {
    if (operation.corpusId !== this.corpusId || operation.executionMode !== "SHADOW") throw new Error("Invalid V2 shadow operation projection.");
    await this.collection("v2TopicOperations").doc(operationId).set(operation);
  }

  async createEdgeWithReferences(input: {
    collection: Extract<V2CorpusCollectionName, "v2ClaimEvidence" | "v2EventClaims" | "v2EventEntities" | "v2EventRelations" | "v2EntityAliases">;
    edge: Record<string, unknown>;
    references: Array<{ collection: V2CorpusCollectionName; id: string }>;
  }): Promise<"CREATED" | "IDEMPOTENT"> {
    const edgeId = String(input.edge.artifactId || "");
    if (!edgeId) throw new Error("Edge artifactId is required.");
    if (!verifyPayloadHash(input.edge)) throw new Error("Edge payload hash is invalid.");
    const reference = this.collection(input.collection).doc(edgeId);
    const requiredReferences = input.references.map((item) => this.collection(item.collection).doc(item.id));
    return this.firestore.runTransaction(async (transaction) => {
      const snapshots = await transaction.getAll(reference, ...requiredReferences);
      const current = snapshots[0]!;
      if (current.exists) {
        if (current.data()?.payloadHash !== input.edge.payloadHash) throw new Error("Immutable edge collision.");
        return "IDEMPOTENT" as const;
      }
      const missing = snapshots.slice(1).flatMap((snapshot, index) => snapshot.exists ? [] : [`${input.references[index]!.collection}/${input.references[index]!.id}`]);
      if (missing.length > 0) throw new Error(`Edge referential integrity failed: ${missing.join(", ")}`);
      transaction.create(reference, input.edge);
      return "CREATED" as const;
    });
  }

  async boundedQuery(name: V2CorpusCollectionName, filters: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }>, limit: number): Promise<DocumentData[]> {
    const boundedLimit = Math.trunc(limit);
    if (boundedLimit < 1 || boundedLimit > 200) throw new Error("V2 repository queries require an explicit limit from 1 through 200.");
    let query: FirebaseFirestore.Query = this.collection(name);
    for (const filter of filters) query = query.where(filter.field, filter.op, filter.value);
    const result = await query.limit(boundedLimit).get();
    return result.docs.map((document) => ({ id: document.id, ...document.data() }));
  }

  async getById(name: V2CorpusCollectionName, id: string): Promise<DocumentData | null> {
    if (!id || id.length > 160) throw new Error("V2 repository document IDs must be explicitly bounded.");
    const snapshot = await this.collection(name).doc(id).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  reference(name: V2CorpusCollectionName, id: string): DocumentReference {
    return this.collection(name).doc(id);
  }
}
