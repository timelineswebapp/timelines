import type { CollectionReference, DocumentData, DocumentReference, Firestore } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID } from "../../config";
import { db } from "../../firestore";
import { V2_CORPUS_COLLECTIONS, v2CorpusCollection, type V2CorpusCollectionName } from "../../corpus";
import { contentAddressedId, payloadHash, verifyPayloadHash } from "../hashing";
import { parseSealedArtifact } from "../contracts/builders";
import { deferredReentryDispatchReceiptSchema, deferredReentryRequestSchema } from "../contracts/reentry";
import { topicOperationSchema } from "../contracts/operations";
import { sourceSubmissionCandidateSchema } from "../contracts/source-submission";
import { sourceSubmissionValidationSchema } from "../contracts/source-submission-validation";
import { sourceSubmissionRetrievalSchema } from "../contracts/source-submission-retrieval";
import { topicAuthoritySetSchema } from "../contracts/authority-first";
import { evidenceSegmentSchema, publisherAuthorityVersionSchema, sourceDocumentSchema, sourceSnapshotSchema } from "../contracts/knowledge";
import { sourceSubmissionUrlMatchesAuthority } from "../source-submission-eligibility";
import { planDeferredReentryDispatch } from "../reentry-dispatch";
import { deriveDeferredReentryRequest } from "../reentry-request";
import { deriveSourceSubmissionCandidate } from "../source-submission";
import { buildSourceSubmissionAuthorityValidation } from "../source-submission-validation";
import type { SourceSubmissionRetrievalArtifacts } from "../source-submission-retrieval";

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

  async createDeferredReentryRequest(input: {
    operationId: string;
    trigger: "RELEVANT_EVIDENCE_CHANGE" | "AUTHORIZED_RETRY";
    relevantChangeArtifactId?: string | null;
    authorizedBy?: string | null;
    authorizationReason?: string | null;
    now?: string;
  }): Promise<{ state: "CREATED" | "IDEMPOTENT"; requestId: string }> {
    if (!input.operationId || input.operationId.length > 160) throw new Error("Deferred re-entry operation ID must be explicitly bounded.");
    const operationRef = this.collection("v2TopicOperations").doc(input.operationId);
    const now = input.now || new Date().toISOString();
    return this.firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(operationRef);
      if (!operationSnapshot.exists) throw new Error("Deferred re-entry operation does not exist.");
      const operation = operationSnapshot.data()!;
      if (operation.operationId !== input.operationId) throw new Error("Deferred operation document identity does not match its payload.");
      const failureRecordId = operation.terminalFailureRecordId;
      if (typeof failureRecordId !== "string") throw new Error("Deferred operation has no terminal failure lineage.");
      const failureRef = this.collection("v2FailureRecords").doc(failureRecordId);
      const sourceSnapshotRef = input.trigger === "RELEVANT_EVIDENCE_CHANGE" && input.relevantChangeArtifactId
        ? this.collection("v2SourceSnapshots").doc(input.relevantChangeArtifactId)
        : null;
      const initialSnapshots = await transaction.getAll(failureRef, ...(sourceSnapshotRef ? [sourceSnapshotRef] : []));
      const failureSnapshot = initialSnapshots[0]!;
      if (!failureSnapshot.exists) throw new Error("Deferred re-entry failure lineage does not exist.");
      const sourceSnapshot = sourceSnapshotRef ? initialSnapshots[1] : null;
      if (sourceSnapshotRef && !sourceSnapshot?.exists) throw new Error("Relevant source-change artifact does not exist.");
      const sourceDocumentRef = sourceSnapshot ? this.collection("v2SourceDocuments").doc(String(sourceSnapshot.data()?.sourceId || "")) : null;
      const sourceDocumentSnapshot = sourceDocumentRef ? await transaction.get(sourceDocumentRef) : null;
      if (sourceDocumentRef && !sourceDocumentSnapshot?.exists) throw new Error("Relevant source-change document does not exist.");
      const request = deriveDeferredReentryRequest({
        operation,
        failure: failureSnapshot.data(),
        trigger: input.trigger,
        relevantChangeArtifactId: input.relevantChangeArtifactId,
        authorizedBy: input.authorizedBy,
        authorizationReason: input.authorizationReason,
        relevantSourceDocument: sourceDocumentSnapshot?.data(),
        relevantSourceSnapshot: sourceSnapshot?.data(),
        now
      });
      const requestRef = this.collection("v2DeferredReentryRequests").doc(request.deferredReentryRequestId);
      const existing = await transaction.get(requestRef);
      if (existing.exists) {
        const persisted = deferredReentryRequestSchema.parse(existing.data());
        if (persisted.payloadHash !== request.payloadHash) {
          // createdAt is deliberately excluded from the request identity; all
          // semantic lineage must nevertheless remain exactly identical.
          const { createdAt: _persistedCreatedAt, payloadHash: _persistedHash, ...persistedMeaning } = persisted;
          const { createdAt: _requestCreatedAt, payloadHash: _requestHash, ...requestMeaning } = request;
          if (payloadHash(persistedMeaning) !== payloadHash(requestMeaning)) throw new Error("Deferred re-entry request identity collision.");
        }
        return { state: "IDEMPOTENT" as const, requestId: request.deferredReentryRequestId };
      }
      transaction.create(requestRef, request);
      return { state: "CREATED" as const, requestId: request.deferredReentryRequestId };
    });
  }

  async createSourceSubmissionCandidate(input: { operationId: string; submittedUrl: string; rationale: string; submittedBy: string; now?: string }): Promise<{ state: "CREATED" | "IDEMPOTENT"; candidateId: string }> {
    if (!input.operationId || input.operationId.length > 160) throw new Error("Source-submission operation ID must be explicitly bounded.");
    return this.firestore.runTransaction(async (transaction) => {
      const operationSnapshot = await transaction.get(this.collection("v2TopicOperations").doc(input.operationId));
      if (!operationSnapshot.exists || operationSnapshot.data()?.operationId !== input.operationId) throw new Error("Source-submission operation does not exist or has invalid identity.");
      const failureRecordId = operationSnapshot.data()?.terminalFailureRecordId;
      if (typeof failureRecordId !== "string") throw new Error("Source-submission operation has no terminal failure lineage.");
      const failureSnapshot = await transaction.get(this.collection("v2FailureRecords").doc(failureRecordId));
      if (!failureSnapshot.exists) throw new Error("Source-submission failure lineage does not exist.");
      const candidate = deriveSourceSubmissionCandidate({ operation: operationSnapshot.data(), failure: failureSnapshot.data(), submittedUrl: input.submittedUrl, rationale: input.rationale, submittedBy: input.submittedBy, now: input.now || new Date().toISOString() });
      const ref = this.collection("v2SourceSubmissionCandidates").doc(candidate.sourceSubmissionCandidateId);
      const existing = await transaction.get(ref);
      if (existing.exists) {
        const current = sourceSubmissionCandidateSchema.parse(existing.data());
        if (current.payloadHash !== candidate.payloadHash) throw new Error("Source-submission candidate identity collision.");
        return { state: "IDEMPOTENT" as const, candidateId: candidate.sourceSubmissionCandidateId };
      }
      transaction.create(ref, candidate);
      return { state: "CREATED" as const, candidateId: candidate.sourceSubmissionCandidateId };
    });
  }

  /** Resolves only the registered authority eligible to assess a candidate; it performs no retrieval or admission. */
  async resolveSourceSubmissionAuthority(candidateId: string): Promise<{ candidateId: string; operationId: string; publisherVersionId: string }> {
    if (!candidateId || candidateId.length > 160) throw new Error("Source-submission candidate ID must be explicitly bounded.");
    const candidateSnapshot = await this.collection("v2SourceSubmissionCandidates").doc(candidateId).get();
    if (!candidateSnapshot.exists) throw new Error("Source-submission candidate does not exist.");
    const candidate = sourceSubmissionCandidateSchema.parse(candidateSnapshot.data());
    const operationSnapshot = await this.collection("v2TopicOperations").doc(candidate.originalOperationId).get();
    if (!operationSnapshot.exists) throw new Error("Source-submission operation does not exist.");
    const operation = topicOperationSchema.parse(operationSnapshot.data());
    if (operation.state !== "DEFERRED" || operation.operationId !== candidate.originalOperationId || operation.terminalFailureRecordId !== candidate.originalFailureRecordId || operation.topicAuthoritySetId === null) throw new Error("Source-submission operation has no eligible deferred authority lineage.");
    const setSnapshot = await this.collection("v2TopicAuthoritySets").doc(operation.topicAuthoritySetId).get();
    if (!setSnapshot.exists) throw new Error("Source-submission Topic Authority Set does not exist.");
    const authoritySet = topicAuthoritySetSchema.parse(setSnapshot.data());
    if (authoritySet.topicId !== operation.topicId || authoritySet.validationStatus !== "VALIDATED") throw new Error("Source-submission Topic Authority Set is invalid for the deferred topic.");
    const publisherRefs = authoritySet.bindings.map((binding) => this.collection("v2PublisherAuthorityVersions").doc(binding.publisherVersionId));
    const publishers = await this.firestore.getAll(...publisherRefs);
    for (const publisherSnapshot of publishers) {
      if (!publisherSnapshot.exists) continue;
      const publisher = publisherAuthorityVersionSchema.parse(publisherSnapshot.data());
      if (sourceSubmissionUrlMatchesAuthority({ submittedUrl: candidate.submittedUrl, boundPublisherVersionIds: authoritySet.bindings.map((binding) => binding.publisherVersionId), publisherVersionId: publisher.publisherVersionId, knownDomains: publisher.knownDomains })) {
        return { candidateId, operationId: operation.operationId, publisherVersionId: publisher.publisherVersionId };
      }
    }
    throw new Error("Source-submission URL is not bound to the deferred Topic Authority Set.");
  }

  /** Creates the sealed authority gate before any worker is permitted to fetch a submitted URL. */
  async prepareSourceSubmissionRetrieval(candidateId: string, now = new Date().toISOString()): Promise<{ candidate: DocumentData; validation: DocumentData; publisher: ReturnType<typeof publisherAuthorityVersionSchema.parse> }> {
    const authority = await this.resolveSourceSubmissionAuthority(candidateId);
    const [candidate, operation, publisher] = await Promise.all([
      this.getById("v2SourceSubmissionCandidates", candidateId),
      this.getById("v2TopicOperations", authority.operationId),
      this.getById("v2PublisherAuthorityVersions", authority.publisherVersionId)
    ]);
    if (!candidate || !operation || !publisher) throw new Error("Source-submission retrieval authority lineage disappeared.");
    const { id: _candidateDocumentId, ...candidateArtifact } = candidate;
    const { id: _operationDocumentId, ...operationProjection } = operation;
    const validation = buildSourceSubmissionAuthorityValidation({ candidate: candidateArtifact, operation: operationProjection, publisherVersionId: authority.publisherVersionId, now });
    await this.createImmutable("v2SourceSubmissionValidations", validation);
    const { id: _publisherDocumentId, ...publisherArtifact } = publisher;
    return { candidate: sourceSubmissionCandidateSchema.parse(candidateArtifact), validation: sourceSubmissionValidationSchema.parse(validation), publisher: publisherAuthorityVersionSchema.parse(publisherArtifact) };
  }

  /** Persists an acquisition observation only; it never creates evidence, claims, or a re-entry request. */
  async persistSourceSubmissionRetrieval(input: { result: Record<string, unknown> } & SourceSubmissionRetrievalArtifacts): Promise<void> {
    const result = sourceSubmissionRetrievalSchema.parse(input.result);
    if (!verifyPayloadHash(result)) throw new Error("Source-submission retrieval observation hash is invalid.");
    if (input.source || input.snapshot || input.evidenceSegments) {
      if (!input.source || !input.snapshot || !input.evidenceSegments) throw new Error("Source-submission retrieval persistence requires complete acquisition artifacts.");
      const source = sourceDocumentSchema.parse(input.source);
      const snapshot = sourceSnapshotSchema.parse(input.snapshot);
      const evidenceSegments = input.evidenceSegments.map((segment) => evidenceSegmentSchema.parse(segment));
      if (evidenceSegments.length > 200) throw new Error("Source-submission retrieval persistence permits at most 200 evidence segments.");
      if (!verifyPayloadHash(snapshot) || evidenceSegments.some((segment) => !verifyPayloadHash(segment))) throw new Error("Source-submission retrieval acquisition artifact hash is invalid.");
      if (snapshot.sourceId !== source.sourceId || evidenceSegments.some((segment) => segment.sourceSnapshotId !== snapshot.sourceSnapshotId)) throw new Error("Source-submission retrieval acquisition artifact lineage is invalid.");
      if (result.sourceId !== source.sourceId || result.sourceSnapshotId !== snapshot.sourceSnapshotId) throw new Error("Source-submission retrieval result lineage does not match acquisition artifacts.");
      if (source.corpusId !== this.corpusId || snapshot.corpusId !== this.corpusId || evidenceSegments.some((segment) => segment.corpusId !== this.corpusId) || result.corpusId !== this.corpusId) throw new Error("Cross-corpus source-submission retrieval persistence rejected.");
      const sourceRef = this.collection("v2SourceDocuments").doc(source.sourceId);
      const snapshotRef = this.collection("v2SourceSnapshots").doc(snapshot.sourceSnapshotId);
      const segmentRefs = evidenceSegments.map((segment) => this.collection("v2EvidenceSegments").doc(segment.evidenceSegmentId));
      const retrievalRef = this.collection("v2SourceSubmissionRetrievals").doc(result.sourceSubmissionRetrievalId);
      await this.firestore.runTransaction(async (transaction) => {
        const records = await transaction.getAll(sourceRef, snapshotRef, ...segmentRefs, retrievalRef);
        const existingSource = records[0]!;
        const immutable = [{ reference: snapshotRef, artifact: snapshot, snapshot: records[1]! }, ...evidenceSegments.map((segment, index) => ({ reference: segmentRefs[index]!, artifact: segment, snapshot: records[index + 2]! })), { reference: retrievalRef, artifact: result, snapshot: records[records.length - 1]! }];
        if (existingSource.exists) {
          const current = existingSource.data()!;
          if (current.identityHash !== source.identityHash || current.canonicalUrl !== source.canonicalUrl) throw new Error("Source identity collision.");
          if (current.currentSnapshotId !== source.currentSnapshotId) transaction.set(sourceRef, source);
        } else transaction.create(sourceRef, source);
        for (const item of immutable) {
          if (item.snapshot.exists) {
            if (item.snapshot.data()?.payloadHash !== item.artifact.payloadHash) throw new Error("Immutable artifact ID collision with a different payload.");
          } else transaction.create(item.reference, item.artifact);
        }
      });
      return;
    } else if (result.sourceId !== null || result.sourceSnapshotId !== null) {
      throw new Error("Source-submission retrieval result requires its referenced acquisition artifacts.");
    }
    await this.createImmutable("v2SourceSubmissionRetrievals", result);
  }

  async consumeDeferredReentryRequest(requestId: string, now = new Date().toISOString()): Promise<"CONSUMED" | "IDEMPOTENT"> {
    if (!requestId || requestId.length > 160) throw new Error("Deferred re-entry request ID must be explicitly bounded.");
    const requestRef = this.collection("v2DeferredReentryRequests").doc(requestId);
    const receiptRef = this.collection("v2DeferredReentryDispatchReceipts").doc(requestId);
    return this.firestore.runTransaction(async (transaction) => {
      const requestSnapshot = await transaction.get(requestRef);
      if (!requestSnapshot.exists) throw new Error("Deferred re-entry request does not exist.");
      const request = deferredReentryRequestSchema.parse(requestSnapshot.data());
      const [receiptSnapshot, operationSnapshot, failureSnapshot, nextOperationSnapshot] = await transaction.getAll(
        receiptRef,
        this.collection("v2TopicOperations").doc(request.originalOperationId),
        this.collection("v2FailureRecords").doc(request.originalFailureRecordId),
        this.collection("v2TopicOperations").doc(request.nextRunId)
      );
      if (receiptSnapshot!.exists) {
        const receipt = deferredReentryDispatchReceiptSchema.parse(receiptSnapshot!.data());
        if (receipt.deferredReentryRequestId !== requestId || receipt.queuedOperationId !== request.nextRunId) throw new Error("Deferred re-entry receipt collision.");
        return "IDEMPOTENT" as const;
      }
      if (!operationSnapshot!.exists || !failureSnapshot!.exists) throw new Error("Deferred re-entry lineage is incomplete.");
      if (nextOperationSnapshot!.exists) throw new Error("Deferred re-entry next-run identity is already occupied.");
      const queued = planDeferredReentryDispatch({ request, operation: operationSnapshot!.data(), failure: failureSnapshot!.data(), now });
      const receipt = parseSealedArtifact(deferredReentryDispatchReceiptSchema, {
        artifactId: requestId, schemaVersion: request.schemaVersion, policyVersion: request.policyVersion, promptVersion: request.promptVersion, modelExecutionRef: null, parentArtifactId: requestId,
        createdAt: now, corpusId: request.corpusId, topicId: request.topicId, runId: request.nextRunId, generation: request.nextGeneration, executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true,
        deferredReentryDispatchReceiptId: requestId, deferredReentryRequestId: requestId, queuedOperationId: request.nextRunId, consumedAt: now, state: "CONSUMED"
      });
      transaction.create(receiptRef, receipt);
      transaction.create(this.collection("v2TopicOperations").doc(request.nextRunId), queued);
      return "CONSUMED" as const;
    });
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

  async boundedQuery(name: V2CorpusCollectionName, filters: Array<{ field: string; op: FirebaseFirestore.WhereFilterOp; value: unknown }>, limit: number, order?: { field: "createdAt" | "updatedAt"; direction: "asc" | "desc" }): Promise<DocumentData[]> {
    const boundedLimit = Math.trunc(limit);
    if (boundedLimit < 1 || boundedLimit > 200) throw new Error("V2 repository queries require an explicit limit from 1 through 200.");
    let query: FirebaseFirestore.Query = this.collection(name);
    for (const filter of filters) query = query.where(filter.field, filter.op, filter.value);
    if (order) query = query.orderBy(order.field, order.direction);
    const result = await query.limit(boundedLimit).get();
    return result.docs.map((document) => ({ id: document.id, ...document.data() }));
  }

  async getById(name: V2CorpusCollectionName, id: string): Promise<DocumentData | null> {
    if (!id || id.length > 160) throw new Error("V2 repository document IDs must be explicitly bounded.");
    const snapshot = await this.collection(name).doc(id).get();
    return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
  }

  async getReusableSource(canonicalUrl: string): Promise<{ source: DocumentData; snapshot: DocumentData; evidenceSegments: DocumentData[] } | null> {
    const sourceId = contentAddressedId("source", canonicalUrl);
    const sourceRecord = await this.getById("v2SourceDocuments", sourceId);
    if (!sourceRecord || typeof sourceRecord.currentSnapshotId !== "string") return null;
    const { id: sourceDocumentId, ...sourcePayload } = sourceRecord;
    const source = sourceDocumentSchema.parse(sourcePayload);
    if (sourceDocumentId !== source.sourceId || source.sourceId !== sourceId || source.canonicalUrl !== canonicalUrl) {
      throw new Error("Reusable source document identity is invalid.");
    }
    if (source.currentSnapshotId === null) return null;
    const snapshotRecord = await this.getById("v2SourceSnapshots", source.currentSnapshotId);
    if (!snapshotRecord) return null;
    const { id: snapshotDocumentId, ...snapshotPayload } = snapshotRecord;
    const snapshot = sourceSnapshotSchema.parse(snapshotPayload);
    if (snapshotDocumentId !== snapshot.sourceSnapshotId || snapshot.sourceId !== source.sourceId || !verifyPayloadHash(snapshot)) {
      throw new Error("Reusable source snapshot integrity is invalid.");
    }
    const evidenceSegmentRecords = await this.boundedQuery("v2EvidenceSegments", [{ field: "sourceSnapshotId", op: "==", value: source.currentSnapshotId }], 200);
    const evidenceSegments = evidenceSegmentRecords.map((record) => {
      const { id: evidenceSegmentDocumentId, ...evidenceSegmentPayload } = record;
      const evidenceSegment = evidenceSegmentSchema.parse(evidenceSegmentPayload);
      if (evidenceSegmentDocumentId !== evidenceSegment.evidenceSegmentId || evidenceSegment.sourceSnapshotId !== snapshot.sourceSnapshotId || !verifyPayloadHash(evidenceSegment)) {
        throw new Error("Reusable source evidence segment integrity is invalid.");
      }
      return evidenceSegment;
    });
    return { source, snapshot, evidenceSegments };
  }

  reference(name: V2CorpusCollectionName, id: string): DocumentReference {
    return this.collection(name).doc(id);
  }
}
