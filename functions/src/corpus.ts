import type { CollectionReference } from "firebase-admin/firestore";
import { ACTIVE_CORPUS_ID, PUBLIC_ID_BASE } from "./config";
import { db } from "./firestore";

export const CORPUS_COLLECTIONS = [
  "adminOperations",
  "auditEvents",
  "categoryDocuments",
  "claimLinks",
  "continuityDocuments",
  "corpusDocuments",
  "counters",
  "evidenceRecords",
  "evidenceValidations",
  "factoryArtifacts",
  "qualityArtifacts",
  "factoryObjects",
  "factoryRuns",
  "failureRecords",
  "generationJobs",
  "governanceApprovals",
  "governanceAudits",
  "governanceDecisions",
  "governancePackages",
  "governanceQueues",
  "libraryAdmissions",
  "platformReadModels",
  "publicationLifecycle",
  "publishedMemory",
  "rateLimits",
  "searchDocuments",
  "sitemapDocuments",
  "sourceRecords",
  "sourceAuthorityArtifacts",
  "sourceSnapshots",
  "tagDocuments",
  "topicLedgers"
] as const;

export type CorpusCollectionName = (typeof CORPUS_COLLECTIONS)[number];

export const V2_CORPUS_COLLECTIONS = [
  "v2ScopeContracts",
  "v2ScopeAmendmentProposals",
  "v2ResearchMaps",
  "v2ResearchTasks",
  "v2QueryPlans",
  "v2AcquisitionRuns",
  "v2PublisherAuthorityRecords",
  "v2PublisherAuthorityVersions",
  "v2SourceDocuments",
  "v2SourceSnapshots",
  "v2EvidenceSegments",
  "v2AtomicClaims",
  "v2AtomicClaimVersions",
  "v2ClaimEvidence",
  "v2ClaimAuthorityVerdicts",
  "v2ClaimConflictSets",
  "v2CanonicalEntities",
  "v2CanonicalEntityVersions",
  "v2EntityAliases",
  "v2CanonicalEvents",
  "v2CanonicalEventVersions",
  "v2EventClaims",
  "v2EventEntities",
  "v2EventRelations",
  "v2ModelExecutions",
  "v2FailureRecords",
  "v2AuditRecords",
  "v2TopicOperations",
  "v2ReconnaissanceRecords",
  "v2AcquisitionDiscoveries",
  "v2RankedCandidateSets",
  "v2CoverageCells",
  "v2TimelineViewSpecifications",
  "v2TimelineEventMemberships",
  "v2KnowledgeCoverageAudits",
  "v2KnowledgeCompletionPlans",
  "v2KnowledgeCompletionResults"
] as const;

export type V2CorpusCollectionName = (typeof V2_CORPUS_COLLECTIONS)[number];

export function corpusCollection(name: CorpusCollectionName): CollectionReference {
  return db.collection("corpora").doc(ACTIVE_CORPUS_ID).collection(name);
}

/** Server-only V2 Production Memory. Kept separate so public repositories cannot import it accidentally. */
export function v2CorpusCollection(name: V2CorpusCollectionName): CollectionReference {
  return db.collection("corpora").doc(ACTIVE_CORPUS_ID).collection(name);
}

export function corpusRecord<T extends Record<string, unknown>>(data: T): T & { corpusId: string } {
  return { ...data, corpusId: ACTIVE_CORPUS_ID };
}

type ActiveCorpusRegistry = {
  corpusId: string;
  lifecycle: "ACTIVE";
  isolationPolicy: "NO_LEGACY_CONTENT_REUSE";
  pipelineEntry: "VERTEX_GOOGLE_SEARCH_GROUNDING";
  publicIdBase: number;
};

let cachedRegistry: { expiresAt: number; value: ActiveCorpusRegistry } | null = null;

export async function assertActiveCorpus(): Promise<ActiveCorpusRegistry> {
  if (cachedRegistry && cachedRegistry.expiresAt > Date.now()) return cachedRegistry.value;
  const [pointer, registry] = await Promise.all([
    db.collection("runtimeConfiguration").doc("activeCorpus").get(),
    db.collection("corpusRegistry").doc(ACTIVE_CORPUS_ID).get()
  ]);
  const pointerData = pointer.data();
  const registryData = registry.data();
  if (!pointer.exists || pointerData?.activeCorpusId !== ACTIVE_CORPUS_ID) {
    throw new Error("Runtime ACTIVE_CORPUS_ID does not match the activated corpus pointer.");
  }
  if (
    !registry.exists ||
    registryData?.corpusId !== ACTIVE_CORPUS_ID ||
    registryData?.lifecycle !== "ACTIVE" ||
    registryData?.isolationPolicy !== "NO_LEGACY_CONTENT_REUSE" ||
    registryData?.pipelineEntry !== "VERTEX_GOOGLE_SEARCH_GROUNDING" ||
    registryData?.publicIdBase !== PUBLIC_ID_BASE
  ) {
    throw new Error("Active corpus registry is missing or incompatible with the runtime configuration.");
  }
  const value = registryData as ActiveCorpusRegistry;
  cachedRegistry = { value, expiresAt: Date.now() + 30_000 };
  return value;
}

export function requireTaskCorpus(corpusId: string): void {
  if (corpusId !== ACTIVE_CORPUS_ID) throw new Error("Task corpus does not match the active runtime corpus.");
}
