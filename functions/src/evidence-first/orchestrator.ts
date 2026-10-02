import { randomUUID } from "node:crypto";
import { assessReaderEditorialReview, type ReaderEditorialAssessment } from "../editorial-reader";
import type { ClaimAuthorityVerdict } from "../factory-v2/contracts";
import { V2_B_PROMPT_VERSION, type SignificanceProposal } from "../factory-v2/contracts/assembly";
import type { FactoryV2Config } from "../factory-v2/config";
import { attachPayloadHash, contentAddressedId } from "../factory-v2/hashing";
import type { OrchestratorDependencies, ShadowFixtureDescriptor } from "../factory-v2/orchestrator";
import { V2FirestoreRepository } from "../factory-v2/repositories/firestore";
import { evaluateHistoricalSignificance } from "../factory-v2/selection-model";
import { assembleTimelineSelection, evaluateCandidateEligibility } from "../factory-v2/selection";
import { reconstructCompletedKnowledgeSetForB1 } from "../factory-v2/completed-knowledge-set";
import { assessEditorialPlan, assessTimelineQuality, type TimelineQualityAssessment } from "../quality";
import { assessSourceAuthority, type SourceAuthorityAssessment } from "../source-authority";
import { generateReaderEditorialReview, type ReaderEditorialReviewResult } from "../vertex";
import type { GeneratedTimeline } from "../schemas";
import { composeFromEventLock, type CompositionProvider } from "./composition";
import { buildEventLock } from "./contracts";
import { adaptEvidenceFirstForInstitutionalGates } from "./gate-adapter";
import { buildCompletedKnowledge } from "./knowledge";

export type EvidenceFirstShadowResult = {
  status: "PASSED_ALL_SHADOW_GATES" | "FAILED_CLOSED";
  terminalStage: string;
  failureReasons: string[];
  corpusId: string;
  topicId: string;
  title: string;
  generation: number;
  generationReleaseId: string;
  lineageVerified: true;
  scopeImmutable: true;
  scope: { scopeContractId: string; payloadHash: string; topicClass: string; chronologyStart: unknown; chronologyEnd: unknown; ongoingAsOf: string | null };
  research: { researchMapId: string; questionCount: number; requiredPhaseCount: number; requiredDimensionCount: number; sourceClassDistribution: Record<string, number>; authorityVerdictDistribution: Record<string, number> };
  conflicts: Array<{ conflictSetId: string; state: string; material: boolean; blocksPass: boolean }>;
  coverage: { initialCoverageAuditId: string; finalCoverageAuditId: string; completionRoundCount: 0 | 1 };
  completedKnowledgeSetId: string;
  completedKnowledgeSetHash: string;
  completionRoundCount: 0 | 1;
  sourceCount: number;
  evidenceSegmentCount: number;
  claimCount: number;
  conflictCount: number;
  candidateEventCount: number;
  rejectedNonEventCount: number;
  eligibleCandidateCount: number;
  selectedMilestoneCount: number;
  selection: { status: string; failureCodes: string[]; classDistribution: Record<string, number>; temporalDiagnostics: unknown[]; completenessFindings: unknown[]; redundancyDecisions: unknown[] };
  selectionArtifactId: string | null;
  eventLockId: string | null;
  eventLock: unknown | null;
  compositionId: string | null;
  product: GeneratedTimeline | null;
  timelineQuality: TimelineQualityAssessment | null;
  sourceAuthority: SourceAuthorityAssessment | null;
  reader: ReaderEditorialAssessment | null;
  metrics: {
    totalLatencyMs: number;
    acquisition: Awaited<ReturnType<typeof buildCompletedKnowledge>>["acquisitionMetrics"];
    selectionLatencyMs: number | null;
    selectionRepairCount: 0 | 1;
    selectionProviderCalls: number;
    compositionLatencyMs: number | null;
    compositionProviderCalls: number;
    readerProviderCalls: number;
    inputTokens: number | null;
    outputTokens: number | null;
    monetaryCost: null;
    costMeasurement: "NOT_MEASURABLE";
  };
  productionBoundary: { executionMode: "SHADOW"; governanceInvoked: false; institutionalWriteAllowed: false; publicWriteAllowed: false };
};

