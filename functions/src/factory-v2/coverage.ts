import {
  gapObligationSchema,
  knowledgeCompletionPlanSchema,
  knowledgeCompletionResultSchema,
  knowledgeCoverageAuditSchema,
  researchMapSchema,
  V2_PIPELINE_VERSION,
  type AtomicClaimVersion,
  type CanonicalEventVersion,
  type ClaimAuthorityVerdict,
  type ClaimConflictSet,
  type CompletedKnowledgeSet,
  type GapObligation,
  type KnowledgeCompletionPlan,
  type KnowledgeCompletionResult,
  type KnowledgeCompletionTask,
  type KnowledgeCoverageAudit,
  type KnowledgeCoverageCell,
  type KnowledgeCoverageGap,
  type ResearchMap,
  type ScopeContract,
  type SourceDocument,
  type SourceSnapshot,
  type TopicAuthoritySet
} from "./contracts";
import { parseSealedArtifact, semanticArtifactId, semanticEnvelope, type ArtifactContext } from "./contracts/builders";
import { contentAddressedId } from "./hashing";

export const KNOWLEDGE_COVERAGE_POLICY_VERSION = "knowledge-coverage-v2-a3.11" as const;

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
    if (!existing || event.version > existing.version || (event.version === existing.version && event.eventVersionId > existing.eventVersionId)) byIdentity.set(key, event);
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
  sourceDocuments?: SourceDocument[];
  authoritySet?: TopicAuthoritySet;
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

