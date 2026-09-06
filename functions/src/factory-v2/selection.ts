import { historicalDateSchema, type AtomicClaimVersion, type CanonicalEventVersion, type ClaimAuthorityVerdict, type ClaimConflictSet, type ResearchMap, type ScopeContract } from "./contracts";
import { selectionArtifactSchema, significanceProposalSchema, V2_B_PIPELINE_VERSION, V2_B_PROMPT_VERSION, V2_B_SCHEMA_VERSION, V2_B_SELECTION_POLICY_VERSION, type SelectionArtifact, type SignificanceProposal } from "./contracts/assembly";
import { attachPayloadHash, contentAddressedId } from "./hashing";
import { eventWithinLockedScope } from "./resolution";

export type SelectionContext = Readonly<{
  corpusId: string;
  topicId: string;
  runId: string;
  generation: number;
  createdAt: string;
  completedKnowledgeSetId: string;
  completedKnowledgeSetHash: string;
  finalCoverageAuditId: string;
  finalCoverageAuditHash: string;
  candidateInputHash: string;
}>;

export type SelectionInput = Readonly<{
  context: SelectionContext;
  scope: ScopeContract;
  researchMap: ResearchMap;
  events: readonly CanonicalEventVersion[];
  claims: readonly AtomicClaimVersion[];
  authorityVerdicts: readonly ClaimAuthorityVerdict[];
  conflicts: readonly ClaimConflictSet[];
  significance: SignificanceProposal;
  modelExecutionRef: SelectionArtifact["modelExecutionRef"];
  selectionPolicyVersion?: string;
}>;

export type SelectionKnowledgeInput = Omit<SelectionInput, "significance" | "modelExecutionRef">;

type Reason = SelectionArtifact["assessments"][number]["eligibilityReasons"][number];
type Judgment = SignificanceProposal["judgments"][number];

const classRank = { ESSENTIAL: 0, MAJOR: 1, SUPPORTING: 2, EXCLUDE: 3 } as const;

function dateInterval(date: CanonicalEventVersion["temporal"]["start"]): [number, number] {
  historicalDateSchema.parse(date);
  const lowerYear = date.earliestYear ?? date.year;
  const upperYear = date.latestYear ?? date.year;
  const lowerMonth = date.precision === "DAY" || date.precision === "MONTH" ? date.month! : 1;
  const upperMonth = date.precision === "DAY" || date.precision === "MONTH" ? date.month! : 12;
  const lowerDay = date.precision === "DAY" ? date.day! : 1;
  const upperDay = date.precision === "DAY" ? date.day! : 31;
  return [lowerYear * 10_000 + lowerMonth * 100 + lowerDay, upperYear * 10_000 + upperMonth * 100 + upperDay];
}

function temporalIntervalsOverlap(left: CanonicalEventVersion, right: CanonicalEventVersion): boolean {
  const [leftStart, leftStartEnd] = dateInterval(left.temporal.start);
  const [rightStart, rightStartEnd] = dateInterval(right.temporal.start);
  const leftEnd = left.temporal.end ? dateInterval(left.temporal.end)[1] : leftStartEnd;
  const rightEnd = right.temporal.end ? dateInterval(right.temporal.end)[1] : rightStartEnd;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && [...left].sort().every((value, index) => value === [...right].sort()[index]);
}

function redundancyRelationship(left: CanonicalEventVersion, right: CanonicalEventVersion): "IDENTICAL" | "SAME_EVENT_DIFFERENT_GRANULARITY" | null {
  if (left.eventIdentityKey === right.eventIdentityKey) return "IDENTICAL";
  if (
    left.actionKey === right.actionKey &&
    sameSet(left.primaryEntityKeys, right.primaryEntityKeys) &&
    sameSet(left.locationKeys, right.locationKeys) &&
    temporalIntervalsOverlap(left, right)
  ) return "SAME_EVENT_DIFFERENT_GRANULARITY";
  return null;
}

