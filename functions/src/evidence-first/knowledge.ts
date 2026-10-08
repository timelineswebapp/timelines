import { randomUUID } from "node:crypto";
import {
  atomicClaimVersionSchema,
  canonicalEventVersionSchema,
  claimAuthorityVerdictSchema,
  claimConflictSetSchema,
  researchMapSchema,
  scopeContractSchema,
  sourceDocumentSchema,
  sourceSnapshotSchema,
  evidenceSegmentSchema,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type CompletedKnowledgeSet,
  type EvidenceSegment,
  type ResearchMap,
  type ScopeContract,
  type SourceDocument,
  type SourceSnapshot
} from "../factory-v2/contracts";
import { type ArtifactContext } from "../factory-v2/contracts/builders";
import { auditKnowledgeCoverage, buildCompletionResearchMap, buildKnowledgeCompletionResult, DEFAULT_COMPLETION_BUDGET, KNOWLEDGE_COVERAGE_POLICY_VERSION, mergeKnowledgeEventVersions, planGapDirectedCompletion, sealNoCompletionRequired } from "../factory-v2/coverage";
import type { FactoryV2Config } from "../factory-v2/config";
import { runV2AShadowFixture, V2ARunError, type OrchestratorDependencies, type ShadowFixtureDescriptor, type V2ACertificationMetrics } from "../factory-v2/orchestrator";
import { V2FirestoreRepository } from "../factory-v2/repositories/firestore";

export type CompletedKnowledge = {
  scope: ScopeContract;
  researchMap: ResearchMap;
  claims: AtomicClaimVersion[];
  authorityVerdicts: ClaimAuthorityVerdict[];
  conflicts: ClaimConflictSet[];
  events: CanonicalEventVersion[];
  evidenceSegments: EvidenceSegment[];
  sourceSnapshots: SourceSnapshot[];
  sourceDocuments: SourceDocument[];
  completedKnowledgeSet: CompletedKnowledgeSet;
  initialCoverageAuditId: string;
  finalCoverageAuditId: string;
  completionRoundCount: 0 | 1;
  acquisitionMetrics: V2ACertificationMetrics[];
  controlledResearchLedgerIds: string[];
};

export class KnowledgeConstructionError extends Error {
  constructor(
    message: string,
    readonly stage: "INITIAL_ACQUISITION" | "GAP_COMPLETION" | "FINAL_COVERAGE",
    readonly acquisitionResults: Array<Awaited<ReturnType<typeof runV2AShadowFixture>>>,
    readonly coverage: { initialAuditId: string | null; finalAuditId: string | null } = { initialAuditId: null, finalAuditId: null },
    readonly acquisitionMetrics: V2ACertificationMetrics[] = acquisitionResults.map((result) => result.metrics)
  ) {
    super(message);
    this.name = "KnowledgeConstructionError";
  }
}

export function stripRepositoryDocumentId<T extends Record<string, unknown>>(value: T): Omit<T, "id"> {
  const { id: _repositoryDocumentId, ...artifact } = value;
  return artifact;
}

export function canInitialAcquisitionEnterCoverage(result: Pick<Awaited<ReturnType<typeof runV2AShadowFixture>>, "blockingReasons" | "metrics">): boolean {
  if (result.metrics.finalV2AVerdict === "PASS") return true;
  return result.metrics.sourceDocumentsSnapshotted > 0
    && result.metrics.claimsSupported > 0
    && result.blockingReasons.length === 1
    && result.blockingReasons[0] === "NO_RESOLVED_EVENT_CANDIDATES";
}

async function loadByIds<T>(repository: V2FirestoreRepository, collection: Parameters<V2FirestoreRepository["getById"]>[0], ids: readonly string[], parse: (value: unknown) => T): Promise<T[]> {
  if (ids.length > 600) throw new Error(`EVIDENCE_FIRST_UNBOUNDED_LOAD:${collection}`);
  return Promise.all(ids.map(async (id) => {
    const value = await repository.getById(collection, id);
    if (!value) throw new Error(`EVIDENCE_FIRST_LINEAGE_MISSING:${collection}/${id}`);
    return parse(stripRepositoryDocumentId(value));
  }));
}

function unique<T>(values: readonly T[], identity: (value: T) => string): T[] {
  return [...new Map(values.map((value) => [identity(value), value])).values()].sort((left, right) => identity(left).localeCompare(identity(right)));
}