function normalizedPerspective(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
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
  const claimsById = new Map(input.claims.map((claim) => [claim.claimVersionId, claim]));
  const claimWithinScope = (claim: AtomicClaimVersion) => {
    if (!claim.temporal || input.scope.topicClass !== "CLOSED_EPISODE" || !input.scope.chronologyEnd) return true;
    const start = claim.temporal.start.earliestYear ?? claim.temporal.start.year;
    const end = claim.temporal.end?.latestYear ?? claim.temporal.end?.year ?? claim.temporal.start.latestYear ?? claim.temporal.start.year;
    return start <= input.scope.chronologyEnd.year && end >= input.scope.chronologyStart.year;
  };
  const supported = new Set(input.authorityVerdicts.filter((item) => item.verdict === "SUPPORTED" || item.verdict === "QUALIFIED").map((item) => item.claimVersionId).filter((id) => {
    const claim = claimsById.get(id);
    return claim ? claimWithinScope(claim) : false;
  }));
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
    const relevantClaims = input.claims.filter((claim) => claimWithinScope(claim) && (claimQuestionIds(claim).some((id) => questionIds.has(id)) || (temporal !== null && claim.temporal !== null && intersects({ start: claim.temporal.start.earliestYear ?? claim.temporal.start.year, end: (claim.temporal.end?.latestYear ?? claim.temporal.end?.year) || claim.temporal.start.latestYear || claim.temporal.start.year }, temporal))));
    const supportingClaims = relevantClaims.filter((claim) => supported.has(claim.claimVersionId));
    const relevantEvents = eligibleEvents.filter((event) => (temporal !== null && intersects(eventYears(event), temporal)) || (eventQuestionIds.get(event.eventVersionId) || []).some((id) => questionIds.has(id)));
    const conflicts = blockingConflicts.filter((conflict) => conflict.claimVersionIds.some((id) => relevantClaims.some((claim) => claim.claimVersionId === id)));
    const state = !phase.required ? "NOT_APPLICABLE" : conflicts.length > 0 ? "BLOCKED" : relevantEvents.length > 0 ? "SUFFICIENT" : supportingClaims.length > 0 ? "WEAK" : relevantClaims.length > 0 ? "WEAK" : "MISSING";
    const reasonCodes: KnowledgeCoverageCell["reasonCodes"] = state === "NOT_APPLICABLE" ? ["LOCKED_CELL_NOT_REQUIRED"] : state === "BLOCKED" ? ["UNRESOLVED_MATERIAL_CONFLICT"] : state === "SUFFICIENT" ? ["AUTHORITATIVE_EVENT_KNOWLEDGE_PRESENT"] : supportingClaims.length > 0 ? ["SUPPORTED_NON_EVENT_KNOWLEDGE_ONLY"] : relevantClaims.length > 0 ? ["EXTRACTED_KNOWLEDGE_NOT_AUTHORITATIVE"] : ["NO_RELEVANT_KNOWLEDGE"];
    return makeCell({ kind: "PHASE", lockedRefId: phase.phaseId, label: phase.label, state, material: phase.required, supportingClaimVersionIds: supportingClaims.map((claim) => claim.claimVersionId), chronologyEligibleEventVersionIds: relevantEvents.map((event) => event.eventVersionId), conflictSetIds: conflicts.map((conflict) => conflict.conflictSetId), reasonCodes });
  });

  const dimensionCells = input.researchMap.dimensions.map((dimension) => {
    const questionIds = new Set(input.researchMap.questions.filter((question) => question.dimensionIds.includes(dimension.dimensionId)).map((question) => question.questionId));
    const relevantClaims = input.claims.filter((claim) => claimWithinScope(claim) && claimQuestionIds(claim).some((id) => questionIds.has(id)));
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
    const relevantClaims = input.claims.filter((claim) => claimWithinScope(claim) && claimQuestionIds(claim).includes(question.questionId));
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
  // Perspective adequacy is evidence-derived. A registered binding contributes
  // only after a source from that authority was actually snapshotted and
  // admitted into this audit; planned binding tags alone have no force here.
  if (input.authoritySet && input.sourceDocuments) {
    const acquiredPublisherIds = new Set(input.sourceDocuments.map((source) => source.publisherId).filter((id): id is string => id !== null));
    const evidentiaryBindings = input.authoritySet.bindings.filter((binding) => acquiredPublisherIds.has(binding.publisherId));
    for (const question of input.researchMap.questions) {
      const requirements = question.historicalPerspectiveRequirements || [];
      if (requirements.length === 0) continue;
      const questionBindings = evidentiaryBindings.filter((binding) => binding.researchQuestionIds.includes(question.questionId));
      for (const requirement of requirements) {
        const target = normalizedPerspective(requirement.label);
        const represented = requirement.kind === "STAKEHOLDER"
          // A stakeholder is an actor perspective, not a publisher identity.
          // Actual evidence from a governed records holder is still subject to
          // ordinary claim-level authority and self-interest admission.
          ? questionBindings.some((binding) => binding.roles.some((role) => role !== "ORIENTATION"))
          : requirement.kind === "INDEPENDENT_SCHOLARSHIP"
          ? questionBindings.some((binding) => binding.subjectRelationship === "INDEPENDENT" && (binding.authorityFamily === "ACADEMIC_SCHOLARLY" || binding.roles.includes("INTERPRETATION") || binding.roles.includes("CORROBORATION")))
          : questionBindings.some((binding) => [...binding.perspectiveTags, ...binding.geography].some((tag) => {
            const observed = normalizedPerspective(tag);
            return observed === target || observed.includes(target) || target.includes(observed);
          }));
        if (represented) continue;
        const matchingClaims = questionCells.find((cell) => cell.lockedRefId === question.questionId)?.supportingClaimVersionIds || [];
        gaps.push(makeGap({
          code: requirement.kind === "INDEPENDENT_SCHOLARSHIP" ? "MISSING_INDEPENDENT_SCHOLARSHIP" : "MISSING_HISTORICAL_PERSPECTIVE",
          phaseIds: question.phaseIds,
          dimensionIds: question.dimensionIds,
          questionIds: [question.questionId],
          existingSupportingClaimVersionIds: matchingClaims,
          reason: `Historically required ${requirement.kind} perspective "${requirement.label}" has no admitted evidence from a qualifying authority.`
        }));
      }
    }
  }
  const latestEventYear = eligibleEvents.length > 0 ? Math.max(...eligibleEvents.map((event) => eventYears(event).end)) : null;
  let ongoingFreshness: KnowledgeCoverageAudit["ongoingFreshness"] = "NOT_APPLICABLE";
  if (input.scope.topicClass === "ONGOING_SUBJECT") {
    const currentPhase = [...phaseCells].reverse().find((cell) => cell.material);
    ongoingFreshness = currentPhase?.state === "SUFFICIENT" ? "CURRENT_LOCKED_PHASE_REPRESENTED" : "STALE_LOCKED_PHASE";
    if (ongoingFreshness === "STALE_LOCKED_PHASE" && currentPhase) gaps.push(makeGap({ code: "STALE_ONGOING_SCOPE", phaseIds: [currentPhase.lockedRefId], dimensionIds: [], questionIds: [], existingSupportingClaimVersionIds: currentPhase.supportingClaimVersionIds, reason: `The latest locked ongoing phase "${currentPhase.label}" has no sufficient authoritative chronology event; staleness is derived from locked scope, not an arbitrary year threshold.` }));
  }
  if (eligibleEvents.length === 0) gaps.push(makeGap({ code: "MISSING_CHRONOLOGY", phaseIds: phaseCells.filter((cell) => cell.material).map((cell) => cell.lockedRefId), dimensionIds: [], questionIds: [], existingSupportingClaimVersionIds: [], reason: "No supported chronology-eligible event candidates exist inside the locked scope." }));
  const materialInsufficient = cells.some((cell) => cell.material && cell.state !== "SUFFICIENT") || gaps.length > 0 || ongoingFreshness === "STALE_LOCKED_PHASE";
  const auditPayload = {
    auditStage: input.stage,
    scopeContractId: input.scope.scopeContractId,
    scopePayloadHash: input.scope.payloadHash,
    researchMapId: input.researchMap.researchMapId,
    researchMapPayloadHash: input.researchMap.payloadHash,
    sourceKnowledgeRunIds: [],
    candidateEventVersionIds: unique(input.events.map((event) => event.eventVersionId)),
    cells,
    gaps,
    latestChronologyEventYear: latestEventYear,
    latestDurableSourceSnapshotAt: input.sourceSnapshots && input.sourceSnapshots.length > 0 ? [...input.sourceSnapshots].sort((left, right) => right.retrievedAt.localeCompare(left.retrievedAt))[0]!.retrievedAt : null,
    ongoingFreshness,
    verdict: materialInsufficient ? "KNOWLEDGE_COVERAGE_INSUFFICIENT" as const : "SUFFICIENT" as const,
    auditMs: null
  };
  void startedAt;
  const coverageAuditId = semanticArtifactId("knowledge-coverage-audit", input.context, auditPayload);
  return parseSealedArtifact(knowledgeCoverageAuditSchema, {
    ...semanticEnvelope(input.context, coverageAuditId, input.researchMap.researchMapId), artifactId: coverageAuditId, coverageAuditId, ...auditPayload
  });
}

/**
 * Seals only material, evidence-proven deficiencies.  This deliberately
 * consumes a completed initial audit; it cannot be used as predictive routing.
 */
export function buildGapObligations(input: {
  context: ArtifactContext;
  scope: ScopeContract;
  researchMap: ResearchMap;
  audit: KnowledgeCoverageAudit;
  authoritySet: TopicAuthoritySet;
  sourceSnapshots: readonly SourceSnapshot[];
}): GapObligation[] {
  if (input.audit.auditStage !== "INITIAL" || input.audit.verdict === "SUFFICIENT") return [];
  if (input.audit.scopeContractId !== input.scope.scopeContractId || input.audit.researchMapId !== input.researchMap.researchMapId) {
    throw new Error("GAP_OBLIGATION_AUDIT_LINEAGE_MISMATCH");
  }
  const context = { ...input.context, policyVersion: KNOWLEDGE_COVERAGE_POLICY_VERSION };
  return input.audit.gaps.map((gap) => {
    const questions = input.researchMap.questions.filter((question) => gap.questionIds.includes(question.questionId)
      || question.phaseIds.some((id) => gap.phaseIds.includes(id))
      || question.dimensionIds.some((id) => gap.dimensionIds.includes(id)));
    const questionIds = unique([...new Set([...gap.questionIds, ...questions.map((question) => question.questionId)])]);
    const historicalRequirements = questions.flatMap((question) => question.historicalPerspectiveRequirements || [])
      .map((requirement) => ({ kind: requirement.kind, label: requirement.label, rationale: requirement.rationale }))
      .sort((left, right) => `${left.kind}:${left.label}`.localeCompare(`${right.kind}:${right.label}`));
    const relevantBindings = input.authoritySet.bindings.filter((binding) => questionIds.length === 0 || binding.researchQuestionIds.some((id) => questionIds.includes(id)));
    const candidateBindings = relevantBindings.length > 0 ? relevantBindings : input.authoritySet.bindings;
    const perspectiveGap = historicalRequirements.length > 0;
    const conflictGap = gap.code === "MATERIAL_CONFLICT_BLOCKS_COVERAGE";
    const requiredRoles = perspectiveGap ? ["PERSPECTIVE_TESTIMONY", "INTERPRETATION"] as const : conflictGap ? ["CORROBORATION", "INTERPRETATION"] as const : ["PRIMARY_RECORD", "CORROBORATION"] as const;
    const permittedSubjectRelationships = historicalRequirements.some((requirement) => requirement.kind === "AFFECTED_COMMUNITY" || requirement.kind === "CUSTODIAL_COMMUNITY")
      ? ["COMMUNITY_CUSTODIAN", "PARTICIPANT", "INDEPENDENT"] as const
      : historicalRequirements.some((requirement) => requirement.kind === "PARTY_PARTICIPANT")
        ? ["STATE_PARTY", "PARTICIPANT", "INDEPENDENT"] as const
        : ["INDEPENDENT", "SUBJECT_SELF", "STATE_PARTY", "PARTICIPANT", "COMMUNITY_CUSTODIAN"] as const;
    const minimumIndependentGroups = conflictGap || historicalRequirements.some((requirement) => requirement.kind === "INDEPENDENT_SCHOLARSHIP") ? 2 : 0;
    const semantic = {
      scopeContractId: input.scope.scopeContractId,
      scopePayloadHash: input.scope.payloadHash,
      researchMapId: input.researchMap.researchMapId,
      researchMapPayloadHash: input.researchMap.payloadHash,
      parentCoverageAuditId: input.audit.coverageAuditId,
      coverageGapIds: [gap.gapId],
      questionIds,
      phaseIds: unique(gap.phaseIds),
      dimensionIds: unique(gap.dimensionIds),
      historicalRequirements,
      existingSupportingClaimVersionIds: unique(gap.existingSupportingClaimVersionIds),
      existingSourceSnapshotIds: unique(input.sourceSnapshots.map((snapshot) => snapshot.sourceSnapshotId)),
      deficiencyCode: gap.code,
      materialReason: gap.reason,
      requiredRoles: [...requiredRoles],
      permittedSubjectRelationships: [...permittedSubjectRelationships],
      minimumIndependentGroups,
      candidatePublisherVersionIds: unique(candidateBindings.map((binding) => binding.publisherVersionId)),
      specialistCollectionProfileIds: unique(candidateBindings.flatMap((binding) => binding.specialistCollectionProfiles.map((profile) => profile.profileId))),
      budget: DEFAULT_COMPLETION_BUDGET,
      state: "MATERIAL_EVIDENCE_GAP" as const
    };
    const gapObligationId = semanticArtifactId("gap-obligation", context, semantic);
    return parseSealedArtifact(gapObligationSchema, { ...semanticEnvelope(context, gapObligationId, input.audit.coverageAuditId), artifactId: gapObligationId, gapObligationId, ...semantic }) as GapObligation;
  }).sort((left, right) => left.gapObligationId.localeCompare(right.gapObligationId));
}

export function planGapDirectedCompletion(input: { context: ArtifactContext; scope: ScopeContract; researchMap: ResearchMap; audit: KnowledgeCoverageAudit; originalKnowledgeRunId: string; gapObligations?: readonly GapObligation[]; budget?: typeof DEFAULT_COMPLETION_BUDGET }): KnowledgeCompletionPlan {
  if (input.audit.verdict === "SUFFICIENT") throw new Error("Coverage completion cannot run when the initial audit is already sufficient.");
  const budget = input.budget || DEFAULT_COMPLETION_BUDGET;
  const gapObligationByCoverageGapId = new Map((input.gapObligations || []).flatMap((obligation) => obligation.coverageGapIds.map((gapId) => [gapId, obligation.gapObligationId] as const)));
  type Candidate = Omit<KnowledgeCompletionTask, "taskId" | "questionId"> & { stableKey: string; priorityRank: number };
  const candidates: Candidate[] = [];
  const phaseGaps = input.audit.gaps.filter((gap) => ["MISSING_PHASE_KNOWLEDGE", "WEAK_PHASE_KNOWLEDGE", "STALE_ONGOING_SCOPE"].includes(gap.code));
  const dimensionGaps = input.audit.gaps.filter((gap) => ["MISSING_DIMENSION_KNOWLEDGE", "WEAK_DIMENSION_KNOWLEDGE"].includes(gap.code));
  const unansweredGaps = input.audit.gaps.filter((gap) => gap.code === "UNANSWERED_CRITICAL_RESEARCH_QUESTION");
  const priorityRank = { CRITICAL: 0, IMPORTANT: 1, SUPPORTING: 2 } as const;
  const chronologyQuestion = input.researchMap.questions.find((question) => question.questionId.startsWith("software-chronology-question-"));
  // Chronology is a cross-cutting question.  It must not claim ownership of
  // every phase/dimension gap merely because it references them: doing so
  // makes the greedy planner believe the specific remediation tasks are
  // already planned and can leave all of those cells unresolved.
  const chronologyGapIds = input.audit.gaps.filter((gap) => chronologyQuestion && gap.code === "MISSING_CHRONOLOGY")
    .map((gap) => gap.gapId);
  const reservedChronologyCandidate: Candidate | null = chronologyQuestion && chronologyGapIds.length > 0 ? {
    stableKey: `chronology:${chronologyQuestion.questionId}`,
    priorityRank: -1,
    gapIds: unique(chronologyGapIds),
    phaseIds: chronologyQuestion.phaseIds,
    dimensionIds: chronologyQuestion.dimensionIds,
    questionIds: [chronologyQuestion.questionId],
    question: `For "${input.scope.title}": ${chronologyQuestion.text}`,
    intendedSourceClass: "PRIMARY_INSTITUTIONAL",
    state: "PLANNED"
  } : null;

  // Prefer precise locked questions that can close multiple audited gaps. The
  // software-wide chronology question is intentionally excluded here because
  // its all-phase/all-dimension shape would crowd out specific remediation.
  for (const question of input.researchMap.questions.filter((item) => !item.questionId.startsWith("software-chronology-question-"))) {
    const related = input.audit.gaps.filter((gap) =>
      gap.questionIds.includes(question.questionId)
      || gap.phaseIds.some((id) => question.phaseIds.includes(id))
      || gap.dimensionIds.some((id) => question.dimensionIds.includes(id))
    );
    if (related.length === 0) continue;
    const intendedSourceClass = question.likelySourceClasses.includes("PRIMARY_INSTITUTIONAL") ? "PRIMARY_INSTITUTIONAL" as const : "SCHOLARLY_SECONDARY" as const;
    candidates.push({ stableKey: `question:${question.questionId}`, priorityRank: priorityRank[question.priority], gapIds: unique(related.map((gap) => gap.gapId)), phaseIds: question.phaseIds, dimensionIds: question.dimensionIds, questionIds: [question.questionId], question: `For "${input.scope.title}": ${question.text}`, intendedSourceClass, state: "PLANNED" });
  }

  for (const phase of input.researchMap.phases) {
    const related = phaseGaps.filter((gap) => gap.phaseIds.includes(phase.phaseId));
    if (related.length === 0) continue;
    const relatedQuestions = input.researchMap.questions.filter((question) => question.phaseIds.includes(phase.phaseId));
    const relatedDimensionIds = unique(relatedQuestions.flatMap((question) => question.dimensionIds));
    const alreadyCoveredDimensionId = relatedDimensionIds.find((id) => input.audit.cells.some((cell) => cell.kind === "DIMENSION" && cell.lockedRefId === id && cell.state === "SUFFICIENT"));
    const dimensionIds = [alreadyCoveredDimensionId || relatedDimensionIds[0] || input.researchMap.dimensions[0]!.dimensionId];
    const questionIds = unique(relatedQuestions.map((question) => question.questionId));
    const question = `What authoritative dated evidence establishes material developments in the locked phase "${phase.label}" for "${input.scope.title}" within ${phase.temporalRule}?`;
    candidates.push({ stableKey: `phase:${phase.phaseId}`, priorityRank: 3, gapIds: unique([...related, ...unansweredGaps.filter((gap) => gap.phaseIds.includes(phase.phaseId))].map((gap) => gap.gapId)), phaseIds: [phase.phaseId], dimensionIds, questionIds, question, intendedSourceClass: "PRIMARY_INSTITUTIONAL", state: "PLANNED" });
  }
  for (const dimension of input.researchMap.dimensions) {
    const related = dimensionGaps.filter((gap) => gap.dimensionIds.includes(dimension.dimensionId));
    if (related.length === 0) continue;
    const relatedQuestions = input.researchMap.questions.filter((question) => question.dimensionIds.includes(dimension.dimensionId));
    const phaseIds = unique(relatedQuestions.flatMap((question) => question.phaseIds));
    const questionIds = unique(relatedQuestions.map((question) => question.questionId));
    const question = `What authoritative dated evidence establishes the locked dimension "${dimension.label}" across the scoped chronology of "${input.scope.title}"?`;
    candidates.push({ stableKey: `dimension:${dimension.dimensionId}`, priorityRank: 3, gapIds: unique([...related, ...unansweredGaps.filter((gap) => gap.dimensionIds.includes(dimension.dimensionId))].map((gap) => gap.gapId)), phaseIds, dimensionIds: [dimension.dimensionId], questionIds, question, intendedSourceClass: "SCHOLARLY_SECONDARY", state: "PLANNED" });
  }
  const tasks: KnowledgeCompletionTask[] = [];
  const plannedGapIds = new Set<string>();
  const remaining = [...candidates];
  const appendTask = (selected: Candidate) => {
    const { stableKey: _stableKey, priorityRank: _priorityRank, ...taskBase } = selected;
    const gapObligationIds = unique(taskBase.gapIds.flatMap((gapId) => {
      const obligationId = gapObligationByCoverageGapId.get(gapId);
      return obligationId ? [obligationId] : [];
    }));
    const questionId = contentAddressedId("coverage-question", taskBase);
    tasks.push({ taskId: contentAddressedId("coverage-task", { ...taskBase, gapObligationIds, questionId }), ...taskBase, gapObligationIds, questionId });
    taskBase.gapIds.forEach((id) => plannedGapIds.add(id));
  };
  if (reservedChronologyCandidate && tasks.length < budget.maximumGapQuestions) appendTask(reservedChronologyCandidate);
  while (tasks.length < budget.maximumGapQuestions && remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftGain = left.gapIds.filter((id) => !plannedGapIds.has(id)).length;
      const rightGain = right.gapIds.filter((id) => !plannedGapIds.has(id)).length;
      return rightGain - leftGain || left.priorityRank - right.priorityRank || left.stableKey.localeCompare(right.stableKey);
    });
    const selected = remaining.shift()!;
    if (selected.gapIds.every((id) => plannedGapIds.has(id))) break;
    appendTask(selected);
  }
  if (tasks.length === 0) throw new Error("KNOWLEDGE_COVERAGE_INSUFFICIENT: no bounded completion task can be derived from locked gaps.");
  const planPayload = { parentCoverageAuditId: input.audit.coverageAuditId, originalScopeContractId: input.scope.scopeContractId, originalResearchMapId: input.researchMap.researchMapId, originalKnowledgeRunId: null, round: 1 as const, budget, tasks, gapObligationIds: unique(tasks.flatMap((task) => task.gapObligationIds || [])), unplannedMaterialGapIds: input.audit.gaps.filter((gap) => !plannedGapIds.has(gap.gapId)).map((gap) => gap.gapId) };
  const completionPlanId = semanticArtifactId("knowledge-completion-plan", input.context, planPayload);
  return parseSealedArtifact(knowledgeCompletionPlanSchema, { ...semanticEnvelope(input.context, completionPlanId, input.audit.coverageAuditId), artifactId: completionPlanId, completionPlanId, ...planPayload });
}

