import { z } from "zod";
import { QUALITY_POLICY_VERSION } from "./config";
import {
  generatedTimelineSchema,
  timelineEditorialPlanSchema,
  type GeneratedTimeline,
  type GroundedEvidenceSegment,
  type TimelineEditorialPlan
} from "./schemas";

export type QualityCheck = {
  status: "passed" | "failed";
  reasons: string[];
};

export type OmissionClassification =
  | "missing_material_milestone"
  | "contextual_non_event_theme"
  | "outside_declared_scope"
  | "inappropriate_for_granularity"
  | "already_adequately_represented";

export type OmissionAssessment = {
  development: string;
  classification: OmissionClassification;
  blocking: boolean;
  basis: "explicit" | "resolution" | "legacy_semantic" | "fail_closed_default";
};

export type TimelineQualityAssessment = {
  policyVersion: string;
  verdict: "passed" | "failed";
  assessedAt: string;
  checks: {
    scope: QualityCheck;
    evidence: QualityCheck;
    eraCoverage: QualityCheck;
    temporalBalance: QualityCheck;
    redundancy: QualityCheck;
    omissions: QualityCheck;
    endpointCoverage: QualityCheck;
    selectionIntegrity: QualityCheck;
  };
  eraDistribution: Record<string, number>;
  eventDistribution: Record<string, number>;
  omissionAssessments: OmissionAssessment[];
  unresolvedReasons: string[];
};

const LEGACY_OUTSIDE_SCOPE = /(?:outside|beyond) (?:the )?(?:declared )?scope|not (?:within|part of) (?:the )?(?:declared )?scope|cannot be adequately represented[\s\S]{0,120}within the scope/iu;
const LEGACY_CONTEXTUAL_THEME = /broad theme|context(?:ual)?|daily realit|social experience|non-event/iu;
const LEGACY_GRANULARITY = /declared granularity|inappropriate for (?:the )?(?:declared )?granularity|too (?:broad|narrow|granular)|single (?:event|milestone)/iu;

export function classifyOmission(
  omission: TimelineEditorialPlan["omissionReview"][number]
): OmissionAssessment {
  if (omission.resolution === "represented" || omission.resolution === "grounded_candidate_added") {
    return { development: omission.development, classification: "already_adequately_represented", blocking: false, basis: "resolution" };
  }
  if (omission.classification) {
    return {
      development: omission.development,
      classification: omission.classification,
      blocking: omission.classification === "missing_material_milestone",
      basis: "explicit"
    };
  }
  const semanticText = `${omission.development}\n${omission.significance}\n${omission.rationale}`;
  if (LEGACY_OUTSIDE_SCOPE.test(semanticText)) {
    return { development: omission.development, classification: "outside_declared_scope", blocking: false, basis: "legacy_semantic" };
  }
  if (LEGACY_CONTEXTUAL_THEME.test(semanticText)) {
    return { development: omission.development, classification: "contextual_non_event_theme", blocking: false, basis: "legacy_semantic" };
  }
  if (LEGACY_GRANULARITY.test(semanticText) || omission.resolution === "not_applicable") {
    return { development: omission.development, classification: "inappropriate_for_granularity", blocking: false, basis: "legacy_semantic" };
  }
  return { development: omission.development, classification: "missing_material_milestone", blocking: true, basis: "fail_closed_default" };
}

