import { z } from "zod";
import {
  atomicClaimVersionSchema,
  canonicalEventVersionSchema,
  claimAuthorityVerdictSchema,
  claimConflictSetSchema,
  completedKnowledgeSetSchema,
  hashSchema,
  idSchema,
  knowledgeCompletionPlanSchema,
  knowledgeCoverageAuditSchema,
  researchMapSchema,
  scopeContractSchema,
  V2_PIPELINE_VERSION,
  V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type CompletedKnowledgeSet,
  type KnowledgeCompletionPlan,
  type KnowledgeCoverageAudit,
  type ResearchMap,
  type ScopeContract
} from "./contracts";
import { expectedCompletedKnowledgeSetId, KNOWLEDGE_COVERAGE_POLICY_VERSION } from "./coverage";
import { payloadHash, verifyPayloadHash } from "./hashing";
import type { V2CorpusCollectionName } from "../corpus";

export const completedKnowledgeSetB1InputSchema = z.object({
  topicId: idSchema,
  completedKnowledgeSetId: idSchema,
  expectedCompletedKnowledgeSetHash: hashSchema.optional(),
  expectedScopeContractId: idSchema.optional(),
  expectedFinalCoverageAuditId: idSchema.optional()
}).strict();

export type CompletedKnowledgeSetB1Input = z.infer<typeof completedKnowledgeSetB1InputSchema>;

export function parseCompletedKnowledgeSetB1CliArguments(argv: readonly string[]): CompletedKnowledgeSetB1Input {
  const argument = (name: string, required = true): string | undefined => {
    const index = argv.indexOf(name);
    const value = index >= 0 ? argv[index + 1] : undefined;
    if (required && (!value || value.startsWith("--"))) throw new Error(`B1 requires ${name} with an explicit value; no default or latest fallback is permitted.`);
    return value && !value.startsWith("--") ? value : undefined;
  };
  return completedKnowledgeSetB1InputSchema.parse({
    topicId: argument("--topic-id"),
    completedKnowledgeSetId: argument("--completed-knowledge-set-id"),
    expectedCompletedKnowledgeSetHash: argument("--expected-completed-knowledge-set-hash", false)
  });
}

export type CompletedKnowledgeSetReader = {
  activeCorpusId(): string;
  getById(name: V2CorpusCollectionName, id: string): Promise<Record<string, unknown> | null>;
};

export type ReconstructedB1Knowledge = {
  completedKnowledgeSet: CompletedKnowledgeSet;
  initialCoverageAudit: KnowledgeCoverageAudit;
  finalCoverageAudit: KnowledgeCoverageAudit;
  completionPlan: KnowledgeCompletionPlan;
  scope: ScopeContract;
  originalResearchMap: ResearchMap;
  researchMap: ResearchMap;
  events: CanonicalEventVersion[];
  claims: AtomicClaimVersion[];
  authorityVerdicts: ClaimAuthorityVerdict[];
  conflicts: ClaimConflictSet[];
  candidateInputHash: string;
};

function withoutDocumentId(value: Record<string, unknown>): Record<string, unknown> {
  const { id: _documentId, ...artifact } = value;
  return artifact;
}