function eligibilityReasons(input: SelectionKnowledgeInput, event: CanonicalEventVersion, claims: Map<string, AtomicClaimVersion>, verdicts: Map<string, ClaimAuthorityVerdict>): Reason[] {
  const reasons: Reason[] = [];
  if (event.semanticClass !== "EVENT" || event.canonicalizationState !== "RESOLVED") reasons.push("SEMANTIC_TYPE_INELIGIBLE");
  if (!eventWithinLockedScope(input.scope, event)) reasons.push("SCOPE_INCOMPATIBLE");
  try {
    historicalDateSchema.parse(event.temporal.start);
  } catch {
    reasons.push("TEMPORAL_ANCHOR_INSUFFICIENT");
  }
  if (event.temporal.start.precision === "DAY" && (event.temporal.start.month === null || event.temporal.start.day === null)) reasons.push("FABRICATED_PRECISION");
  if (!event.candidateEventId || !event.eventIdentityKey || event.primaryEntityKeys.length === 0) reasons.push("CANDIDATE_IDENTITY_INVALID");
  const coreClaims = event.coreClaimVersionIds.map((id) => claims.get(id));
  if (coreClaims.some((claim) => !claim || !["SUPPORTED", "QUALIFIED", "STRUCTURALLY_VALID"].includes(claim.validationState))) reasons.push("CORE_CLAIM_UNSUPPORTED");
  if (event.coreClaimVersionIds.some((id) => !["SUPPORTED", "QUALIFIED"].includes(verdicts.get(id)?.verdict || ""))) reasons.push("SOURCE_AUTHORITY_BURDEN_FAILED");
  if (input.conflicts.some((conflict) => conflict.blocksPass && conflict.claimVersionIds.some((id) => event.coreClaimVersionIds.includes(id)))) reasons.push("BLOCKING_MATERIAL_CONFLICT");
  return [...new Set(reasons)];
}

export function evaluateCandidateEligibility(input: SelectionKnowledgeInput): Map<string, Reason[]> {
  const claims = new Map(input.claims.map((claim) => [claim.claimVersionId, claim]));
  const verdicts = new Map(input.authorityVerdicts.map((verdict) => [verdict.claimVersionId, verdict]));
  return new Map(input.events.map((event) => [event.eventVersionId, eligibilityReasons(input, event, claims, verdicts)]));
}

function parsedPhaseYears(label: string, ongoingAsOf: string | null): [number, number] | null {
  const years = [...label.matchAll(/\b(\d{4})\b/gu)].map((match) => Number(match[1]));
  if (years.length >= 2) return [Math.min(years[0]!, years[1]!), Math.max(years[0]!, years[1]!)];
  if (years.length === 1 && /present/iu.test(label) && ongoingAsOf) return [years[0]!, Number(ongoingAsOf.slice(0, 4))];
  return null;
}

export function eventCompatibleWithPhase(scope: ScopeContract, event: CanonicalEventVersion, phaseLabel: string): boolean {
  const phase = parsedPhaseYears(phaseLabel, scope.ongoingAsOf);
  if (!phase) return true;
  const eventStart = event.temporal.start.earliestYear ?? event.temporal.start.year;
  const eventEnd = event.temporal.end?.latestYear ?? event.temporal.end?.year ?? event.temporal.start.latestYear ?? event.temporal.start.year;
  return eventStart <= phase[1] && phase[0] <= eventEnd;
}

function judgmentComparator(a: Judgment, b: Judgment): number {
  return classRank[a.significanceClass] - classRank[b.significanceClass]
    || a.comparativeRank - b.comparativeRank
    || a.eventVersionId.localeCompare(b.eventVersionId);
}

function chronologyComparator(events: Map<string, CanonicalEventVersion>, inputOrdinals: Map<string, number>) {
  return (leftId: string, rightId: string): number => {
    const left = events.get(leftId)!;
    const right = events.get(rightId)!;
    const [leftStart, leftEnd] = dateInterval(left.temporal.start);
    const [rightStart, rightEnd] = dateInterval(right.temporal.start);
    if (leftEnd < rightStart) return -1;
    if (rightEnd < leftStart) return 1;
    return inputOrdinals.get(leftId)! - inputOrdinals.get(rightId)! || leftId.localeCompare(rightId);
  };
}

