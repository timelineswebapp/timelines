import {
  knowledgeCompletionPlanSchema,
  knowledgeCompletionResultSchema,
  knowledgeCoverageAuditSchema,
  researchMapSchema,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type KnowledgeCompletionPlan,
  type KnowledgeCompletionResult,
  type KnowledgeCompletionTask,
  type KnowledgeCoverageAudit,
  type KnowledgeCoverageCell,
  type KnowledgeCoverageGap,
  type ResearchMap,
  type ScopeContract,
  type SourceSnapshot
} from "./contracts";
import { executionArtifactId, immutableEnvelope, parseSealedArtifact, type ArtifactContext } from "./contracts/builders";
import { contentAddressedId } from "./hashing";

export const DEFAULT_COMPLETION_BUDGET = {
  maximumRounds: 1 as const,
  maximumGapQuestions: 5,
  maximumGroundingCalls: 5,
  maximumProviderQueries: 25,
  maximumSourceDocuments: 30,
  maximumClaimExtractions: 5,
  maximumAtomicClaims: 100,
  maximumWorkerSeconds: 480
};

/** Preserve one current candidate version per canonical identity after a
 * completion round. This is version selection, never destructive merging. */
export function mergeKnowledgeEventVersions(events: CanonicalEventVersion[]): CanonicalEventVersion[] {
  const byIdentity = new Map<string, CanonicalEventVersion>();
  for (const event of events) {
    const key = event.canonicalEventId || event.candidateEventId;
    const existing = byIdentity.get(key);
    if (!existing || event.version > existing.version || (event.version === existing.version && event.createdAt > existing.createdAt)) byIdentity.set(key, event);
  }
  return [...byIdentity.values()].sort((left, right) => left.eventVersionId.localeCompare(right.eventVersionId));
}

type CoverageInput = {
  context: ArtifactContext;
  stage: "INITIAL" | "FINAL";
  scope: ScopeContract;
  researchMap: ResearchMap;
  sourceKnowledgeRunIds: string[];
  claims: AtomicClaimVersion[];
  authorityVerdicts: ClaimAuthorityVerdict[];
  conflicts: ClaimConflictSet[];
  events: CanonicalEventVersion[];
  sourceSnapshots?: SourceSnapshot[];
};

function claimQuestionIds(claim: AtomicClaimVersion): string[] {
  return claim.qualifiers.filter((item) => item.key === "researchQuestionId").map((item) => item.value);
}

function eventYears(event: CanonicalEventVersion): { start: number; end: number } {
  const start = event.temporal.start.earliestYear ?? event.temporal.start.year;
  const endDate = event.temporal.end ?? event.temporal.start;
  return { start, end: endDate.latestYear ?? endDate.year };
}

function phaseYears(label: string, ongoingYear: number | null): { start: number; end: number } | null {
  const years = [...new Set([...label.matchAll(/(?<!\d)(-?\d{4})(?!\d)/gu)].map((match) => Number(match[1])))];
  if (years.length >= 1 && /present|current|ongoing/iu.test(label) && ongoingYear !== null) return { start: years[0]!, end: ongoingYear };
  if (years.length >= 2) return { start: Math.min(years[0]!, years[1]!), end: Math.max(years[0]!, years[1]!) };
  return null;
}