const noneCriteria = { turningPointValue: "NONE", causalImportance: "NONE", consequence: "NONE", institutionalImportance: "NONE", adoptionOrScale: "NONE", explanatoryValue: "NONE", topicRelevance: "NONE", historiographicalProminence: "NONE", relationshipToLaterDevelopments: "NONE", uniqueness: "NONE" } as const;

async function persistShadowResult(repository: V2FirestoreRepository, result: EvidenceFirstShadowResult): Promise<void> {
  const resultIdentity = { artifactType: "EVIDENCE_FIRST_SHADOW_SUBJECT_RESULT", schemaVersion: "evidence-first-shadow-result-v1", pipelineVersion: "evidence-first-generation-v1", corpusId: result.corpusId, topicId: result.topicId, generation: result.generation, generationReleaseId: result.generationReleaseId, executionMode: "SHADOW", publicationEligible: false, governanceSubmissionAllowed: false, immutable: true, result } as const;
  const artifactId = contentAddressedId("shadow-subject-result", resultIdentity);
  await repository.createImmutable("v2ShadowSubjectResults", attachPayloadHash({ artifactId, ...resultIdentity }));
}

export async function runEvidenceFirstShadowSubject(input: {
  descriptor: ShadowFixtureDescriptor;
  generationReleaseId: string;
  config: FactoryV2Config;
  repository?: V2FirestoreRepository;
  knowledgeProvider?: OrchestratorDependencies["provider"];
  retrieval?: OrchestratorDependencies["retrieval"];
  compositionProvider?: CompositionProvider;
  reader?: (title: string, plan: Parameters<typeof generateReaderEditorialReview>[1], timeline: Parameters<typeof generateReaderEditorialReview>[2]) => Promise<ReaderEditorialReviewResult>;
  deadlineAt: number;
}): Promise<EvidenceFirstShadowResult> {
  const startedAt = Date.now();
  const repository = input.repository || new V2FirestoreRepository();
  const knowledge = await buildCompletedKnowledge({ descriptor: input.descriptor, config: input.config, repository, provider: input.knowledgeProvider, retrieval: input.retrieval });
  const reconstructed = await reconstructCompletedKnowledgeSetForB1(repository, { topicId: knowledge.scope.topicId, completedKnowledgeSetId: knowledge.completedKnowledgeSet.completedKnowledgeSetId, expectedCompletedKnowledgeSetHash: knowledge.completedKnowledgeSet.payloadHash, expectedScopeContractId: knowledge.scope.scopeContractId, expectedFinalCoverageAuditId: knowledge.completedKnowledgeSet.finalCoverageAuditId });
  const context = {
    corpusId: knowledge.scope.corpusId,
    topicId: knowledge.scope.topicId,
    runId: `evidence-first-selection-${randomUUID()}`,
    generation: knowledge.scope.generation,
    createdAt: new Date().toISOString(),
    completedKnowledgeSetId: knowledge.completedKnowledgeSet.completedKnowledgeSetId,
    completedKnowledgeSetHash: knowledge.completedKnowledgeSet.payloadHash,
    finalCoverageAuditId: knowledge.completedKnowledgeSet.finalCoverageAuditId,
    finalCoverageAuditHash: knowledge.completedKnowledgeSet.finalCoverageAuditPayloadHash,
    candidateInputHash: reconstructed.candidateInputHash
  };
  const knowledgeInput = { context, scope: knowledge.scope, researchMap: knowledge.researchMap, events: knowledge.events, claims: knowledge.claims, authorityVerdicts: knowledge.authorityVerdicts, conflicts: knowledge.conflicts };
  const eligibility = evaluateCandidateEligibility(knowledgeInput);
  const eligibleEvents = knowledge.events.filter((event) => eligibility.get(event.eventVersionId)?.length === 0);
  const allowedClaimIds = new Set(eligibleEvents.flatMap((event) => [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds]));
  const selectionStartedAt = Date.now();
  const approvedClaims = knowledge.claims.filter((claim) => allowedClaimIds.has(claim.claimVersionId));
  const ineligibleJudgments: SignificanceProposal["judgments"] = knowledge.events.filter((event) => !eligibleEvents.includes(event)).map((event, index) => ({ eventVersionId: event.eventVersionId, significanceClass: "EXCLUDE", comparativeRank: eligibleEvents.length + index + 1, criteria: noneCriteria, rationale: `Deterministic preselection evidence eligibility excluded this candidate: ${eligibility.get(event.eventVersionId)?.join(", ") || "unknown eligibility failure"}.`, phaseCoverage: [], dimensionCoverage: [], redundantWithEventVersionIds: [], redundancyRationale: null }));
  let significance = await evaluateHistoricalSignificance({ context, scope: knowledge.scope, researchMap: knowledge.researchMap, eligibleEvents, approvedClaims, provider: input.knowledgeProvider, deadlineAt: Math.min(input.deadlineAt, Date.now() + 180_000) });
  const significanceExecutions = [significance.execution];
  const assemble = (selectionContext: typeof context) => assembleTimelineSelection({ ...knowledgeInput, context: selectionContext, significance: { ...significance.proposal, judgments: [...significance.proposal.judgments, ...ineligibleJudgments] }, modelExecutionRef: { executionId: significance.execution.executionId, model: significance.execution.modelExecutionRef?.model || "gemini-2.5-flash", location: significance.execution.modelExecutionRef?.location || "global", promptVersion: V2_B_PROMPT_VERSION, promptHash: significance.execution.promptHash, responseHash: significance.execution.responseHash } });
  let selection = assemble(context);
  await repository.createImmutable("v2ModelExecutions", significance.execution);
  await repository.createImmutable("v2RankedCandidateSets", selection);
  let selectionRepairCount: 0 | 1 = 0;
  if (selection.status !== "PASS") {
    const repairContext = { ...context, runId: `evidence-first-selection-repair-${randomUUID()}`, createdAt: new Date().toISOString() };
    significance = await evaluateHistoricalSignificance({ context: repairContext, scope: knowledge.scope, researchMap: knowledge.researchMap, eligibleEvents, approvedClaims, selectionFeedback: [...selection.failureCodes, ...selection.completenessFindings.filter((finding) => finding.blocking).map((finding) => finding.rationale)], provider: input.knowledgeProvider, deadlineAt: Math.min(input.deadlineAt, Date.now() + 180_000) });
    significanceExecutions.push(significance.execution);
    selection = assemble(repairContext);
    await repository.createImmutable("v2ModelExecutions", significance.execution);
    await repository.createImmutable("v2RankedCandidateSets", selection);
    selectionRepairCount = 1;
  }
  const selectionLatencyMs = Date.now() - selectionStartedAt;

  const baseMetrics = {
    totalLatencyMs: 0,
    acquisition: knowledge.acquisitionMetrics,
    selectionLatencyMs,
    selectionRepairCount,
    selectionProviderCalls: significanceExecutions.reduce((total, execution) => total + execution.transportAttempts, 0),
    compositionLatencyMs: null,
    compositionProviderCalls: 0,
    readerProviderCalls: 0,
    inputTokens: knowledge.acquisitionMetrics.reduce<number | null>((total, metric) => total === null || metric.inputTokens === null ? null : total + metric.inputTokens, 0),
    outputTokens: knowledge.acquisitionMetrics.reduce<number | null>((total, metric) => total === null || metric.outputTokens === null ? null : total + metric.outputTokens, 0),
    monetaryCost: null,
    costMeasurement: "NOT_MEASURABLE" as const
  };
  const base = {
    corpusId: knowledge.scope.corpusId,
    topicId: knowledge.scope.topicId,
    title: input.descriptor.title,
    generation: knowledge.scope.generation,
    generationReleaseId: input.generationReleaseId,
    lineageVerified: true as const,
    scopeImmutable: true as const,
    scope: { scopeContractId: knowledge.scope.scopeContractId, payloadHash: knowledge.scope.payloadHash, topicClass: knowledge.scope.topicClass, chronologyStart: knowledge.scope.chronologyStart, chronologyEnd: knowledge.scope.chronologyEnd, ongoingAsOf: knowledge.scope.ongoingAsOf },
    research: {
      researchMapId: knowledge.researchMap.researchMapId,
      questionCount: knowledge.researchMap.questions.length,
      requiredPhaseCount: knowledge.researchMap.phases.filter((phase) => phase.required).length,
      requiredDimensionCount: knowledge.researchMap.dimensions.filter((dimension) => dimension.required).length,
      sourceClassDistribution: Object.fromEntries([...new Set(knowledge.sourceDocuments.map((source) => source.sourceClass))].sort().map((sourceClass) => [sourceClass, knowledge.sourceDocuments.filter((source) => source.sourceClass === sourceClass).length])),
      authorityVerdictDistribution: Object.fromEntries([...new Set(knowledge.authorityVerdicts.map((verdict) => verdict.verdict))].sort().map((verdict) => [verdict, knowledge.authorityVerdicts.filter((item) => item.verdict === verdict).length]))
    },
    conflicts: knowledge.conflicts.map((conflict) => ({ conflictSetId: conflict.conflictSetId, state: conflict.state, material: conflict.material, blocksPass: conflict.blocksPass })),
    coverage: { initialCoverageAuditId: knowledge.initialCoverageAuditId, finalCoverageAuditId: knowledge.finalCoverageAuditId, completionRoundCount: knowledge.completionRoundCount },
    completedKnowledgeSetId: knowledge.completedKnowledgeSet.completedKnowledgeSetId,
    completedKnowledgeSetHash: knowledge.completedKnowledgeSet.payloadHash,
    completionRoundCount: knowledge.completionRoundCount,
    sourceCount: knowledge.sourceDocuments.length,
    evidenceSegmentCount: knowledge.evidenceSegments.length,
    claimCount: knowledge.claims.length,
    conflictCount: knowledge.conflicts.length,
    candidateEventCount: knowledge.events.length,
    rejectedNonEventCount: knowledge.events.filter((event) => event.semanticClass !== "EVENT").length,
    eligibleCandidateCount: eligibleEvents.length,
    selectedMilestoneCount: selection.selectedEventVersionIds.length,
    selection: { status: selection.status, failureCodes: selection.failureCodes, classDistribution: Object.fromEntries(["ESSENTIAL", "MAJOR", "SUPPORTING", "EXCLUDE"].map((value) => [value, selection.assessments.filter((assessment) => assessment.significanceClass === value).length])), temporalDiagnostics: selection.temporalDiagnostics, completenessFindings: selection.completenessFindings, redundancyDecisions: selection.redundancyDecisions },
    selectionArtifactId: selection.selectionArtifactId,
    eventLockId: null,
    eventLock: null,
    compositionId: null,
    product: null,
    timelineQuality: null,
    sourceAuthority: null,
    reader: null,
    productionBoundary: { executionMode: "SHADOW" as const, governanceInvoked: false as const, institutionalWriteAllowed: false as const, publicWriteAllowed: false as const }
  };
  if (selection.status !== "PASS") {
    const result: EvidenceFirstShadowResult = { ...base, status: "FAILED_CLOSED", terminalStage: "comparative_selection", failureReasons: selection.failureCodes, metrics: { ...baseMetrics, totalLatencyMs: Date.now() - startedAt } };
    await persistShadowResult(repository, result);
    return result;
  }

  const eventLock = buildEventLock({ corpusId: knowledge.scope.corpusId, topicId: knowledge.scope.topicId, generation: knowledge.scope.generation, generationReleaseId: input.generationReleaseId, scope: knowledge.scope, completedKnowledgeSet: knowledge.completedKnowledgeSet, selection, events: knowledge.events, claims: knowledge.claims, evidenceSegments: knowledge.evidenceSegments });
  await repository.createImmutable("v2EventLocks", eventLock);
  const compositionStartedAt = Date.now();
  const compositionResult = await composeFromEventLock({ eventLock, claims: knowledge.claims, evidenceSegments: knowledge.evidenceSegments, provider: input.compositionProvider, deadlineAt: input.deadlineAt });
  await repository.createImmutable("v2LockedCompositions", compositionResult.composition);
  const compositionLatencyMs = Date.now() - compositionStartedAt;
  const adapted = adaptEvidenceFirstForInstitutionalGates({ scope: knowledge.scope, researchMap: knowledge.researchMap, selection, eventLock, composition: compositionResult.composition, events: knowledge.events, claims: knowledge.claims, evidenceSegments: knowledge.evidenceSegments, sourceSnapshots: knowledge.sourceSnapshots, sourceDocuments: knowledge.sourceDocuments });
  const allowedSourceRefs = new Set(adapted.sources.map((source) => source.sourceId));
  const allowedEvidenceRefs = new Set(adapted.evidenceSegments.map((segment) => segment.evidenceRef));
  const planFailures = assessEditorialPlan({ plan: adapted.plan, allowedSourceRefs, allowedEvidenceRefs });
  const timelineQuality = assessTimelineQuality({ plan: adapted.plan, timeline: adapted.timeline, allowedSourceRefs, allowedEvidenceRefs });
  const sourceAuthority = assessSourceAuthority({ timeline: adapted.timeline, sources: adapted.sources, evidenceSegments: adapted.evidenceSegments });
  let reader: ReaderEditorialAssessment | null = null;
  let readerProviderCalls = 0;
  if (planFailures.length === 0 && timelineQuality.verdict === "passed" && sourceAuthority.overallVerdict === "passed") {
    const readerResult = await (input.reader || generateReaderEditorialReview)(input.descriptor.title, adapted.plan, adapted.timeline);
    readerProviderCalls = readerResult.providerCallCount;
    reader = assessReaderEditorialReview({ plan: adapted.plan, timeline: adapted.timeline, review: readerResult.review });
  }
  const failureReasons = [...planFailures, ...timelineQuality.unresolvedReasons, ...sourceAuthority.unresolvedSourceIssues, ...(reader?.unresolvedReasons || [])];
  const passed = failureReasons.length === 0 && reader?.verdict === "passed";
  const result: EvidenceFirstShadowResult = {
    ...base,
    status: passed ? "PASSED_ALL_SHADOW_GATES" : "FAILED_CLOSED",
    terminalStage: passed ? "shadow_complete" : reader ? "reader_assessment" : sourceAuthority.overallVerdict !== "passed" ? "source_authority" : "timeline_quality",
    failureReasons,
    eventLockId: eventLock.eventLockId,
    eventLock,
    compositionId: compositionResult.composition.compositionId,
    product: adapted.timeline,
    timelineQuality,
    sourceAuthority,
    reader,
    metrics: { ...baseMetrics, totalLatencyMs: Date.now() - startedAt, compositionLatencyMs, compositionProviderCalls: compositionResult.execution.transportAttempts, readerProviderCalls, inputTokens: baseMetrics.inputTokens === null || significanceExecutions.some((execution) => execution.usage.inputTokens === null) || compositionResult.execution.usage.inputTokens === null ? null : baseMetrics.inputTokens + significanceExecutions.reduce((total, execution) => total + execution.usage.inputTokens!, 0) + compositionResult.execution.usage.inputTokens, outputTokens: baseMetrics.outputTokens === null || significanceExecutions.some((execution) => execution.usage.outputTokens === null) || compositionResult.execution.usage.outputTokens === null ? null : baseMetrics.outputTokens + significanceExecutions.reduce((total, execution) => total + execution.usage.outputTokens!, 0) + compositionResult.execution.usage.outputTokens }
  };
  await persistShadowResult(repository, result);
  return result;
}
