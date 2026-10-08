import type { V2FirestoreRepository } from "./repositories/firestore";
import { contentAddressedId } from "./hashing";
import type { AuthorityFirstExecutionSupervisor } from "./execution-supervisor";

export type ReconnaissanceResult = {
  reconnaissanceId: string;
  topicId: string;
  scopeContractId: string;
  knownEntities: Record<string, unknown>[];
  admittedEvents: Record<string, unknown>[];
  strongClaims: Record<string, unknown>[];
  reusableSnapshots: Record<string, unknown>[];
  conflicts: Record<string, unknown>[];
  gaps: string[];
  reuseClassifications: Array<{ artifactId: string; classification: "REUSE_DIRECTLY" | "REVALIDATE" | "IMPORT_AS_LEGACY_KNOWLEDGE" | "SHADOW_ONLY" }>;
};

export async function performBoundedReconnaissance(input: {
  repository: V2FirestoreRepository;
  topicId: string;
  scopeContractId: string;
  entityNameKeys: string[];
  limitPerKind?: number;
  supervisor?: AuthorityFirstExecutionSupervisor;
}): Promise<ReconnaissanceResult> {
  const limit = Math.max(1, Math.min(50, Math.trunc(input.limitPerKind || 25)));
  const bounded = <T>(name: string, operation: () => Promise<T>) => input.supervisor
    ? input.supervisor.runChild({ name, maximumMs: Math.max(1, input.supervisor.remainingMs()), run: () => operation() })
    : operation();
  const entityQueries = input.entityNameKeys.slice(0, 10).map((name, index) => bounded(`reconnaissance:entity:${index}`, () => input.repository.boundedQuery("v2CanonicalEntities", [
    { field: "canonicalNameKey", op: "==", value: name },
    { field: "state", op: "in", value: ["FACTORY_CANDIDATE", "ADMITTED"] }
  ], limit)));
  const [entityGroups, admittedEvents, strongClaims, reusableSnapshots, conflicts] = await Promise.all([
    Promise.all(entityQueries),
    bounded("reconnaissance:events", () => input.repository.boundedQuery("v2CanonicalEventVersions", [{ field: "topicId", op: "==", value: input.topicId }, { field: "authorityState", op: "in", value: ["FACTORY_CANDIDATE", "ADMITTED"] }], limit)),
    bounded("reconnaissance:claims", () => input.repository.boundedQuery("v2AtomicClaimVersions", [{ field: "topicId", op: "==", value: input.topicId }, { field: "validationState", op: "in", value: ["SUPPORTED", "QUALIFIED"] }], limit)),
    bounded("reconnaissance:snapshots", () => input.repository.boundedQuery("v2SourceSnapshots", [{ field: "topicId", op: "==", value: input.topicId }, { field: "retrievalDisposition", op: "in", value: ["NEWLY_RETRIEVED", "CACHE_REUSED", "REVALIDATED"] }], limit)),
    bounded("reconnaissance:conflicts", () => input.repository.boundedQuery("v2ClaimConflictSets", [{ field: "topicId", op: "==", value: input.topicId }, { field: "state", op: "in", value: ["UNRESOLVED", "HISTORICALLY_CONTESTED"] }], limit))
  ]);
  const knownEntities = entityGroups.flat().slice(0, limit);
  const reuseClassifications = [
    ...admittedEvents.map((event) => ({ artifactId: String(event.artifactId), classification: (event.authorityState === "ADMITTED" ? "REUSE_DIRECTLY" : "REVALIDATE") as "REUSE_DIRECTLY" | "REVALIDATE" })),
    ...strongClaims.map((claim) => ({ artifactId: String(claim.artifactId), classification: "REVALIDATE" as const })),
    ...reusableSnapshots.map((snapshot) => ({ artifactId: String(snapshot.artifactId), classification: "REVALIDATE" as const }))
  ];
  const gaps = [
    ...(knownEntities.length === 0 ? ["NO_RESOLVED_ENTITY_KNOWLEDGE"] : []),
    ...(strongClaims.length === 0 ? ["NO_REUSABLE_SUPPORTED_CLAIMS"] : []),
    ...(reusableSnapshots.length === 0 ? ["NO_REUSABLE_SOURCE_SNAPSHOTS"] : []),
    ...(conflicts.length > 0 ? ["EXISTING_CONFLICT_REQUIRES_RESEARCH"] : [])
  ];
  const body = { topicId: input.topicId, scopeContractId: input.scopeContractId, knownEntities, admittedEvents, strongClaims, reusableSnapshots, conflicts, gaps, reuseClassifications };
  return { reconnaissanceId: contentAddressedId("recon", body), ...body };
}