function temporalDiagnostics(scope: ScopeContract, selected: CanonicalEventVersion[]) {
  if (selected.length === 0) return [];
  const ordered = [...selected].sort((a, b) => dateInterval(a.temporal.start)[0] - dateInterval(b.temporal.start)[0]);
  const firstYear = ordered[0]!.temporal.start.year;
  const lastYear = ordered.at(-1)!.temporal.start.year;
  const diagnostics: SelectionArtifact["temporalDiagnostics"] = [];
  if (scope.topicClass === "ONGOING_SUBJECT" && scope.ongoingAsOf) {
    const asOfYear = Number(scope.ongoingAsOf.slice(0, 4));
    if (asOfYear - lastYear > 5) diagnostics.push({ code: "ONGOING_TOPIC_STALENESS", blocking: true, rationale: `The latest selected event is from ${lastYear}, more than five years before the locked ongoing-as-of year ${asOfYear}.`, eventVersionIds: ordered.map((event) => event.eventVersionId) });
    const span = Math.max(1, asOfYear - scope.chronologyStart.year);
    const earlyCutoff = scope.chronologyStart.year + Math.floor(span / 3);
    const early = ordered.filter((event) => event.temporal.start.year <= earlyCutoff);
    if (early.length / ordered.length >= 0.7) diagnostics.push({ code: "EXTREME_EARLY_CONCENTRATION", blocking: true, rationale: `${early.length} of ${ordered.length} selected events fall in the first third of the locked ongoing chronology; this is an editorial warning, not an equal-time quota.`, eventVersionIds: early.map((event) => event.eventVersionId) });
  }
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const current = ordered[index]!;
    const gap = current.temporal.start.year - previous.temporal.start.year;
    if (gap >= 10) diagnostics.push({ code: "LARGE_UNCOVERED_INTERVAL", blocking: false, rationale: `A ${gap}-year interval separates ${previous.eventVersionId} and ${current.eventVersionId}; no equal-time filling is implied.`, eventVersionIds: [previous.eventVersionId, current.eventVersionId] });
  }
  if (scope.topicClass === "CLOSED_EPISODE" && scope.chronologyEnd && (firstYear < scope.chronologyStart.year || lastYear > scope.chronologyEnd.year)) diagnostics.push({ code: "CLOSED_EPISODE_BOUNDARY_DRIFT", blocking: true, rationale: "Selected chronology extends beyond the locked closed-episode boundary.", eventVersionIds: ordered.map((event) => event.eventVersionId) });
  return diagnostics;
}