function intersects(left: { start: number; end: number }, right: { start: number; end: number }): boolean {
  return left.start <= right.end && right.start <= left.end;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function makeCell(input: Omit<KnowledgeCoverageCell, "cellId">): KnowledgeCoverageCell {
  const stable = { ...input, supportingClaimVersionIds: unique(input.supportingClaimVersionIds), chronologyEligibleEventVersionIds: unique(input.chronologyEligibleEventVersionIds), conflictSetIds: unique(input.conflictSetIds), reasonCodes: [...new Set(input.reasonCodes)] };
  return { cellId: contentAddressedId("coverage-cell", stable), ...stable };
}

function makeGap(input: Omit<KnowledgeCoverageGap, "gapId">): KnowledgeCoverageGap {
  const stable = { ...input, phaseIds: unique(input.phaseIds), dimensionIds: unique(input.dimensionIds), questionIds: unique(input.questionIds), existingSupportingClaimVersionIds: unique(input.existingSupportingClaimVersionIds) };
  return { gapId: contentAddressedId("coverage-gap", stable), ...stable };
}

export function auditKnowledgeCoverage(input: CoverageInput): KnowledgeCoverageAudit {
  const startedAt = Date.now();
  const supported = new Set(input.authorityVerdicts.filter((item) => item.verdict === "SUPPORTED" || item.verdict === "QUALIFIED").map((item) => item.claimVersionId));
  const claimsById = new Map(input.claims.map((claim) => [claim.claimVersionId, claim]));
  const questionsById = new Map(input.researchMap.questions.map((question) => [question.questionId, question]));
  const blockingConflicts = input.conflicts.filter((item) => item.blocksPass);
  const eligibleEvents = input.events.filter((event) => event.semanticClass === "EVENT" && event.canonicalizationState === "RESOLVED" && event.coreClaimVersionIds.some((id) => supported.has(id)));
  const eventQuestionIds = new Map(eligibleEvents.map((event) => [event.eventVersionId, unique([...event.coreClaimVersionIds, ...event.supportingClaimVersionIds].flatMap((id) => {
    const claim = claimsById.get(id);
    return claim ? claimQuestionIds(claim) : [];
  }))]));
  const ongoingYear = input.scope.ongoingAsOf ? Number(input.scope.ongoingAsOf.slice(0, 4)) : null;

  const phaseCells = input.researchMap.phases.map((phase) => {
    const temporal = phaseYears(`${phase.label} ${phase.temporalRule}`, ongoingYear);
    const questionIds = new Set(input.researchMap.questions.filter((question) => question.phaseIds.includes(phase.phaseId)).map((question) => question.questionId));
    const relevantClaims = input.claims.filter((claim) => claimQuestionIds(claim).some((id) => questionIds.has(id)) || (temporal !== null && claim.temporal !== null && intersects({ start: claim.temporal.start.earliestYear ?? claim.temporal.start.year, end: (claim.temporal.end?.latestYear ?? claim.temporal.end?.year) || claim.temporal.start.latestYear || claim.temporal.start.year }, temporal)));
    const supportingClaims = relevantClaims.filter((claim) => supported.has(claim.claimVersionId));
    const relevantEvents = eligibleEvents.filter((event) => (temporal !== null && intersects(eventYears(event), temporal)) || (eventQuestionIds.get(event.eventVersionId) || []).some((id) => questionIds.has(id)));
    const conflicts = blockingConflicts.filter((conflict) => conflict.claimVersionIds.some((id) => relevantClaims.some((claim) => claim.claimVersionId === id)));
    const state = !phase.required ? "NOT_APPLICABLE" : conflicts.length > 0 ? "BLOCKED" : relevantEvents.length > 0 ? "SUFFICIENT" : supportingClaims.length > 0 ? "WEAK" : relevantClaims.length > 0 ? "WEAK" : "MISSING";
    const reasonCodes: KnowledgeCoverageCell["reasonCodes"] = state === "NOT_APPLICABLE" ? ["LOCKED_CELL_NOT_REQUIRED"] : state === "BLOCKED" ? ["UNRESOLVED_MATERIAL_CONFLICT"] : state === "SUFFICIENT" ? ["AUTHORITATIVE_EVENT_KNOWLEDGE_PRESENT"] : supportingClaims.length > 0 ? ["SUPPORTED_NON_EVENT_KNOWLEDGE_ONLY"] : relevantClaims.length > 0 ? ["EXTRACTED_KNOWLEDGE_NOT_AUTHORITATIVE"] : ["NO_RELEVANT_KNOWLEDGE"];
    return makeCell({ kind: "PHASE", lockedRefId: phase.phaseId, label: phase.label, state, material: phase.required, supportingClaimVersionIds: supportingClaims.map((claim) => claim.claimVersionId), chronologyEligibleEventVersionIds: relevantEvents.map((event) => event.eventVersionId), conflictSetIds: conflicts.map((conflict) => conflict.conflictSetId), reasonCodes });
  });

  const dimensionCells = input.researchMap.dimensions.map((dimension) => {
    const questionIds = new Set(input.researchMap.questions.filter((question) => question.dimensionIds.includes(dimension.dimensionId)).map((question) => question.questionId));
    const relevantClaims = input.claims.filter((claim) => claimQuestionIds(claim).some((id) => questionIds.has(id)));
    const supportingClaims = relevantClaims.filter((claim) => supported.has(claim.claimVersionId));
    const relevantEvents = eligibleEvents.filter((event) => (eventQuestionIds.get(event.eventVersionId) || []).some((id) => questionIds.has(id)));
    const conflicts = blockingConflicts.filter((conflict) => conflict.claimVersionIds.some((id) => relevantClaims.some((claim) => claim.claimVersionId === id)));
    const state = !dimension.required ? "NOT_APPLICABLE" : conflicts.length > 0 ? "BLOCKED" : supportingClaims.length > 0 ? "SUFFICIENT" : relevantClaims.length > 0 ? "WEAK" : "MISSING";
    const reasonCodes: KnowledgeCoverageCell["reasonCodes"] = state === "NOT_APPLICABLE" ? ["LOCKED_CELL_NOT_REQUIRED"] : state === "BLOCKED" ? ["UNRESOLVED_MATERIAL_CONFLICT"] : state === "SUFFICIENT" ? [relevantEvents.length > 0 ? "AUTHORITATIVE_EVENT_KNOWLEDGE_PRESENT" : "SUPPORTED_NON_EVENT_KNOWLEDGE_ONLY"] : relevantClaims.length > 0 ? ["EXTRACTED_KNOWLEDGE_NOT_AUTHORITATIVE"] : ["NO_RELEVANT_KNOWLEDGE"];
    return makeCell({ kind: "DIMENSION", lockedRefId: dimension.dimensionId, label: dimension.label, state, material: dimension.required, supportingClaimVersionIds: supportingClaims.map((claim) => claim.claimVersionId), chronologyEligibleEventVersionIds: relevantEvents.map((event) => event.eventVersionId), conflictSetIds: conflicts.map((conflict) => conflict.conflictSetId), reasonCodes });
  });

  const phaseState = new Map(phaseCells.map((cell) => [cell.lockedRefId, cell.state]));
  const dimensionState = new Map(dimensionCells.map((cell) => [cell.lockedRefId, cell.state]));
  const questionCells = input.researchMap.questions.map((question) => {
    const relevantClaims = input.claims.filter((claim) => claimQuestionIds(claim).includes(question.questionId));
    const supportingClaims = relevantClaims.filter((claim) => supported.has(claim.claimVersionId));
    const relevantEvents = eligibleEvents.filter((event) => (eventQuestionIds.get(event.eventVersionId) || []).includes(question.questionId));
    const conflicts = blockingConflicts.filter((conflict) => conflict.claimVersionIds.some((id) => relevantClaims.some((claim) => claim.claimVersionId === id)));
    const underlyingGap = question.phaseIds.some((id) => phaseState.get(id) !== "SUFFICIENT") || question.dimensionIds.every((id) => dimensionState.get(id) !== "SUFFICIENT");
    const material = question.priority === "CRITICAL" && underlyingGap;
    const state = conflicts.length > 0 ? "BLOCKED" : supportingClaims.length > 0 ? "SUFFICIENT" : relevantClaims.length > 0 ? "WEAK" : "MISSING";
    const reasonCodes: KnowledgeCoverageCell["reasonCodes"] = state === "BLOCKED" ? ["UNRESOLVED_MATERIAL_CONFLICT"] : state === "SUFFICIENT" ? [relevantEvents.length > 0 ? "AUTHORITATIVE_EVENT_KNOWLEDGE_PRESENT" : "SUPPORTED_NON_EVENT_KNOWLEDGE_ONLY"] : state === "WEAK" ? ["EXTRACTED_KNOWLEDGE_NOT_AUTHORITATIVE"] : ["NO_RELEVANT_KNOWLEDGE"];
    return makeCell({ kind: "QUESTION", lockedRefId: question.questionId, label: question.text, state, material, supportingClaimVersionIds: supportingClaims.map((claim) => claim.claimVersionId), chronologyEligibleEventVersionIds: relevantEvents.map((event) => event.eventVersionId), conflictSetIds: conflicts.map((conflict) => conflict.conflictSetId), reasonCodes });
  });

  const cells = [...phaseCells, ...dimensionCells, ...questionCells];
  const gaps: KnowledgeCoverageGap[] = [];
  for (const cell of phaseCells.filter((item) => item.material && item.state !== "SUFFICIENT")) gaps.push(makeGap({ code: cell.state === "BLOCKED" ? "MATERIAL_CONFLICT_BLOCKS_COVERAGE" : cell.state === "MISSING" ? "MISSING_PHASE_KNOWLEDGE" : "WEAK_PHASE_KNOWLEDGE", phaseIds: [cell.lockedRefId], dimensionIds: [], questionIds: [], existingSupportingClaimVersionIds: cell.supportingClaimVersionIds, reason: `Locked required phase "${cell.label}" lacks sufficient authoritative chronology-eligible event knowledge.` }));
  for (const cell of dimensionCells.filter((item) => item.material && item.state !== "SUFFICIENT")) gaps.push(makeGap({ code: cell.state === "BLOCKED" ? "MATERIAL_CONFLICT_BLOCKS_COVERAGE" : cell.state === "MISSING" ? "MISSING_DIMENSION_KNOWLEDGE" : "WEAK_DIMENSION_KNOWLEDGE", phaseIds: [], dimensionIds: [cell.lockedRefId], questionIds: [], existingSupportingClaimVersionIds: cell.supportingClaimVersionIds, reason: `Locked required dimension "${cell.label}" lacks sufficient authoritative knowledge.` }));
  for (const cell of questionCells.filter((item) => item.material && item.state !== "SUFFICIENT")) {
    const question = questionsById.get(cell.lockedRefId)!;
    gaps.push(makeGap({ code: cell.state === "BLOCKED" ? "MATERIAL_CONFLICT_BLOCKS_COVERAGE" : "UNANSWERED_CRITICAL_RESEARCH_QUESTION", phaseIds: question.phaseIds, dimensionIds: question.dimensionIds, questionIds: [question.questionId], existingSupportingClaimVersionIds: cell.supportingClaimVersionIds, reason: `Critical locked Research Map question remains ${cell.state.toLowerCase()} while its material phase or dimension coverage is insufficient.` }));
  }
  const latestEventYear = eligibleEvents.length > 0 ? Math.max(...eligibleEvents.map((event) => eventYears(event).end)) : null;
  let ongoingFreshness: KnowledgeCoverageAudit["ongoingFreshness"] = "NOT_APPLICABLE";
  if (input.scope.topicClass === "ONGOING_SUBJECT") {
    const currentPhase = [...phaseCells].reverse().find((cell) => cell.material);
    ongoingFreshness = currentPhase?.state === "SUFFICIENT" ? "CURRENT_LOCKED_PHASE_REPRESENTED" : "STALE_LOCKED_PHASE";
    if (ongoingFreshness === "STALE_LOCKED_PHASE" && currentPhase) gaps.push(makeGap({ code: "STALE_ONGOING_SCOPE", phaseIds: [currentPhase.lockedRefId], dimensionIds: [], questionIds: [], existingSupportingClaimVersionIds: currentPhase.supportingClaimVersionIds, reason: `The latest locked ongoing phase "${currentPhase.label}" has no sufficient authoritative chronology event; staleness is derived from locked scope, not an arbitrary year threshold.` }));
  }
  if (eligibleEvents.length === 0) gaps.push(makeGap({ code: "MISSING_CHRONOLOGY", phaseIds: phaseCells.filter((cell) => cell.material).map((cell) => cell.lockedRefId), dimensionIds: [], questionIds: [], existingSupportingClaimVersionIds: [], reason: "No supported chronology-eligible event candidates exist inside the locked scope." }));
  const materialInsufficient = cells.some((cell) => cell.material && cell.state !== "SUFFICIENT") || ongoingFreshness === "STALE_LOCKED_PHASE";
  const auditPayload = {
    auditStage: input.stage,
    scopeContractId: input.scope.scopeContractId,
    scopePayloadHash: input.scope.payloadHash,
    researchMapId: input.researchMap.researchMapId,
    researchMapPayloadHash: input.researchMap.payloadHash,
    sourceKnowledgeRunIds: unique(input.sourceKnowledgeRunIds),
    candidateEventVersionIds: unique(input.events.map((event) => event.eventVersionId)),
    cells,
    gaps,
    latestChronologyEventYear: latestEventYear,
    latestDurableSourceSnapshotAt: input.sourceSnapshots && input.sourceSnapshots.length > 0 ? [...input.sourceSnapshots].sort((left, right) => right.retrievedAt.localeCompare(left.retrievedAt))[0]!.retrievedAt : null,
    ongoingFreshness,
    verdict: materialInsufficient ? "KNOWLEDGE_COVERAGE_INSUFFICIENT" as const : "SUFFICIENT" as const,
    auditMs: Date.now() - startedAt
  };
  const coverageAuditId = executionArtifactId("knowledge-coverage-audit", input.context, auditPayload);
  return parseSealedArtifact(knowledgeCoverageAuditSchema, {
    ...immutableEnvelope(input.context, coverageAuditId), artifactId: coverageAuditId, coverageAuditId, ...auditPayload
  });
}

export function planGapDirectedCompletion(input: { context: ArtifactContext; scope: ScopeContract; researchMap: ResearchMap; audit: KnowledgeCoverageAudit; originalKnowledgeRunId: string; budget?: typeof DEFAULT_COMPLETION_BUDGET }): KnowledgeCompletionPlan {
  if (input.audit.verdict === "SUFFICIENT") throw new Error("Coverage completion cannot run when the initial audit is already sufficient.");
  const budget = input.budget || DEFAULT_COMPLETION_BUDGET;
  const tasks: KnowledgeCompletionTask[] = [];
  const plannedGapIds = new Set<string>();
  const phaseGaps = input.audit.gaps.filter((gap) => ["MISSING_PHASE_KNOWLEDGE", "WEAK_PHASE_KNOWLEDGE", "STALE_ONGOING_SCOPE"].includes(gap.code));
  for (const phase of input.researchMap.phases) {
    if (tasks.length >= budget.maximumGapQuestions) break;
    const related = phaseGaps.filter((gap) => gap.phaseIds.includes(phase.phaseId));
    if (related.length === 0 || tasks.some((task) => task.phaseIds.includes(phase.phaseId))) continue;
    const relatedQuestions = input.researchMap.questions.filter((question) => question.phaseIds.includes(phase.phaseId));
    const relatedDimensionIds = unique(relatedQuestions.flatMap((question) => question.dimensionIds));
    const alreadyCoveredDimensionId = relatedDimensionIds.find((id) => input.audit.cells.some((cell) => cell.kind === "DIMENSION" && cell.lockedRefId === id && cell.state === "SUFFICIENT"));
    const dimensionIds = [alreadyCoveredDimensionId || relatedDimensionIds[0] || input.researchMap.dimensions[0]!.dimensionId];
    const questionIds = unique(relatedQuestions.map((question) => question.questionId));
    const question = `What authoritative dated evidence establishes material developments in the locked phase "${phase.label}" for "${input.scope.title}" within ${phase.temporalRule}?`;
    const taskBase = { gapIds: unique(related.flatMap((gap) => [gap.gapId, ...input.audit.gaps.filter((candidate) => candidate.code === "UNANSWERED_CRITICAL_RESEARCH_QUESTION" && candidate.phaseIds.includes(phase.phaseId)).map((candidate) => candidate.gapId)])), phaseIds: [phase.phaseId], dimensionIds, questionIds, question, providerQuery: `${input.scope.title} ${phase.label} authoritative dated chronology development history`, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, state: "PLANNED" as const };
    const questionId = contentAddressedId("coverage-question", taskBase);
    tasks.push({ taskId: contentAddressedId("coverage-task", { ...taskBase, questionId }), ...taskBase, questionId });
    taskBase.gapIds.forEach((id) => plannedGapIds.add(id));
  }
  for (const dimension of input.researchMap.dimensions) {
    if (tasks.length >= budget.maximumGapQuestions) break;
    const related = input.audit.gaps.filter((gap) => ["MISSING_DIMENSION_KNOWLEDGE", "WEAK_DIMENSION_KNOWLEDGE"].includes(gap.code) && gap.dimensionIds.includes(dimension.dimensionId));
    if (related.length === 0) continue;
    const relatedQuestions = input.researchMap.questions.filter((question) => question.dimensionIds.includes(dimension.dimensionId));
    const phaseIds = unique(relatedQuestions.flatMap((question) => question.phaseIds));
    const questionIds = unique(relatedQuestions.map((question) => question.questionId));
    const question = `What authoritative dated evidence establishes the locked dimension "${dimension.label}" across the scoped chronology of "${input.scope.title}"?`;
    const taskBase = { gapIds: unique(related.map((gap) => gap.gapId)), phaseIds, dimensionIds: [dimension.dimensionId], questionIds, question, providerQuery: `${input.scope.title} ${dimension.label} authoritative dated chronology development history`, intendedSourceClass: "SCHOLARLY_SECONDARY" as const, state: "PLANNED" as const };
    const questionId = contentAddressedId("coverage-question", taskBase);
    tasks.push({ taskId: contentAddressedId("coverage-task", { ...taskBase, questionId }), ...taskBase, questionId });
    taskBase.gapIds.forEach((id) => plannedGapIds.add(id));
  }
  if (tasks.length === 0) throw new Error("KNOWLEDGE_COVERAGE_INSUFFICIENT: no bounded completion task can be derived from locked gaps.");
  const planPayload = { parentCoverageAuditId: input.audit.coverageAuditId, originalScopeContractId: input.scope.scopeContractId, originalResearchMapId: input.researchMap.researchMapId, originalKnowledgeRunId: input.originalKnowledgeRunId, round: 1 as const, budget, tasks, unplannedMaterialGapIds: input.audit.gaps.filter((gap) => !plannedGapIds.has(gap.gapId)).map((gap) => gap.gapId) };
  const completionPlanId = executionArtifactId("knowledge-completion-plan", input.context, planPayload);
  return parseSealedArtifact(knowledgeCompletionPlanSchema, { ...immutableEnvelope(input.context, completionPlanId), artifactId: completionPlanId, completionPlanId, ...planPayload });
}

export type KnowledgeCompletionResultInput = Omit<KnowledgeCompletionResult, keyof ReturnType<typeof immutableEnvelope> | "artifactId" | "payloadHash" | "completionResultId">;

export function buildKnowledgeCompletionResult(context: ArtifactContext, payload: KnowledgeCompletionResultInput): KnowledgeCompletionResult {
  const completionResultId = executionArtifactId("knowledge-completion-result", context, payload);
  return parseSealedArtifact(knowledgeCompletionResultSchema, { ...immutableEnvelope(context, completionResultId), artifactId: completionResultId, completionResultId, ...payload });
}

export function buildCompletionResearchMap(input: { context: ArtifactContext; scope: ScopeContract; parent: ResearchMap; plan: KnowledgeCompletionPlan }): ResearchMap {
  const completionQuestions = input.plan.tasks.map((task) => ({
    questionId: task.questionId, text: task.question, phaseIds: task.phaseIds, dimensionIds: task.dimensionIds, claimTypesExpected: ["OCCURRENCE", "DATE"] as const,
    likelySourceClasses: [task.intendedSourceClass], expectedAuthorities: unique(input.parent.questions.filter((question) => question.phaseIds.some((id) => task.phaseIds.includes(id)) || question.dimensionIds.some((id) => task.dimensionIds.includes(id))).flatMap((question) => question.expectedAuthorities)).slice(0, 12).length > 0
      ? unique(input.parent.questions.filter((question) => question.phaseIds.some((id) => task.phaseIds.includes(id)) || question.dimensionIds.some((id) => task.dimensionIds.includes(id))).flatMap((question) => question.expectedAuthorities)).slice(0, 12)
      : ["Authoritative institutional or scholarly sources"],
    languages: [input.scope.language], geography: input.scope.spatialScope.included.slice(0, 12), contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const
  }));
  const payload = { version: input.parent.version + 1, phases: input.parent.phases, dimensions: input.parent.dimensions, entities: input.parent.entities, questions: [...input.parent.questions, ...completionQuestions], terminology: input.parent.terminology, knownUncertainty: input.parent.knownUncertainty };
  const researchMapId = contentAddressedId("research-map", { scopeContractId: input.scope.scopeContractId, scopePayloadHash: input.scope.payloadHash, parentArtifactId: input.parent.researchMapId, payload });
  return parseSealedArtifact(researchMapSchema, { ...immutableEnvelope(input.context, researchMapId), artifactId: researchMapId, parentArtifactId: input.parent.researchMapId, ...payload, researchMapId, scopeContractId: input.scope.scopeContractId, scopePayloadHash: input.scope.payloadHash });
}