export function assessEditorialPlan(input: {
  plan: TimelineEditorialPlan;
  allowedSourceRefs: Set<string>;
  allowedEvidenceRefs: Set<string>;
  currentYear?: number;
}): string[] {
  const plan = timelineEditorialPlanSchema.parse(input.plan);
  const currentYear = input.currentYear ?? new Date().getUTCFullYear();
  const selected = plan.candidates.filter((candidate) => candidate.selected);
  const knownEras = new Set(plan.scope.majorEras.map((era) => era.eraId));
  const knownDimensions = new Set(plan.scope.majorDimensions.map((dimension) => dimension.dimensionId));
  const eraCounts = new Map([...knownEras].map((eraId) => [eraId, 0]));
  const representedEras = new Set<string>();
  const reasons: string[] = [];
  if (selected.length < 6 || selected.length > 20) reasons.push(`selectionIntegrity: selected ${selected.length} events; supported range is 6-20.`);
  for (const candidate of selected) if (candidate.sortYear > currentYear) reasons.push(`scope: selected event ${candidate.candidateId} is future-dated ${candidate.sortYear}; historical timelines cannot present future projections as events.`);
  if (new Set(plan.candidates.map((candidate) => candidate.candidateId)).size !== plan.candidates.length) reasons.push("selectionIntegrity: candidate IDs are not unique.");
  if (new Set(selected.map((candidate) => titleKey(candidate.title))).size !== selected.length) reasons.push("redundancy: selected candidate titles are duplicated.");
  for (const candidate of plan.candidates) {
    for (const eraId of candidate.eraIds) {
      if (!knownEras.has(eraId)) reasons.push(`scope: ${candidate.candidateId} references unknown era ${eraId}.`);
      if (candidate.selected && knownEras.has(eraId)) representedEras.add(eraId);
    }
    for (const dimensionId of candidate.dimensionIds) if (!knownDimensions.has(dimensionId)) reasons.push(`scope: ${candidate.candidateId} references unknown dimension ${dimensionId}.`);
    for (const sourceRef of candidate.sourceRefs) if (!input.allowedSourceRefs.has(sourceRef)) reasons.push(`evidence: ${candidate.candidateId} references unknown source ${sourceRef}.`);
    for (const evidenceRef of candidate.evidenceRefs) if (!input.allowedEvidenceRefs.has(evidenceRef)) reasons.push(`evidence: ${candidate.candidateId} references unknown evidence ${evidenceRef}.`);
  }
  for (const candidate of selected) {
    const primaryEra = candidate.eraIds[0];
    if (primaryEra && knownEras.has(primaryEra)) eraCounts.set(primaryEra, (eraCounts.get(primaryEra) || 0) + 1);
  }
  for (const eraId of knownEras) if (!representedEras.has(eraId)) reasons.push(`eraCoverage: no selected event represents ${eraId}.`);
  const maximumEraCount = Math.max(0, ...eraCounts.values());
  if (selected.length >= 10 && plan.scope.majorEras.length >= 3 && maximumEraCount / selected.length > 0.65) reasons.push(`temporalBalance: a single era contains ${Math.round(maximumEraCount / selected.length * 100)}% of selected events.`);
  for (const review of plan.redundancyReview) if (review.resolution === "excessive_unresolved") reasons.push(`redundancy: unresolved cluster ${review.candidateIds.join(", ")}.`);
  for (const omission of plan.omissionReview) {
    const assessment = classifyOmission(omission);
    if (assessment.blocking) reasons.push(`omissions: unresolved material milestone ${omission.development}.`);
  }
  if (plan.scope.isOngoing && selected.length) {
    const lastYear = Math.max(...selected.map((candidate) => candidate.sortYear));
    const span = plan.scope.startYear === null ? null : Math.max(1, currentYear - plan.scope.startYear);
    const tolerance = span === null ? 15 : Math.max(10, Math.min(25, Math.ceil(span * 0.2)));
    if (currentYear - lastYear > tolerance) reasons.push(`endpointCoverage: ongoing topic ends in ${lastYear}, beyond the ${tolerance}-year tolerance.`);
  }
  if (selected.length && plan.scope.startYear !== null) {
    const firstYear = Math.min(...selected.map((candidate) => candidate.sortYear));
    if (firstYear < plan.scope.startYear) reasons.push(`scope: selected event ${firstYear} predates declared start boundary ${plan.scope.startYear}.`);
    const effectiveEnd = plan.scope.isOngoing ? currentYear : plan.scope.endYear;
    if (effectiveEnd !== null) {
      const tolerance = Math.max(2, Math.ceil(Math.abs(effectiveEnd - plan.scope.startYear) * 0.15));
      if (firstYear - plan.scope.startYear > tolerance) reasons.push(`scope: first selected event ${firstYear} leaves the declared ${plan.scope.startYear} boundary unrepresented beyond the ${tolerance}-year tolerance.`);
    }
  }
  if (selected.length && !plan.scope.isOngoing && plan.scope.endYear !== null) {
    const lastYear = Math.max(...selected.map((candidate) => candidate.sortYear));
    if (lastYear > plan.scope.endYear) reasons.push(`scope: selected event ${lastYear} exceeds declared end boundary ${plan.scope.endYear}.`);
    if (plan.scope.startYear !== null) {
      const tolerance = Math.max(2, Math.ceil(Math.abs(plan.scope.endYear - plan.scope.startYear) * 0.15));
      if (plan.scope.endYear - lastYear > tolerance) reasons.push(`scope: final selected event ${lastYear} leaves the declared ${plan.scope.endYear} boundary unrepresented beyond the ${tolerance}-year tolerance.`);
    }
  }
  return Array.from(new Set(reasons));
}