export function assembleTimelineSelection(rawInput: SelectionInput): SelectionArtifact {
  const input = { ...rawInput, significance: significanceProposalSchema.parse(rawInput.significance) };
  if (input.events.length < 1 || input.events.length > 200) throw new Error("Selection requires a complete bounded pool of 1-200 V2-A candidates.");
  const eventIds = input.events.map((event) => event.eventVersionId);
  if (new Set(eventIds).size !== eventIds.length) throw new Error("Selection candidate pool contains duplicate event-version IDs.");
  const judgments = new Map(input.significance.judgments.map((judgment) => [judgment.eventVersionId, judgment]));
  if (judgments.size !== input.events.length || eventIds.some((id) => !judgments.has(id)) || [...judgments.keys()].some((id) => !eventIds.includes(id))) throw new Error("Significance evaluation must cover exactly the complete candidate pool.");
  const phaseIds = new Set(input.researchMap.phases.map((phase) => phase.phaseId));
  const dimensionIds = new Set(input.researchMap.dimensions.map((dimension) => dimension.dimensionId));
  for (const judgment of judgments.values()) {
    if (judgment.phaseCoverage.some((cell) => !phaseIds.has(cell.phaseId)) || judgment.dimensionCoverage.some((cell) => !dimensionIds.has(cell.dimensionId))) throw new Error("Significance evaluation references a phase or dimension outside the locked Research Map.");
    const event = input.events.find((candidate) => candidate.eventVersionId === judgment.eventVersionId)!;
    for (const cell of judgment.phaseCoverage.filter((item) => item.relation !== "NONE")) {
      const phase = input.researchMap.phases.find((item) => item.phaseId === cell.phaseId)!;
      if (!eventCompatibleWithPhase(input.scope, event, phase.label)) throw new Error(`Significance evaluation maps ${event.eventVersionId} outside the temporal rule for ${phase.phaseId}.`);
    }
  }

  const events = new Map(input.events.map((event) => [event.eventVersionId, event]));
  const inputOrdinals = new Map(eventIds.map((id, index) => [id, index]));
  const reasons = evaluateCandidateEligibility(input);
  const eligibleJudgments = input.significance.judgments.filter((judgment) => reasons.get(judgment.eventVersionId)!.length === 0 && judgment.significanceClass !== "EXCLUDE").sort(judgmentComparator);

  const redundant = new Map<string, { kept: string; relationship: "IDENTICAL" | "SAME_EVENT_DIFFERENT_GRANULARITY"; rationale: string }>();
  const redundancyDecisions: SelectionArtifact["redundancyDecisions"] = [];
  for (const judgment of eligibleJudgments) {
    if (redundant.has(judgment.eventVersionId)) continue;
    for (const otherId of judgment.redundantWithEventVersionIds) {
      const otherJudgment = judgments.get(otherId);
      if (!otherJudgment || reasons.get(otherId)?.length || redundant.has(otherId)) continue;
      const relationship = redundancyRelationship(events.get(judgment.eventVersionId)!, events.get(otherId)!);
      if (!relationship) continue;
      const orderedPair = [judgment, otherJudgment].sort(judgmentComparator);
      const kept = orderedPair[0]!;
      const excluded = orderedPair[1]!;
      if (kept.eventVersionId === excluded.eventVersionId) continue;
      redundant.set(excluded.eventVersionId, { kept: kept.eventVersionId, relationship, rationale: excluded.redundancyRationale || `The stronger candidate preserves the same verified occurrence at the locked granularity.` });
      redundancyDecisions.push({ keptEventVersionId: kept.eventVersionId, excludedEventVersionId: excluded.eventVersionId, relationship, deterministicEvidence: relationship === "IDENTICAL" ? ["matching eventIdentityKey"] : ["matching actionKey", "matching primary entities", "compatible temporal intervals"], rationale: excluded.redundancyRationale || `The kept candidate is comparatively stronger and represents the same verified occurrence.` });
    }
  }

  const available = eligibleJudgments.filter((judgment) => !redundant.has(judgment.eventVersionId));
  const selected = new Set<string>();
  const essentialJudgments = available.filter((item) => item.significanceClass === "ESSENTIAL");
  for (const judgment of essentialJudgments.slice(0, 20)) selected.add(judgment.eventVersionId);
  const failures = new Set<SelectionArtifact["failureCodes"][number]>();
  if (essentialJudgments.length > 20) failures.add("EVENT_LIMIT_UNSATISFIABLE");
  if (available.length === 0) failures.add("NO_ELIGIBLE_CANDIDATES");

  const addCoverageCandidate = (kind: "phase" | "dimension", requiredId: string) => {
    const candidate = available.find((judgment) => {
      if (kind === "phase") return judgment.phaseCoverage.some((cell) => cell.phaseId === requiredId && cell.relation === "PRIMARY");
      return judgment.dimensionCoverage.some((cell) => cell.dimensionId === requiredId && cell.relation === "PRIMARY");
    });
    if (candidate && selected.size < 20) selected.add(candidate.eventVersionId);
  };
  for (const phase of input.researchMap.phases.filter((phase) => phase.required)) addCoverageCandidate("phase", phase.phaseId);
  for (const dimension of input.researchMap.dimensions.filter((dimension) => dimension.required)) addCoverageCandidate("dimension", dimension.dimensionId);

  const minimum = input.scope.granularity === "OVERVIEW" ? 6 : 10;
  const allowedMinimum = minimum;
  const desiredCount = Math.min(20, Math.max(allowedMinimum, Math.min(available.length, minimum)));
  for (const judgment of available) {
    if (selected.size >= desiredCount) break;
    selected.add(judgment.eventVersionId);
  }

  const requiredPhases = input.researchMap.phases.filter((phase) => phase.required).map((phase) => phase.phaseId);
  const requiredDimensions = input.researchMap.dimensions.filter((dimension) => dimension.required).map((dimension) => dimension.dimensionId);
  const covers = (kind: "phase" | "dimension", id: string) => [...selected].some((eventId) => {
    const judgment = judgments.get(eventId)!;
    if (kind === "phase") return judgment.phaseCoverage.some((cell) => cell.phaseId === id && cell.relation === "PRIMARY");
    return judgment.dimensionCoverage.some((cell) => cell.dimensionId === id && cell.relation === "PRIMARY");
  });
  const coveredPhases = requiredPhases.filter((id) => covers("phase", id));
  const coveredDimensions = requiredDimensions.filter((id) => covers("dimension", id));
  const missingPhases = requiredPhases.filter((id) => !coveredPhases.includes(id));
  const missingDimensions = requiredDimensions.filter((id) => !coveredDimensions.includes(id));
  if (missingPhases.length || missingDimensions.length) failures.add("COVERAGE_GAP_MATERIAL");
  if (selected.size < 6) failures.add("EVENT_COUNT_BELOW_MINIMUM");

  const completenessFindings: SignificanceProposal["completenessFindings"] = [...input.significance.completenessFindings];
  if (missingPhases.length || missingDimensions.length) completenessFindings.push({ classification: "MISSING_MATERIAL_MILESTONE", relatedPhaseIds: missingPhases, relatedDimensionIds: missingDimensions, blocking: true, rationale: "Verified eligible candidates do not provide PRIMARY coverage for every required locked phase and dimension; selection cannot manufacture missing history." });
  if (completenessFindings.some((finding) => finding.blocking && finding.classification === "MISSING_MATERIAL_MILESTONE")) failures.add("MATERIAL_OMISSION_UNRESOLVED");

  const orderedIds = [...selected].sort(chronologyComparator(events, inputOrdinals));
  const diagnostics = temporalDiagnostics(input.scope, orderedIds.map((id) => events.get(id)!));
  if (diagnostics.some((diagnostic) => diagnostic.blocking && diagnostic.code === "ONGOING_TOPIC_STALENESS")) failures.add("COVERAGE_GAP_MATERIAL");

  const assessments: SelectionArtifact["assessments"] = input.events.map((event, index) => {
    const judgment = judgments.get(event.eventVersionId)!;
    const eventReasons = reasons.get(event.eventVersionId)!;
    const redundancy = redundant.get(event.eventVersionId);
    const selectionState = eventReasons.length ? "EXCLUDED_INELIGIBLE" as const
      : judgment.significanceClass === "EXCLUDE" ? "EXCLUDED_EDITORIAL" as const
        : redundancy ? "EXCLUDED_REDUNDANT" as const
          : selected.has(event.eventVersionId) ? "SELECTED" as const : "EXCLUDED_CAPACITY" as const;
    const selectionRationale = eventReasons.length ? `Excluded deterministically: ${eventReasons.join(", ")}.`
      : judgment.significanceClass === "EXCLUDE" ? `Excluded by the persisted comparative editorial judgment: ${judgment.rationale}`
        : redundancy ? `Excluded as ${redundancy.relationship}; ${redundancy.rationale}`
          : selected.has(event.eventVersionId) ? `Selected through the staged significance, required-coverage, explanatory-completeness, and chronology protocol. ${judgment.rationale}`
            : `Eligible but omitted after stronger non-redundant candidates satisfied the bounded view capacity. ${judgment.rationale}`;
    return { eventVersionId: event.eventVersionId, inputOrdinal: index, eligible: eventReasons.length === 0, eligibilityReasons: eventReasons, significanceClass: judgment.significanceClass, comparativeRank: judgment.comparativeRank, criteria: judgment.criteria, significanceRationale: judgment.rationale, phaseCoverage: judgment.phaseCoverage, dimensionCoverage: judgment.dimensionCoverage, selectionState, selectionRationale };
  });

  const selectionPolicyVersion = input.selectionPolicyVersion || V2_B_SELECTION_POLICY_VERSION;
  const semanticPayload = {
    scopeContractId: input.scope.scopeContractId,
    scopePayloadHash: input.scope.payloadHash,
    researchMapId: input.researchMap.researchMapId,
    researchMapPayloadHash: input.researchMap.payloadHash,
    completedKnowledgeSetId: input.context.completedKnowledgeSetId,
    completedKnowledgeSetHash: input.context.completedKnowledgeSetHash,
    finalCoverageAuditId: input.context.finalCoverageAuditId,
    finalCoverageAuditHash: input.context.finalCoverageAuditHash,
    candidateInputHash: input.context.candidateInputHash,
    completeCandidateEventVersionIds: eventIds,
    eligibleCandidateEventVersionIds: eligibleJudgments.map((judgment) => judgment.eventVersionId),
    assessments,
    comparisons: input.significance.comparisons,
    redundancyDecisions,
    selectedEventVersionIds: orderedIds,
    orderedEvents: orderedIds.map((eventVersionId, index) => ({ eventVersionId, ordinal: index + 1, temporal: events.get(eventVersionId)!.temporal })),
    coverageSummary: { requiredPhaseIds: requiredPhases, coveredPhaseIds: coveredPhases, missingPhaseIds: missingPhases, requiredDimensionIds: requiredDimensions, coveredDimensionIds: coveredDimensions, missingDimensionIds: missingDimensions },
    temporalDiagnostics: diagnostics,
    completenessFindings,
    status: failures.size === 0 ? "PASS" as const : "FAILED" as const,
    failureCodes: [...failures].sort(),
    selectionPolicyVersion,
    significancePromptVersion: V2_B_PROMPT_VERSION
  };
  const selectionIdentity = {
    artifactType: "EDITORIAL_SELECTION",
    schemaVersion: V2_B_SCHEMA_VERSION,
    pipelineVersion: V2_B_PIPELINE_VERSION,
    policyVersion: selectionPolicyVersion,
    promptVersion: null,
    modelExecutionRef: null,
    parentArtifactIds: [input.scope.scopeContractId, input.researchMap.researchMapId, input.context.completedKnowledgeSetId, input.context.finalCoverageAuditId],
    createdAt: null,
    corpusId: input.context.corpusId,
    topicId: input.context.topicId,
    runId: null,
    generation: input.context.generation,
    sourceKnowledgeRunId: null,
    sourceKnowledgeBundle: { pipelineVersion: "factory-v2-a.13", schemaVersion: "factory-v2-a.5", policyVersion: "evidence-first-v2-a.11", promptVersion: "factory-v2-a-prompts.8" },
    executionMode: "SHADOW",
    publicationEligible: false,
    governanceSubmissionAllowed: false,
    immutable: true,
    semanticPayload
  };
  const selectionArtifactId = contentAddressedId("selection", selectionIdentity);
  return selectionArtifactSchema.parse(attachPayloadHash({
    artifactId: selectionArtifactId,
    artifactType: "EDITORIAL_SELECTION" as const,
    schemaVersion: V2_B_SCHEMA_VERSION,
    pipelineVersion: V2_B_PIPELINE_VERSION,
    policyVersion: selectionPolicyVersion,
    promptVersion: null,
    modelExecutionRef: null,
    parentArtifactIds: [input.scope.scopeContractId, input.researchMap.researchMapId, input.context.completedKnowledgeSetId, input.context.finalCoverageAuditId],
    createdAt: null,
    corpusId: input.context.corpusId,
    topicId: input.context.topicId,
    runId: null,
    generation: input.context.generation,
    sourceKnowledgeRunId: null,
    sourceKnowledgeBundle: { pipelineVersion: "factory-v2-a.13" as const, schemaVersion: "factory-v2-a.5" as const, policyVersion: "evidence-first-v2-a.11" as const, promptVersion: "factory-v2-a-prompts.8" as const },
    executionMode: "SHADOW" as const,
    publicationEligible: false as const,
    governanceSubmissionAllowed: false as const,
    immutable: true as const,
    selectionArtifactId,
    ...semanticPayload
  }));
}