async function loadRunKnowledge(repository: V2FirestoreRepository, result: Awaited<ReturnType<typeof runV2AShadowFixture>>) {
  const [scopeValue, mapValue, claims, authorityVerdicts, conflicts, events, sourceSnapshots] = await Promise.all([
    repository.getById("v2ScopeContracts", result.scopeContractId),
    repository.getById("v2ResearchMaps", result.researchMapId),
    loadByIds(repository, "v2AtomicClaimVersions", result.claimVersionIds, (value) => atomicClaimVersionSchema.parse(value)),
    loadByIds(repository, "v2ClaimAuthorityVerdicts", result.authorityVerdictIds, (value) => claimAuthorityVerdictSchema.parse(value)),
    loadByIds(repository, "v2ClaimConflictSets", result.conflictSetIds, (value) => claimConflictSetSchema.parse(value)),
    loadByIds(repository, "v2CanonicalEventVersions", result.eventVersionIds, (value) => canonicalEventVersionSchema.parse(value)),
    loadByIds(repository, "v2SourceSnapshots", result.sourceSnapshotIds, (value) => sourceSnapshotSchema.parse(value))
  ] as const);
  if (!scopeValue || !mapValue) throw new Error("EVIDENCE_FIRST_SCOPE_OR_MAP_MISSING");
  const scopeArtifact = stripRepositoryDocumentId(scopeValue);
  const mapArtifact = stripRepositoryDocumentId(mapValue);
  const scope = scopeContractSchema.parse(scopeArtifact);
  const researchMap = researchMapSchema.parse(mapArtifact);
  const evidenceSegments = unique((await Promise.all(sourceSnapshots.map((snapshot) => repository.boundedQuery("v2EvidenceSegments", [{ field: "sourceSnapshotId", op: "==", value: snapshot.sourceSnapshotId }], 200)))).flat().map((value) => {
    return evidenceSegmentSchema.parse(stripRepositoryDocumentId(value));
  }), (value) => value.evidenceSegmentId);
  const sourceDocuments = await loadByIds(repository, "v2SourceDocuments", unique(sourceSnapshots, (value) => value.sourceId).map((snapshot) => snapshot.sourceId), (value) => sourceDocumentSchema.parse(value));
  return { scope, researchMap, claims, authorityVerdicts, conflicts, events, sourceSnapshots, evidenceSegments, sourceDocuments };
}