function uniqueTrimmed(values: unknown[], maximum?: number): string[] {
  const normalized = Array.from(new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().replace(/\s+/gu, " "))
    .filter(Boolean)));
  return maximum === undefined ? normalized : normalized.slice(0, maximum);
}

function normalizeText(value: unknown): unknown {
  if (typeof value === "string") return value.trim().replace(/\s+/gu, " ");
  if (Array.isArray(value)) return value.map(normalizeText);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, normalizeText(entry)]));
  }
  return value;
}

/** Applies structural corrections only. It never changes dates, claims, or historical meaning. */
export function normalizeGeneratedTimeline(
  value: unknown,
  evidenceSegments: GroundedEvidenceSegment[]
): GeneratedTimeline {
  const normalized = normalizeText(value) as Record<string, unknown>;
  if (!Array.isArray(normalized.events)) return generatedTimelineSchema.parse(normalized);
  const evidenceByRef = new Map(evidenceSegments.map((segment) => [segment.evidenceRef, segment]));
  const events = normalized.events.map((entry) => {
    if (!entry || typeof entry !== "object") return entry;
    const event = { ...(entry as Record<string, unknown>) };
    const allEvidenceRefs = uniqueTrimmed(Array.isArray(event.evidenceRefs) ? event.evidenceRefs : []);
    const retainedEvidenceRefs = allEvidenceRefs
      .filter((evidenceRef) => evidenceByRef.has(evidenceRef))
      .sort((left, right) => (evidenceByRef.get(right)!.sourceRefs.length - evidenceByRef.get(left)!.sourceRefs.length) || allEvidenceRefs.indexOf(left) - allEvidenceRefs.indexOf(right))
      .slice(0, 3);
    const attributableCounts = new Map<string, number>();
    for (const evidenceRef of retainedEvidenceRefs) {
      for (const sourceRef of evidenceByRef.get(evidenceRef)?.sourceRefs || []) {
        attributableCounts.set(sourceRef, (attributableCounts.get(sourceRef) || 0) + 1);
      }
    }
    const allSourceRefs = uniqueTrimmed([
      ...(Array.isArray(event.sourceRefs) ? event.sourceRefs : []),
      ...retainedEvidenceRefs.flatMap((evidenceRef) => evidenceByRef.get(evidenceRef)?.sourceRefs || [])
    ]);
    const retainedSourceRefs = allSourceRefs
      .filter((sourceRef) => attributableCounts.has(sourceRef))
      .sort((left, right) => (attributableCounts.get(right)! - attributableCounts.get(left)!) || allSourceRefs.indexOf(left) - allSourceRefs.indexOf(right))
      .slice(0, 3);
    event.evidenceRefs = retainedEvidenceRefs;
    event.sourceRefs = retainedSourceRefs;
    event.tags = uniqueTrimmed(Array.isArray(event.tags) ? event.tags : [], 8);
    return event;
  });
  events.sort((left, right) => {
    if (!left || !right || typeof left !== "object" || typeof right !== "object") return 0;
    const l = left as Record<string, unknown>;
    const r = right as Record<string, unknown>;
    return Number(l.sortYear) - Number(r.sortYear)
      || Number(l.sortMonth ?? 0) - Number(r.sortMonth ?? 0)
      || Number(l.sortDay ?? 0) - Number(r.sortDay ?? 0)
      || String(l.title).localeCompare(String(r.title));
  });
  normalized.events = events;
  normalized.tags = uniqueTrimmed(Array.isArray(normalized.tags) ? normalized.tags : [], 12);
  return generatedTimelineSchema.parse(normalized);
}

function passed(reasons: string[] = ["passed"]): QualityCheck {
  return { status: "passed", reasons };
}

function failed(reasons: string[]): QualityCheck {
  return { status: "failed", reasons };
}

function titleKey(value: string) {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, " ").trim();
}

