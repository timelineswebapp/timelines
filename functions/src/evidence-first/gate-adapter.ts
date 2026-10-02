import type { AtomicClaimVersion, CanonicalEventVersion, EvidenceSegment, ResearchMap, ScopeContract, SourceDocument, SourceSnapshot } from "../factory-v2/contracts";
import type { SelectionArtifact } from "../factory-v2/contracts/assembly";
import { generatedTimelineSchema, groundedEvidenceSegmentSchema, sourceCandidateSchema, timelineEditorialPlanSchema, type GeneratedTimeline, type GroundedEvidenceSegment, type SourceCandidate, type TimelineEditorialPlan } from "../schemas";
import type { EventLock, LockedComposition } from "./contracts";

export type InstitutionalGateInput = {
  plan: TimelineEditorialPlan;
  timeline: GeneratedTimeline;
  sources: SourceCandidate[];
  evidenceSegments: GroundedEvidenceSegment[];
};

function canonical(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function dateFields(date: CanonicalEventVersion["temporal"]["start"]) {
  return {
    date: date.label,
    datePrecision: date.precision === "DAY" ? "day" as const : date.precision === "MONTH" ? "month" as const : date.precision === "APPROXIMATE" ? "approximate" as const : "year" as const,
    sortYear: date.year,
    sortMonth: date.month,
    sortDay: date.day
  };
}

function topicType(scope: ScopeContract): TimelineEditorialPlan["scope"]["topicType"] {
  if (scope.topicClass === "CLOSED_EPISODE") return "closed_episode";
  if (scope.topicClass === "BIOGRAPHY") return "biography";
  if (scope.topicClass === "INSTITUTION") return "institution";
  if (scope.topicClass === "ONGOING_SUBJECT") return "ongoing_subject";
  return "long_duration";
}

function subjectClass(scope: ScopeContract): NonNullable<TimelineEditorialPlan["scope"]["subjectClass"]> {
  const map: Record<ScopeContract["topicClass"], NonNullable<TimelineEditorialPlan["scope"]["subjectClass"]>> = {
    CLOSED_EPISODE: "episode",
    BIOGRAPHY: "biography",
    INSTITUTION: "institution",
    LONG_DURATION: "long_duration_subject",
    ONGOING_SUBJECT: "ongoing_subject"
  };
  return map[scope.topicClass];
}

function significanceScores(significanceClass: "ESSENTIAL" | "MAJOR" | "SUPPORTING" | "EXCLUDE") {
  const score = significanceClass === "ESSENTIAL" ? 5 : significanceClass === "MAJOR" ? 4 : significanceClass === "SUPPORTING" ? 3 : 1;
  return { consequence: score, structuralChange: score, innovation: Math.max(1, score - 1), adoption: Math.max(1, score - 1), institutionalImportance: score, socialImpact: score, persistence: score };
}

export function adaptEvidenceFirstForInstitutionalGates(input: {
  scope: ScopeContract;
  researchMap: ResearchMap;
  selection: SelectionArtifact;
  eventLock: EventLock;
  composition: LockedComposition;
  events: readonly CanonicalEventVersion[];
  claims: readonly AtomicClaimVersion[];
  evidenceSegments: readonly EvidenceSegment[];
  sourceSnapshots: readonly SourceSnapshot[];
  sourceDocuments: readonly SourceDocument[];
}): InstitutionalGateInput {
  if (input.selection.status !== "PASS") throw new Error("GATE_ADAPTER_SELECTION_NOT_PASSING");
  if (input.composition.eventLockId !== input.eventLock.eventLockId || input.composition.eventLockPayloadHash !== input.eventLock.payloadHash) throw new Error("GATE_ADAPTER_EVENT_LOCK_LINEAGE_MISMATCH");
  const events = new Map(input.events.map((event) => [event.eventVersionId, event]));
  const claims = new Map(input.claims.map((claim) => [claim.claimVersionId, claim]));
  const segments = new Map(input.evidenceSegments.map((segment) => [segment.evidenceSegmentId, segment]));
  const snapshots = new Map(input.sourceSnapshots.map((snapshot) => [snapshot.sourceSnapshotId, snapshot]));
  const documents = new Map(input.sourceDocuments.map((source) => [source.sourceId, source]));
  const usedSourceIds = new Set<string>();
  const usedEvidenceIds = new Set<string>();

  const timelineEvents = input.eventLock.events.map((locked, index) => {
    const event = events.get(locked.eventVersionId);
    const composed = input.composition.events[index];
    if (!event || !composed || composed.eventVersionId !== locked.eventVersionId) throw new Error(`GATE_ADAPTER_MEMBERSHIP_MISMATCH:${locked.eventVersionId}`);
    const coreEvidenceIds = canonical(locked.coreClaimVersionIds.flatMap((claimId) => {
      const claim = claims.get(claimId);
      if (!claim) throw new Error(`GATE_ADAPTER_MISSING_CORE_CLAIM:${claimId}`);
      return claim.extractedFromSegmentIds;
    }));
    if (coreEvidenceIds.length > 3) throw new Error(`GATE_ADAPTER_CORE_EVIDENCE_LIMIT_UNSATISFIABLE:${locked.eventVersionId}`);
    const evidenceRefs = canonical([...coreEvidenceIds, ...composed.evidenceSegmentIdsUsed]).slice(0, 3);
    const sourceRefs = canonical(evidenceRefs.map((evidenceId) => {
      const segment = segments.get(evidenceId);
      const snapshot = segment ? snapshots.get(segment.sourceSnapshotId) : null;
      if (!segment || !snapshot) throw new Error(`GATE_ADAPTER_MISSING_EVIDENCE_LINEAGE:${evidenceId}`);
      usedEvidenceIds.add(evidenceId);
      usedSourceIds.add(snapshot.sourceId);
      return snapshot.sourceId;
    }));
    if (sourceRefs.length > 3) throw new Error(`GATE_ADAPTER_SOURCE_LIMIT_UNSATISFIABLE:${locked.eventVersionId}`);
    const assessment = input.selection.assessments.find((item) => item.eventVersionId === locked.eventVersionId)!;
    return {
      ...dateFields(event.temporal.start),
      title: locked.canonicalTitle,
      description: composed.description,
      evidenceSummary: composed.evidenceSummary,
      importance: locked.significanceClass === "ESSENTIAL" ? 5 : locked.significanceClass === "MAJOR" ? 4 : 3,
      location: composed.location,
      sourceRefs,
      evidenceRefs,
      tags: composed.tags,
      _assessment: assessment
    };
  });

  const gateSourceIds = canonical(input.sourceDocuments.map((source) => source.sourceId));
  const sources = gateSourceIds.map((sourceId, index) => {
    const source = documents.get(sourceId);
    const snapshot = input.sourceSnapshots.find((candidate) => candidate.sourceId === sourceId);
    if (!source || !snapshot) throw new Error(`GATE_ADAPTER_MISSING_SOURCE:${sourceId}`);
    return sourceCandidateSchema.parse({ sourceId, title: source.title, url: source.canonicalUrl, publisher: new URL(source.canonicalUrl).hostname, publisherOrigin: "hostname_inference", retrievedAt: snapshot.retrievedAt, groundingChunkIndex: index });
  });
  const evidenceSegments = canonical(input.evidenceSegments.map((segment) => segment.evidenceSegmentId)).map((evidenceRef) => {
    const segment = segments.get(evidenceRef)!;
    const snapshot = snapshots.get(segment.sourceSnapshotId)!;
    return groundedEvidenceSegmentSchema.parse({ evidenceRef, exactEvidence: segment.exactText, sourceRefs: [snapshot.sourceId], startIndex: segment.startOffset, endIndex: segment.endOffset });
  });

  const selectedIds = new Set(input.selection.selectedEventVersionIds);
  const openingId = input.eventLock.events[0]!.eventVersionId;
  const terminalId = input.eventLock.events.at(-1)!.eventVersionId;
  const turningPointId = input.eventLock.events.slice(1, -1).sort((left, right) => {
    const l = input.selection.assessments.find((item) => item.eventVersionId === left.eventVersionId)!;
    const r = input.selection.assessments.find((item) => item.eventVersionId === right.eventVersionId)!;
    const value = (finding: typeof l.criteria.turningPointValue) => ({ HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 })[finding];
    return value(l.criteria.turningPointValue) - value(r.criteria.turningPointValue) || l.comparativeRank - r.comparativeRank;
  })[0]?.eventVersionId;
  const fallbackPhaseId = input.researchMap.phases[0]?.phaseId;
  const fallbackDimensionId = input.researchMap.dimensions[0]?.dimensionId;
  if (!fallbackPhaseId || !fallbackDimensionId || input.researchMap.phases.length < 2 || input.researchMap.dimensions.length < 2) throw new Error("GATE_ADAPTER_SCOPE_STRUCTURE_INSUFFICIENT");
  const planCandidates = input.selection.assessments.map((assessment) => {
    const event = events.get(assessment.eventVersionId)!;
    const locked = input.eventLock.events.find((item) => item.eventVersionId === assessment.eventVersionId);
    const allClaimIds = [...event.coreClaimVersionIds, ...event.supportingClaimVersionIds];
    const evidenceRefs = canonical(allClaimIds.flatMap((claimId) => claims.get(claimId)?.extractedFromSegmentIds || [])).slice(0, 50);
    const sourceRefs = canonical(evidenceRefs.map((evidenceRef) => {
      const segment = segments.get(evidenceRef);
      return segment ? snapshots.get(segment.sourceSnapshotId)?.sourceId || "" : "";
    }).filter(Boolean)).slice(0, 50);
    if (!evidenceRefs.length || !sourceRefs.length) throw new Error(`GATE_ADAPTER_CANDIDATE_EVIDENCE_MISSING:${event.eventVersionId}`);
    const selected = selectedIds.has(event.eventVersionId);
    const phaseIds = assessment.phaseCoverage.filter((cell) => cell.relation !== "NONE").map((cell) => cell.phaseId);
    const dimensionIds = assessment.dimensionCoverage.filter((cell) => cell.relation !== "NONE").map((cell) => cell.dimensionId);
    return {
      candidateId: event.eventVersionId,
      title: event.canonicalTitle,
      ...dateFields(event.temporal.start),
      semanticType: event.semanticClass,
      editorialClass: assessment.significanceClass,
      narrativeRole: !selected ? "CONTEXTUAL" as const : event.eventVersionId === openingId ? "OPENING" as const : event.eventVersionId === terminalId ? "TERMINAL" as const : event.eventVersionId === turningPointId ? "TURNING_POINT" as const : "MAJOR_DEVELOPMENT" as const,
      selectionRationale: assessment.selectionRationale,
      eraIds: canonical(phaseIds.length ? phaseIds : [fallbackPhaseId]).slice(0, 4),
      dimensionIds: canonical(dimensionIds.length ? dimensionIds : [fallbackDimensionId]).slice(0, 8),
      significance: significanceScores(assessment.significanceClass),
      significanceRationale: assessment.significanceRationale,
      sourceRefs,
      evidenceRefs,
      selected,
      rejectionReason: selected ? null : assessment.selectionRationale
    };
  });
  const selectedYearsByPhase = new Map(input.researchMap.phases.map((phase) => [phase.phaseId, planCandidates.filter((candidate) => candidate.selected && candidate.eraIds.includes(phase.phaseId)).map((candidate) => candidate.sortYear)]));
  const plan = timelineEditorialPlanSchema.parse({
    scope: {
      topic: input.scope.title,
      scopeSummary: input.scope.subjectDefinition,
      topicType: topicType(input.scope),
      startBoundary: input.scope.chronologyStart.label,
      startYear: input.scope.chronologyStart.year,
      endBoundary: input.scope.chronologyEnd?.label || input.scope.ongoingAsOf || "Ongoing",
      endYear: input.scope.chronologyEnd?.year ?? (input.scope.ongoingAsOf ? Number(input.scope.ongoingAsOf.slice(0, 4)) : null),
      isOngoing: input.scope.topicClass === "ONGOING_SUBJECT",
      granularity: input.scope.granularity === "OVERVIEW" ? "overview" : input.scope.granularity === "DETAILED" ? "detailed" : "standard",
      majorEras: input.researchMap.phases.map((phase) => { const years = selectedYearsByPhase.get(phase.phaseId)!; return { eraId: phase.phaseId, label: phase.label, startYear: years.length ? Math.min(...years) : null, endYear: years.length ? Math.max(...years) : null, rationale: phase.rationale }; }),
      majorDimensions: input.researchMap.dimensions.map((dimension) => ({ dimensionId: dimension.dimensionId, label: dimension.label, rationale: dimension.rationale })),
      selectionPrinciples: ["Select only evidence-admissible canonical EVENT candidates.", "Retain the smallest sufficient comparative milestone set without padding."],
      knownCoverageRisks: input.selection.completenessFindings.map((finding) => finding.rationale).slice(0, 12),
      subjectClass: subjectClass(input.scope),
      titlePromise: input.scope.subjectDefinition,
      inclusionRules: input.scope.includedQuestions,
      exclusionRules: [...input.scope.excludedQuestions, ...input.scope.explicitExclusions],
      openingCriterion: `The opening milestone must satisfy the locked chronology start: ${input.scope.chronologyStart.label}.`,
      terminalCriterion: input.scope.topicClass === "ONGOING_SUBJECT" ? `The terminal milestone must represent development through ${input.scope.ongoingAsOf}.` : `The terminal milestone must satisfy the locked chronology end: ${input.scope.chronologyEnd?.label}.`,
      selectedSetRationale: `The ${input.eventLock.events.length} locked milestones are the complete evidence-admissible smallest sufficient set selected comparatively from ${input.selection.completeCandidateEventVersionIds.length} candidates.`
    },
    candidates: planCandidates,
    redundancyReview: input.selection.redundancyDecisions.map((decision) => ({ candidateIds: [decision.keptEventVersionId, decision.excludedEventVersionId], resolution: "excluded", rationale: decision.rationale })),
    omissionReview: input.selection.completenessFindings.map((finding) => ({ development: finding.rationale.slice(0, 300), significance: finding.rationale, resolution: finding.blocking ? "unresolved" : "not_applicable", classification: finding.blocking ? "missing_material_milestone" : finding.classification === "CONTEXTUAL_THEME" || finding.classification === "STATE_LEGACY" ? "contextual_non_event_theme" : finding.classification === "OUTSIDE_SCOPE" ? "outside_declared_scope" : "inappropriate_for_granularity", candidateId: null, evidenceRefs: [], rationale: finding.rationale }))
  });
  const timeline = generatedTimelineSchema.parse({ title: input.composition.title, description: input.composition.description, category: input.composition.category, tags: input.composition.tags, events: timelineEvents.map(({ _assessment: _ignored, ...event }) => event) });
  return { plan, timeline, sources, evidenceSegments };
}