export function sealNoCompletionRequired(input: { context: ArtifactContext; scope: ScopeContract; researchMap: ResearchMap; audit: KnowledgeCoverageAudit }): KnowledgeCompletionPlan {
  if (input.audit.verdict !== "SUFFICIENT" || input.audit.auditStage !== "INITIAL") throw new Error("NO_COMPLETION_REQUIRES_SUFFICIENT_INITIAL_AUDIT");
  if (input.audit.scopeContractId !== input.scope.scopeContractId || input.audit.researchMapId !== input.researchMap.researchMapId) throw new Error("NO_COMPLETION_LINEAGE_MISMATCH");
  const planPayload = { parentCoverageAuditId: input.audit.coverageAuditId, originalScopeContractId: input.scope.scopeContractId, originalResearchMapId: input.researchMap.researchMapId, originalKnowledgeRunId: null, round: 0 as const, budget: DEFAULT_COMPLETION_BUDGET, tasks: [], gapObligationIds: [], unplannedMaterialGapIds: [] };
  const completionPlanId = semanticArtifactId("knowledge-completion-plan", input.context, planPayload);
  return parseSealedArtifact(knowledgeCompletionPlanSchema, { ...semanticEnvelope(input.context, completionPlanId, input.audit.coverageAuditId), artifactId: completionPlanId, completionPlanId, ...planPayload });
}