export function assessTimelineQuality(input: {
  plan: TimelineEditorialPlan;
  timeline: GeneratedTimeline;
  allowedSourceRefs: Set<string>;
  allowedEvidenceRefs: Set<string>;
  currentYear?: number;
}): TimelineQualityAssessment {
  const plan = timelineEditorialPlanSchema.parse(input.plan);
  const currentYear = input.currentYear ?? new Date().getUTCFullYear();
  const selected = plan.candidates.filter((candidate) => candidate.selected);
  const eraIds = new Set(plan.scope.majorEras.map((era) => era.eraId));
  const dimensionIds = new Set(plan.scope.majorDimensions.map((dimension) => dimension.dimensionId));
  const eraDistribution = Object.fromEntries(plan.scope.majorEras.map((era) => [era.eraId, 0]));
  const invalidPlanRefs: string[] = [];
  for (const candidate of plan.candidates) {
    for (const eraId of candidate.eraIds) {
      if (!eraIds.has(eraId)) invalidPlanRefs.push(`${candidate.candidateId}:unknown_era:${eraId}`);
    }
    for (const dimensionId of candidate.dimensionIds) if (!dimensionIds.has(dimensionId)) invalidPlanRefs.push(`${candidate.candidateId}:unknown_dimension:${dimensionId}`);
    for (const sourceRef of candidate.sourceRefs) if (!input.allowedSourceRefs.has(sourceRef)) invalidPlanRefs.push(`${candidate.candidateId}:unknown_source:${sourceRef}`);
    for (const evidenceRef of candidate.evidenceRefs) if (!input.allowedEvidenceRefs.has(evidenceRef)) invalidPlanRefs.push(`${candidate.candidateId}:unknown_evidence:${evidenceRef}`);
  }
  const representedEras = new Set(selected.flatMap((candidate) => candidate.eraIds));
  for (const candidate of selected) {
    const primaryEra = candidate.eraIds[0];
    if (primaryEra && primaryEra in eraDistribution) eraDistribution[primaryEra] = (eraDistribution[primaryEra] || 0) + 1;
  }
  const uncoveredEras = [...eraIds].filter((eraId) => !representedEras.has(eraId));
  const selectedTitles = new Set(selected.map((candidate) => titleKey(candidate.title)));
  const timelineTitles = new Set(input.timeline.events.map((event) => titleKey(event.title)));
  const missingSelected = [...selectedTitles].filter((title) => !timelineTitles.has(title));
  const unplannedEvents = [...timelineTitles].filter((title) => !selectedTitles.has(title));
  const evidenceFailures = input.timeline.events.flatMap((event, index) => [
    ...event.sourceRefs.filter((ref) => !input.allowedSourceRefs.has(ref)).map((ref) => `event_${index}:unknown_source:${ref}`),
    ...event.evidenceRefs.filter((ref) => !input.allowedEvidenceRefs.has(ref)).map((ref) => `event_${index}:unknown_evidence:${ref}`)
  ]);
  const maximumEraShare = selected.length === 0 ? 1 : Math.max(...Object.values(eraDistribution)) / selected.length;
  const temporalBalanceReasons = maximumEraShare > 0.65 && plan.scope.majorEras.length >= 3 && selected.length >= 10
    ? [`A single era contains ${(maximumEraShare * 100).toFixed(0)}% of selected events.`]
    : [];
  const duplicateSignatures = input.timeline.events.length - new Set(input.timeline.events.map((event) => `${event.sortYear}:${titleKey(event.title)}`)).size;
  const unresolvedRedundancy = plan.redundancyReview.filter((item) => item.resolution === "excessive_unresolved");
  const omissionAssessments = plan.omissionReview.map(classifyOmission);
  const unresolvedOmissions = omissionAssessments.filter((item) => item.blocking);
  const lastYear = Math.max(...input.timeline.events.map((event) => event.sortYear));
  const scopeSpan = plan.scope.startYear === null ? null : Math.max(1, currentYear - plan.scope.startYear);
  const endpointTolerance = scopeSpan === null ? 15 : Math.max(10, Math.min(25, Math.ceil(scopeSpan * 0.2)));
  const endpointReasons = plan.scope.isOngoing && currentYear - lastYear > endpointTolerance
    ? [`Ongoing topic ends in ${lastYear}, ${currentYear - lastYear} years before ${currentYear}; tolerance is ${endpointTolerance} years.`]
    : [];
  const firstYear = Math.min(...input.timeline.events.map((event) => event.sortYear));
  const effectiveEnd = plan.scope.isOngoing ? currentYear : plan.scope.endYear;
  const boundaryTolerance = plan.scope.startYear !== null && effectiveEnd !== null
    ? Math.max(2, Math.ceil(Math.abs(effectiveEnd - plan.scope.startYear) * 0.15))
    : null;
  const scopeReasons = [
    ...(plan.scope.majorEras.length < 2 || plan.scope.majorDimensions.length < 2 ? ["Scope lacks major eras or dimensions."] : []),
    ...(plan.scope.startYear !== null && firstYear < plan.scope.startYear ? [`Timeline begins in ${firstYear}, before declared start boundary ${plan.scope.startYear}.`] : []),
    ...(plan.scope.startYear !== null && boundaryTolerance !== null && firstYear - plan.scope.startYear > boundaryTolerance ? [`Timeline begins in ${firstYear}, leaving declared start ${plan.scope.startYear} unrepresented beyond the ${boundaryTolerance}-year tolerance.`] : []),
    ...(!plan.scope.isOngoing && plan.scope.endYear !== null && lastYear > plan.scope.endYear ? [`Timeline ends in ${lastYear}, after declared end boundary ${plan.scope.endYear}.`] : []),
    ...(!plan.scope.isOngoing && plan.scope.endYear !== null && boundaryTolerance !== null && plan.scope.endYear - lastYear > boundaryTolerance ? [`Timeline ends in ${lastYear}, leaving declared end ${plan.scope.endYear} unrepresented beyond the ${boundaryTolerance}-year tolerance.`] : []),
    ...input.timeline.events.filter((event) => event.sortYear > currentYear).map((event) => `Future-dated event ${event.sortYear} cannot be presented as completed history: ${event.title}.`)
  ];
  const checks = {
    scope: scopeReasons.length === 0 ? passed() : failed(scopeReasons),
    evidence: evidenceFailures.length === 0 && invalidPlanRefs.length === 0 ? passed() : failed([...invalidPlanRefs, ...evidenceFailures]),
    eraCoverage: uncoveredEras.length === 0 ? passed() : failed(uncoveredEras.map((eraId) => `No selected event represents era ${eraId}.`)),
    temporalBalance: temporalBalanceReasons.length === 0 ? passed() : failed(temporalBalanceReasons),
    redundancy: duplicateSignatures === 0 && unresolvedRedundancy.length === 0
      ? passed()
      : failed([
        ...(duplicateSignatures ? [`${duplicateSignatures} duplicate event signatures detected.`] : []),
        ...unresolvedRedundancy.map((item) => `Unresolved excessive cluster: ${item.candidateIds.join(", ")} — ${item.rationale}`)
      ]),
    omissions: unresolvedOmissions.length === 0
      ? passed(omissionAssessments.length === 0 ? ["passed"] : omissionAssessments.map((item) => `${item.classification}: ${item.development}`))
      : failed(unresolvedOmissions.map((item) => `Unresolved material milestone: ${item.development}`)),
    endpointCoverage: endpointReasons.length === 0 ? passed() : failed(endpointReasons),
    selectionIntegrity: selected.length >= 6 && selected.length <= 20 && missingSelected.length === 0 && unplannedEvents.length === 0 && input.timeline.events.length === selected.length
      ? passed([`${selected.length} significant planned events were composed without padding.`])
      : failed([
        ...(selected.length < 6 || selected.length > 20 ? [`Selected event count ${selected.length} is outside supported bounds 6-20.`] : []),
        ...missingSelected.map((title) => `Selected candidate absent from timeline: ${title}`),
        ...unplannedEvents.map((title) => `Timeline event absent from plan: ${title}`),
        ...(input.timeline.events.length !== selected.length ? ["Timeline event count does not match selected candidate count."] : [])
      ])
  };
  const unresolvedReasons = Object.entries(checks).flatMap(([name, check]) => check.status === "failed" ? check.reasons.map((reason) => `${name}:${reason}`) : []);
  const eventDistribution: Record<string, number> = {};
  for (const event of input.timeline.events) {
    const bucket = `${Math.floor(event.sortYear / 10) * 10}s`;
    eventDistribution[bucket] = (eventDistribution[bucket] || 0) + 1;
  }
  return {
    policyVersion: QUALITY_POLICY_VERSION,
    verdict: unresolvedReasons.length === 0 ? "passed" : "failed",
    assessedAt: new Date().toISOString(),
    checks,
    eraDistribution,
    eventDistribution,
    omissionAssessments,
    unresolvedReasons
  };
}

export function assertQualityPassed(assessment: TimelineQualityAssessment): void {
  if (assessment.verdict !== "passed") {
    throw new z.ZodError(assessment.unresolvedReasons.slice(0, 50).map((reason) => ({
      code: z.ZodIssueCode.custom,
      path: ["quality"],
      message: reason
    })));
  }
}