async function loadArtifact<T>(reader: CompletedKnowledgeSetReader, collection: V2CorpusCollectionName, id: string, schema: z.ZodType<T>): Promise<T> {
  const stored = await reader.getById(collection, id);
  if (!stored) throw new Error(`B1_LINEAGE_MISSING: ${collection}/${id}.`);
  const artifact = withoutDocumentId(stored);
  if (!verifyPayloadHash(artifact)) throw new Error(`B1_LINEAGE_HASH_MISMATCH: ${collection}/${id}.`);
  const parsed = schema.safeParse(artifact);
  if (!parsed.success) throw new Error(`B1_LINEAGE_SCHEMA_INVALID: ${collection}/${id}: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
  const value = parsed.data as Record<string, unknown>;
  if (value.artifactId !== id) throw new Error(`B1_LINEAGE_ID_MISMATCH: ${collection}/${id}.`);
  return parsed.data;
}

function canonicalIds(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function assertCanonicalMembership(label: string, values: readonly string[]): void {
  if (values.length !== new Set(values).size || values.some((value, index) => value !== canonicalIds(values)[index])) {
    throw new Error(`B1_LINEAGE_NONCANONICAL_MEMBERSHIP: ${label}.`);
  }
}

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = canonicalIds(left);
  const normalizedRight = canonicalIds(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function assertArtifactBoundary(set: CompletedKnowledgeSet, artifact: { corpusId: string; topicId: string; generation: number }, label: string): void {
  if (artifact.corpusId !== set.corpusId) throw new Error(`B1_LINEAGE_CORPUS_MISMATCH: ${label}.`);
  if (artifact.topicId !== set.topicId) throw new Error(`B1_LINEAGE_TOPIC_MISMATCH: ${label}.`);
  if (artifact.generation !== set.generation) throw new Error(`B1_LINEAGE_GENERATION_MISMATCH: ${label}.`);
}

async function loadMembership<T>(reader: CompletedKnowledgeSetReader, collection: V2CorpusCollectionName, ids: readonly string[], schema: z.ZodType<T>): Promise<T[]> {
  if (ids.length > 600) throw new Error(`B1_LINEAGE_UNBOUNDED_MEMBERSHIP: ${collection}.`);
  const artifacts: T[] = [];
  for (let offset = 0; offset < ids.length; offset += 50) {
    artifacts.push(...await Promise.all(ids.slice(offset, offset + 50).map((id) => loadArtifact(reader, collection, id, schema))));
  }
  return artifacts;
}

export async function reconstructCompletedKnowledgeSetForB1(reader: CompletedKnowledgeSetReader, rawInput: CompletedKnowledgeSetB1Input): Promise<ReconstructedB1Knowledge> {
  const input = completedKnowledgeSetB1InputSchema.parse(rawInput);
  const set = await loadArtifact(reader, "v2KnowledgeCompletionResults", input.completedKnowledgeSetId, completedKnowledgeSetSchema);
  if (set.completedKnowledgeSetId !== input.completedKnowledgeSetId) throw new Error("B1_LINEAGE_ID_MISMATCH: completed knowledge set.");
  if (expectedCompletedKnowledgeSetId(set) !== set.completedKnowledgeSetId) throw new Error("B1_LINEAGE_SEMANTIC_ID_MISMATCH: completed knowledge set.");
  if (set.corpusId !== reader.activeCorpusId()) throw new Error("B1_LINEAGE_CORPUS_MISMATCH: completed knowledge set.");
  if (set.topicId !== input.topicId) throw new Error("B1_LINEAGE_TOPIC_MISMATCH: completed knowledge set.");
  if (input.expectedCompletedKnowledgeSetHash && input.expectedCompletedKnowledgeSetHash !== set.payloadHash) throw new Error("B1_LINEAGE_EXPECTED_HASH_MISMATCH: completed knowledge set.");
  if (input.expectedScopeContractId && input.expectedScopeContractId !== set.scopeContractId) throw new Error("B1_LINEAGE_SCOPE_MISMATCH: requested Scope Contract.");
  if (input.expectedFinalCoverageAuditId && input.expectedFinalCoverageAuditId !== set.finalCoverageAuditId) throw new Error("B1_LINEAGE_COVERAGE_AUDIT_MISMATCH: requested final audit.");
  if (set.schemaVersion !== V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION || set.knowledgePipelineVersion !== V2_PIPELINE_VERSION || set.policyVersion !== KNOWLEDGE_COVERAGE_POLICY_VERSION) {
    throw new Error("B1_LINEAGE_SEMANTIC_VERSION_INCOMPATIBLE: completed knowledge set.");
  }
  if (set.finalVerdict !== "SUFFICIENT") throw new Error("B1_LINEAGE_COVERAGE_NOT_SUFFICIENT: completed knowledge set.");

  for (const [label, ids] of Object.entries({
    candidateEventVersionIds: set.candidateEventVersionIds,
    candidateClaimVersionIds: set.candidateClaimVersionIds,
    authorityVerdictIds: set.authorityVerdictIds,
    conflictSetIds: set.conflictSetIds,
    unresolvedGapIds: set.unresolvedGapIds
  })) assertCanonicalMembership(label, ids);

  const [initialCoverageAudit, finalCoverageAudit, completionPlan, scope, researchMap, events, claims, authorityVerdicts, conflicts] = await Promise.all([
    loadArtifact(reader, "v2KnowledgeCoverageAudits", set.initialCoverageAuditId, knowledgeCoverageAuditSchema),
    loadArtifact(reader, "v2KnowledgeCoverageAudits", set.finalCoverageAuditId, knowledgeCoverageAuditSchema),
    loadArtifact(reader, "v2KnowledgeCompletionPlans", set.completionPlanId, knowledgeCompletionPlanSchema),
    loadArtifact(reader, "v2ScopeContracts", set.scopeContractId, scopeContractSchema),
    loadArtifact(reader, "v2ResearchMaps", set.researchMapId, researchMapSchema),
    loadMembership(reader, "v2CanonicalEventVersions", set.candidateEventVersionIds, canonicalEventVersionSchema),
    loadMembership(reader, "v2AtomicClaimVersions", set.candidateClaimVersionIds, atomicClaimVersionSchema),
    loadMembership(reader, "v2ClaimAuthorityVerdicts", set.authorityVerdictIds, claimAuthorityVerdictSchema),
    loadMembership(reader, "v2ClaimConflictSets", set.conflictSetIds, claimConflictSetSchema)
  ] as const);
  const originalResearchMap = await loadArtifact(reader, "v2ResearchMaps", completionPlan.originalResearchMapId, researchMapSchema);

  for (const [label, artifact] of [
    ["initial coverage audit", initialCoverageAudit], ["final coverage audit", finalCoverageAudit], ["completion plan", completionPlan],
    ["Scope Contract", scope], ["original Research Map", originalResearchMap], ["Research Map", researchMap], ...events.map((value) => ["candidate Event Version", value] as const),
    ...claims.map((value) => ["candidate Claim Version", value] as const), ...authorityVerdicts.map((value) => ["Authority Verdict", value] as const),
    ...conflicts.map((value) => ["Conflict Set", value] as const)
  ] as const) assertArtifactBoundary(set, artifact, label);

  if ([initialCoverageAudit, finalCoverageAudit, completionPlan, researchMap].some((artifact) => artifact.schemaVersion !== "factory-v2-a.4" || artifact.policyVersion !== set.policyVersion)) throw new Error("B1_LINEAGE_SEMANTIC_VERSION_INCOMPATIBLE: coverage chain.");

  if (set.parentArtifactId !== completionPlan.completionPlanId || completionPlan.parentArtifactId !== initialCoverageAudit.coverageAuditId || completionPlan.parentCoverageAuditId !== initialCoverageAudit.coverageAuditId) throw new Error("B1_LINEAGE_COMPLETION_PLAN_MISMATCH.");
  if (initialCoverageAudit.auditStage !== "INITIAL" || initialCoverageAudit.payloadHash !== set.initialCoverageAuditPayloadHash) throw new Error("B1_LINEAGE_INITIAL_AUDIT_MISMATCH.");
  if (finalCoverageAudit.auditStage !== "FINAL" || finalCoverageAudit.payloadHash !== set.finalCoverageAuditPayloadHash || finalCoverageAudit.verdict !== "SUFFICIENT") throw new Error("B1_LINEAGE_FINAL_AUDIT_MISMATCH.");
  if (set.finalVerdict !== finalCoverageAudit.verdict || !sameIds(set.unresolvedGapIds, finalCoverageAudit.gaps.map((gap) => gap.gapId))) throw new Error("B1_LINEAGE_FINAL_COVERAGE_RESULT_MISMATCH.");
  if (scope.payloadHash !== set.scopePayloadHash || finalCoverageAudit.scopeContractId !== scope.scopeContractId || finalCoverageAudit.scopePayloadHash !== scope.payloadHash) throw new Error("B1_LINEAGE_SCOPE_MISMATCH: final coverage lineage.");
  if (researchMap.payloadHash !== set.researchMapPayloadHash || researchMap.scopeContractId !== scope.scopeContractId || researchMap.scopePayloadHash !== scope.payloadHash || finalCoverageAudit.parentArtifactId !== researchMap.researchMapId || finalCoverageAudit.researchMapId !== researchMap.researchMapId || finalCoverageAudit.researchMapPayloadHash !== researchMap.payloadHash) throw new Error("B1_LINEAGE_RESEARCH_MAP_MISMATCH.");
  if (completionPlan.originalScopeContractId !== scope.scopeContractId || originalResearchMap.scopeContractId !== scope.scopeContractId || originalResearchMap.scopePayloadHash !== scope.payloadHash || initialCoverageAudit.parentArtifactId !== originalResearchMap.researchMapId || initialCoverageAudit.scopeContractId !== scope.scopeContractId || initialCoverageAudit.scopePayloadHash !== scope.payloadHash || initialCoverageAudit.researchMapId !== originalResearchMap.researchMapId || initialCoverageAudit.researchMapPayloadHash !== originalResearchMap.payloadHash || researchMap.parentArtifactId !== originalResearchMap.researchMapId) throw new Error("B1_LINEAGE_COMPLETION_PARENT_MISMATCH.");
  if (!sameIds(set.candidateEventVersionIds, finalCoverageAudit.candidateEventVersionIds)) throw new Error("B1_LINEAGE_CANDIDATE_MEMBERSHIP_MISMATCH.");

  const claimIds = new Set(claims.map((claim) => claim.claimVersionId));
  const eventIdentityKeys = events.map((event) => event.canonicalEventId || event.candidateEventId);
  if (new Set(eventIdentityKeys).size !== eventIdentityKeys.length) throw new Error("B1_LINEAGE_DUPLICATE_CANONICAL_EVENT_MEMBERSHIP.");
  for (const event of events) {
    if (event.scopeContractId !== scope.scopeContractId) throw new Error(`B1_LINEAGE_SCOPE_MISMATCH: event ${event.eventVersionId}.`);
    for (const claimId of [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds]) if (!claimIds.has(claimId)) throw new Error(`B1_LINEAGE_MISSING_EVENT_CLAIM: ${event.eventVersionId}/${claimId}.`);
  }
  const verdictClaimIds = new Set<string>();
  for (const verdict of authorityVerdicts) {
    if (!claimIds.has(verdict.claimVersionId)) throw new Error(`B1_LINEAGE_VERDICT_CLAIM_MISMATCH: ${verdict.claimAuthorityVerdictId}.`);
    if (verdictClaimIds.has(verdict.claimVersionId)) throw new Error(`B1_LINEAGE_DUPLICATE_VERDICT: ${verdict.claimVersionId}.`);
    verdictClaimIds.add(verdict.claimVersionId);
  }
  for (const event of events) for (const claimId of event.coreClaimVersionIds) if (!verdictClaimIds.has(claimId)) throw new Error(`B1_LINEAGE_MISSING_CORE_CLAIM_VERDICT: ${event.eventVersionId}/${claimId}.`);
  for (const conflict of conflicts) for (const claimId of conflict.claimVersionIds) if (!claimIds.has(claimId)) throw new Error(`B1_LINEAGE_CONFLICT_CLAIM_MISMATCH: ${conflict.conflictSetId}/${claimId}.`);

  const auditClaimIds = finalCoverageAudit.cells.flatMap((cell) => cell.supportingClaimVersionIds);
  const auditEventIds = finalCoverageAudit.cells.flatMap((cell) => cell.chronologyEligibleEventVersionIds);
  const auditConflictIds = finalCoverageAudit.cells.flatMap((cell) => cell.conflictSetIds);
  const eventIds = new Set(set.candidateEventVersionIds);
  const conflictIds = new Set(set.conflictSetIds);
  if (auditClaimIds.some((id) => !claimIds.has(id)) || auditEventIds.some((id) => !eventIds.has(id)) || auditConflictIds.some((id) => !conflictIds.has(id))) throw new Error("B1_LINEAGE_FINAL_AUDIT_REFERENCE_MISMATCH.");

  const candidateInputHash = payloadHash({
    completedKnowledgeSetId: set.completedKnowledgeSetId,
    completedKnowledgeSetHash: set.payloadHash,
    scope: { id: scope.scopeContractId, hash: scope.payloadHash },
    researchMap: { id: researchMap.researchMapId, hash: researchMap.payloadHash },
    finalCoverageAudit: { id: finalCoverageAudit.coverageAuditId, hash: finalCoverageAudit.payloadHash },
    events: events.map((event) => ({ id: event.eventVersionId, hash: event.payloadHash })),
    claims: claims.map((claim) => ({ id: claim.claimVersionId, hash: claim.payloadHash })),
    authorityVerdicts: authorityVerdicts.map((verdict) => ({ id: verdict.claimAuthorityVerdictId, hash: verdict.payloadHash })),
    conflicts: conflicts.map((conflict) => ({ id: conflict.conflictSetId, hash: conflict.payloadHash }))
  });
  return { completedKnowledgeSet: set, initialCoverageAudit, finalCoverageAudit, completionPlan, scope, originalResearchMap, researchMap, events, claims, authorityVerdicts, conflicts, candidateInputHash };
}