export type KnowledgeCompletionResultInput = Omit<CompletedKnowledgeSet, keyof ReturnType<typeof semanticEnvelope> | "artifactId" | "payloadHash" | "completionResultId" | "completedKnowledgeSetId" | "knowledgePipelineVersion" | "candidateEventVersionIds" | "candidateClaimVersionIds" | "authorityVerdictIds" | "conflictSetIds" | "unresolvedGapIds"> & {
  candidateEventVersionIds: readonly string[];
  candidateClaimVersionIds: readonly string[];
  authorityVerdictIds: readonly string[];
  conflictSetIds: readonly string[];
  unresolvedGapIds: readonly string[];
};

export function buildKnowledgeCompletionResult(context: ArtifactContext, payload: KnowledgeCompletionResultInput): CompletedKnowledgeSet {
  const semanticPayload = {
    ...payload,
    knowledgePipelineVersion: V2_PIPELINE_VERSION,
    authorityAcquisitionRounds: [...payload.authorityAcquisitionRounds].sort((left, right) => left.controlledResearchLedgerId.localeCompare(right.controlledResearchLedgerId)),
    candidateEventVersionIds: unique([...payload.candidateEventVersionIds]),
    candidateClaimVersionIds: unique([...payload.candidateClaimVersionIds]),
    authorityVerdictIds: unique([...payload.authorityVerdictIds]),
    conflictSetIds: unique([...payload.conflictSetIds]),
    unresolvedGapIds: unique([...payload.unresolvedGapIds]),
    gapObligationIds: unique([...(payload.gapObligationIds || [])])
  };
  const completedKnowledgeSetId = semanticArtifactId("completed-knowledge-set", context, semanticPayload, { schemaVersion: "factory-v2-a.7" });
  return parseSealedArtifact(knowledgeCompletionResultSchema, {
    ...semanticEnvelope(context, completedKnowledgeSetId, payload.completionPlanId),
    schemaVersion: "factory-v2-a.7",
    artifactId: completedKnowledgeSetId,
    completionResultId: completedKnowledgeSetId,
    completedKnowledgeSetId,
    ...semanticPayload
  }) as CompletedKnowledgeSet;
}