export async function buildCompletedKnowledge(input: {
  descriptor: ShadowFixtureDescriptor;
  config: FactoryV2Config;
  repository?: V2FirestoreRepository;
  provider?: OrchestratorDependencies["provider"];
  retrieval?: OrchestratorDependencies["retrieval"];
  institutionalDiscoveryTransport?: OrchestratorDependencies["institutionalDiscoveryTransport"];
}): Promise<CompletedKnowledge> {
  const repository = input.repository || new V2FirestoreRepository();
  const dependencies = { repository, provider: input.provider, retrieval: input.retrieval, institutionalDiscoveryTransport: input.institutionalDiscoveryTransport };
  const acquisitionConfig = input.config;
  let initialResult: Awaited<ReturnType<typeof runV2AShadowFixture>>;
  try {
    initialResult = await runV2AShadowFixture(input.descriptor, acquisitionConfig, dependencies);
  } catch (error) {
    if (error instanceof V2ARunError) throw new KnowledgeConstructionError(error.message, "INITIAL_ACQUISITION", [], undefined, [error.metrics]);
    throw new KnowledgeConstructionError(`EVIDENCE_FIRST_INITIAL_ACQUISITION_CONTRACT_FAILED:${error instanceof Error ? error.message : String(error)}`, "INITIAL_ACQUISITION", []);
  }
  const acquisitionResults = [initialResult];
  if (!canInitialAcquisitionEnterCoverage(initialResult)) throw new KnowledgeConstructionError(`EVIDENCE_FIRST_INITIAL_ACQUISITION_FAILED:${initialResult.blockingReasons.join(",")}`, "INITIAL_ACQUISITION", acquisitionResults);
  const initial = await loadRunKnowledge(repository, initialResult);
  const initialContext: ArtifactContext = { ...initialResult.context, policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
  const initialAudit = auditKnowledgeCoverage({ context: initialContext, stage: "INITIAL", scope: initial.scope, researchMap: initial.researchMap, sourceKnowledgeRunIds: [initialResult.context.runId], claims: initial.claims, authorityVerdicts: initial.authorityVerdicts, conflicts: initial.conflicts, events: initial.events, sourceSnapshots: initial.sourceSnapshots });
  await repository.createImmutable("v2KnowledgeCoverageAudits", initialAudit);

  let finalContext = initialContext;
  let finalMap = initial.researchMap;
  let claims = initial.claims;
  let verdicts = initial.authorityVerdicts;
  let conflicts = initial.conflicts;
  let events = initial.events;
  let snapshots = initial.sourceSnapshots;
  let segments = initial.evidenceSegments;
  let documents = initial.sourceDocuments;
  let finalAudit;
  let completionPlan;
  const metrics = [initialResult.metrics];

  if (initialAudit.verdict === "SUFFICIENT") {
    completionPlan = sealNoCompletionRequired({ context: initialContext, scope: initial.scope, researchMap: initial.researchMap, audit: initialAudit });
    await repository.createImmutable("v2KnowledgeCompletionPlans", completionPlan);
    finalAudit = auditKnowledgeCoverage({ context: initialContext, stage: "FINAL", scope: initial.scope, researchMap: initial.researchMap, sourceKnowledgeRunIds: [initialResult.context.runId], claims, authorityVerdicts: verdicts, conflicts, events, sourceSnapshots: snapshots });
  } else {
    completionPlan = planGapDirectedCompletion({ context: initialContext, scope: initial.scope, researchMap: initial.researchMap, audit: initialAudit, originalKnowledgeRunId: initialResult.context.runId });
    await repository.createImmutable("v2KnowledgeCompletionPlans", completionPlan);
    const completionContext: ArtifactContext = { corpusId: initialContext.corpusId, topicId: initialContext.topicId, generation: initialContext.generation, runId: `evidence-first-completion-${randomUUID()}`, createdAt: new Date().toISOString(), policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
    let completionMap: ResearchMap;
    let budget: ScopeContract["researchBudget"];
    try {
      completionMap = buildCompletionResearchMap({ context: completionContext, scope: initial.scope, parent: initial.researchMap, plan: completionPlan });
      budget = { maximumGroundingCalls: DEFAULT_COMPLETION_BUDGET.maximumGroundingCalls, maximumProviderQueries: input.config.budgetBundle.maximumProviderQueries, maximumSourceDocuments: DEFAULT_COMPLETION_BUDGET.maximumSourceDocuments, maximumAtomicClaims: DEFAULT_COMPLETION_BUDGET.maximumAtomicClaims, maximumSemanticRepairs: input.config.budgetBundle.maximumSemanticRepairs, maximumTransportAttemptsPerCall: input.config.budgetBundle.maximumTransportAttemptsPerCall, maximumConcurrency: input.config.budgetBundle.maximumConcurrency, maximumWorkerSeconds: DEFAULT_COMPLETION_BUDGET.maximumWorkerSeconds };
    } catch (error) {
      throw new KnowledgeConstructionError(`EVIDENCE_FIRST_GAP_COMPLETION_CONTRACT_FAILED:${error instanceof Error ? error.message : String(error)}`, "GAP_COMPLETION", acquisitionResults, { initialAuditId: initialAudit.coverageAuditId, finalAuditId: null }, metrics);
    }
    let completionResult: Awaited<ReturnType<typeof runV2AShadowFixture>>;
    try {
      const gapIdsByQuestionId = new Map<string, readonly string[]>();
      for (const task of completionPlan.tasks) for (const questionId of task.questionIds) {
        gapIdsByQuestionId.set(questionId, [...new Set([...(gapIdsByQuestionId.get(questionId) || []), ...task.gapIds])].sort());
      }
      completionResult = await runV2AShadowFixture(input.descriptor, { ...input.config, budgetBundle: budget }, { ...dependencies, continuation: { context: completionContext, originalKnowledgeRunId: initialResult.context.runId, scope: initial.scope, researchMap: completionMap, gapIdsByQuestionId } });
    } catch (error) {
      if (error instanceof V2ARunError) throw new KnowledgeConstructionError(error.message, "GAP_COMPLETION", acquisitionResults, { initialAuditId: initialAudit.coverageAuditId, finalAuditId: null }, [...metrics, error.metrics]);
      throw error;
    }
    acquisitionResults.push(completionResult);
    if (completionResult.metrics.finalV2AVerdict !== "PASS") throw new KnowledgeConstructionError(`EVIDENCE_FIRST_GAP_COMPLETION_FAILED:${completionResult.blockingReasons.join(",")}`, "GAP_COMPLETION", acquisitionResults, { initialAuditId: initialAudit.coverageAuditId, finalAuditId: null });
    metrics.push(completionResult.metrics);
    const completion = await loadRunKnowledge(repository, completionResult);
    finalContext = completionContext;
    finalMap = completionMap;
    claims = unique([...claims, ...completion.claims], (value) => value.claimVersionId);
    verdicts = unique([...verdicts, ...completion.authorityVerdicts], (value) => value.claimVersionId);
    conflicts = unique([...conflicts, ...completion.conflicts], (value) => value.conflictSetId);
    events = mergeKnowledgeEventVersions([...events, ...completion.events]);
    snapshots = unique([...snapshots, ...completion.sourceSnapshots], (value) => value.sourceSnapshotId);
    segments = unique([...segments, ...completion.evidenceSegments], (value) => value.evidenceSegmentId);
    documents = unique([...documents, ...completion.sourceDocuments], (value) => value.sourceId);
    finalAudit = auditKnowledgeCoverage({ context: completionContext, stage: "FINAL", scope: initial.scope, researchMap: completionMap, sourceKnowledgeRunIds: [initialResult.context.runId, completionResult.context.runId], claims, authorityVerdicts: verdicts, conflicts, events, sourceSnapshots: snapshots });
  }
  await repository.createImmutable("v2KnowledgeCoverageAudits", finalAudit);
  const authorityAcquisitionRounds = acquisitionResults.map((result) => ({
    topicAuthoritySetId: result.topicAuthoritySetId,
    routingObligationSetId: result.routingObligationSetId,
    authorityResearchPlanId: result.authorityResearchPlanId,
    controlledResearchLedgerId: result.controlledResearchLedgerId,
    perspectiveAuditId: result.perspectiveAuditId,
    confidenceVectorId: result.confidenceVectorId
  }));
  const completedKnowledgeSet = buildKnowledgeCompletionResult(finalContext, { completionPlanId: completionPlan.completionPlanId, initialCoverageAuditId: initialAudit.coverageAuditId, initialCoverageAuditPayloadHash: initialAudit.payloadHash, finalCoverageAuditId: finalAudit.coverageAuditId, finalCoverageAuditPayloadHash: finalAudit.payloadHash, scopeContractId: initial.scope.scopeContractId, scopePayloadHash: initial.scope.payloadHash, researchMapId: finalMap.researchMapId, researchMapPayloadHash: finalMap.payloadHash, authorityAcquisitionRounds, candidateEventVersionIds: events.map((event) => event.eventVersionId), candidateClaimVersionIds: claims.map((claim) => claim.claimVersionId), authorityVerdictIds: verdicts.map((verdict) => verdict.claimAuthorityVerdictId), conflictSetIds: conflicts.map((conflict) => conflict.conflictSetId), unresolvedGapIds: finalAudit.gaps.map((gap) => gap.gapId), finalVerdict: finalAudit.verdict });
  await repository.createImmutable("v2KnowledgeCompletionResults", completedKnowledgeSet);
  if (finalAudit.verdict !== "SUFFICIENT") throw new KnowledgeConstructionError(`EVIDENCE_FIRST_COVERAGE_INSUFFICIENT:${finalAudit.gaps.map((gap) => gap.code).join(",")}`, "FINAL_COVERAGE", acquisitionResults, { initialAuditId: initialAudit.coverageAuditId, finalAuditId: finalAudit.coverageAuditId });
  return { scope: initial.scope, researchMap: finalMap, claims, authorityVerdicts: verdicts, conflicts, events, evidenceSegments: segments, sourceSnapshots: snapshots, sourceDocuments: documents, completedKnowledgeSet, initialCoverageAuditId: initialAudit.coverageAuditId, finalCoverageAuditId: finalAudit.coverageAuditId, completionRoundCount: completionPlan.round, acquisitionMetrics: metrics, controlledResearchLedgerIds: authorityAcquisitionRounds.map((round) => round.controlledResearchLedgerId) };
}