export function expectedCompletedKnowledgeSetId(set: CompletedKnowledgeSet): string {
  const {
    artifactId: _artifactId, schemaVersion, policyVersion, promptVersion: _promptVersion, modelExecutionRef: _modelExecutionRef,
    parentArtifactId: _parentArtifactId, payloadHash: _payloadHash, createdAt: _createdAt, corpusId, topicId, runId: _runId,
    generation, executionMode: _executionMode, publicationEligible: _publicationEligible,
    governanceSubmissionAllowed: _governanceSubmissionAllowed, immutable: _immutable,
    completionResultId: _completionResultId, completedKnowledgeSetId: _completedKnowledgeSetId, ...semanticPayload
  } = set;
  return semanticArtifactId("completed-knowledge-set", { corpusId, topicId, generation, policyVersion, runId: "semantic-validation", createdAt: "1970-01-01T00:00:00.000Z" }, semanticPayload, { schemaVersion });
}

export function buildCompletionResearchMap(input: { context: ArtifactContext; scope: ScopeContract; parent: ResearchMap; plan: KnowledgeCompletionPlan }): ResearchMap {
  // Completion must target the original locked questions. Adding synthetic
  // questions leaves their unresolved parents in the final map, where they
  // remain unanswered even when the completion evidence is sound.
  const targetedQuestionIds = new Set(input.plan.tasks.flatMap((task) => task.questionIds));
  const questions = input.parent.questions.map((question) => targetedQuestionIds.has(question.questionId)
    ? { ...question, priority: "CRITICAL" as const, state: "UNRESEARCHED" as const }
    : question);
  const payload = { version: input.parent.version + 1, phases: input.parent.phases, dimensions: input.parent.dimensions, entities: input.parent.entities, questions, terminology: input.parent.terminology, knownUncertainty: input.parent.knownUncertainty };
  const researchMapId = semanticArtifactId("research-map", input.context, { scopeContractId: input.scope.scopeContractId, scopePayloadHash: input.scope.payloadHash, parentArtifactId: input.parent.researchMapId, payload });
  return parseSealedArtifact(researchMapSchema, { ...semanticEnvelope(input.context, researchMapId, input.parent.researchMapId), artifactId: researchMapId, ...payload, researchMapId, scopeContractId: input.scope.scopeContractId, scopePayloadHash: input.scope.payloadHash });
}
