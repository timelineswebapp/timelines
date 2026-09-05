import { z } from "zod";
import { QUALITY_POLICY_VERSION } from "./config";
import {
  generatedTimelineSchema,
  compareHistoricalDates,
  timelineEditorialPlanSchema,
  type GeneratedTimeline,
  type GroundedEvidenceSegment,
  type TimelineEditorialPlan
} from "./schemas";
import type { TimelineCandidate } from "./schemas";

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
    eventSemantics: QualityCheck;
    datePrecision: QualityCheck;
  };
  eraDistribution: Record<string, number>;
  eventDistribution: Record<string, number>;
  omissionAssessments: OmissionAssessment[];
  unresolvedReasons: string[];
};

type TemporalPoint = { sortYear: number; sortMonth: number | null; sortDay: number | null };

function interval(value: TemporalPoint) {
  const startMonth = value.sortMonth ?? 1;
  const endMonth = value.sortMonth ?? 12;
  const startDay = value.sortDay ?? 1;
  const endDay = value.sortDay ?? new Date(Date.UTC(value.sortYear, endMonth, 0)).getUTCDate();
  return { start: value.sortYear * 10_000 + startMonth * 100 + startDay, end: value.sortYear * 10_000 + endMonth * 100 + endDay };
}

function parseBoundary(value: string, fallbackYear: number | null, end: boolean): number | null {
  const trimmed = value.trim();
  if (/^-?\d{1,4}$/u.test(trimmed)) {
    const year = Number(trimmed);
    return year * 10_000 + (end ? 1231 : 101);
  }
  const iso = /^(-?\d{1,4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  if (iso) return Number(iso[1]) * 10_000 + Number(iso[2]) * 100 + Number(iso[3]);
  const namedDay = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*(-?\d{1,4})$/iu.exec(trimmed);
  if (namedDay) {
    const month = new Date(`${namedDay[1]} 1, 2000 UTC`).getUTCMonth() + 1;
    return Number(namedDay[3]) * 10_000 + month * 100 + Number(namedDay[2]);
  }
  const monthYear = /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(-?\d{1,4})$/iu.exec(trimmed);
  if (monthYear) {
    const month = new Date(`${monthYear[1]} 1, 2000`).getUTCMonth() + 1;
    const day = end ? new Date(Date.UTC(Number(monthYear[2]), month, 0)).getUTCDate() : 1;
    return Number(monthYear[2]) * 10_000 + month * 100 + day;
  }
  const parsed = Date.parse(trimmed);
  if (Number.isFinite(parsed)) {
    const date = new Date(parsed);
    return date.getUTCFullYear() * 10_000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  }
  return fallbackYear === null ? null : fallbackYear * 10_000 + (end ? 1231 : 101);
}

function closedBoundaryReasons(plan: TimelineEditorialPlan, items: Array<TemporalPoint & { title: string; datePrecision: string }>) {
  if (plan.scope.topicType !== "closed_episode" || plan.scope.isOngoing) return [];
  const start = parseBoundary(plan.scope.startBoundary, plan.scope.startYear, false);
  const end = parseBoundary(plan.scope.endBoundary, plan.scope.endYear, true);
  if (start === null || end === null) return ["Closed episode lacks resolvable temporal boundaries."];
  return items.flatMap((item) => {
    const range = interval(item);
    if (item.datePrecision === "approximate") return [`Approximate date cannot establish that ${item.title} falls within the closed episode.`];
    if (range.start < start || range.end > end) {
      return [`${item.title} (${item.datePrecision}: ${range.start}-${range.end}) is not defensibly contained within ${plan.scope.startBoundary}–${plan.scope.endBoundary}.`];
    }
    return [];
  });
}

const LEGACY_OUTSIDE_SCOPE = /(?:outside|beyond) (?:the )?(?:declared )?scope|not (?:within|part of) (?:the )?(?:declared )?scope|cannot be adequately represented[\s\S]{0,120}within the scope/iu;
const LEGACY_CONTEXTUAL_THEME = /broad theme|context(?:ual)?|daily realit|social experience|non-event/iu;
const LEGACY_GRANULARITY = /declared granularity|inappropriate for (?:the )?(?:declared )?granularity|too (?:broad|narrow|granular)|single (?:event|milestone)/iu;
const STATE_LEGACY_LANGUAGE = /\b(?:remains?|continues?|continuing|ongoing|legacy|on display|preserved|still operational|lasting impact|long-term impact|influence continues)\b/iu;
const CONTEXT_LANGUAGE = /\b(?:background|context|conditions|environment|daily life|geopolitical situation|social climate)\b/iu;
const FUTURE_LANGUAGE = /\b(?:expected|scheduled|projected|speculative|planned future|will (?:launch|open|begin|end|occur|be completed))\b/iu;

export type CandidateSemanticType = TimelineCandidate["semanticType"];

export function inferLegacyCandidateSemanticType(value: { title: string; description?: string; significanceRationale?: string }): CandidateSemanticType {
  const text = `${value.title}\n${value.description || ""}\n${value.significanceRationale || ""}`;
  if (FUTURE_LANGUAGE.test(text)) return "FUTURE";
  if (STATE_LEGACY_LANGUAGE.test(text)) return "STATE_LEGACY";
  if (CONTEXT_LANGUAGE.test(text)) return "CONTEXT";
  return "EVENT";
}

function precisionFromDate(date: string): { datePrecision: "year" | "month" | "day" | "approximate"; sortMonth: number | null; sortDay: number | null } {
  if (/\b(?:circa|c\.|about|approximately|early|mid|late)\b/iu.test(date)) return { datePrecision: "approximate", sortMonth: null, sortDay: null };
  const parsed = Date.parse(date);
  if (/^-?\d{1,4}$/u.test(date.trim())) return { datePrecision: "year", sortMonth: null, sortDay: null };
  if (/^[A-Za-z]+\s+-?\d{1,4}$/u.test(date.trim()) && Number.isFinite(parsed)) return { datePrecision: "month", sortMonth: new Date(parsed).getUTCMonth() + 1, sortDay: null };
  if (Number.isFinite(parsed)) return { datePrecision: "day", sortMonth: new Date(parsed).getUTCMonth() + 1, sortDay: new Date(parsed).getUTCDate() };
  return { datePrecision: "approximate", sortMonth: null, sortDay: null };
}

/** Deterministically upgrades an immutable pre-V3 plan; it never invents date precision or new content. */
export function upgradeLegacyPlanForV3(rawPlan: unknown, timeline: GeneratedTimeline): TimelineEditorialPlan {
  const value = rawPlan as Record<string, unknown>;
  const eventByTitle = new Map(timeline.events.map((event) => [titleKey(event.title), event]));
  const candidates = Array.isArray(value.candidates) ? value.candidates.map((raw) => {
    const candidate = raw as Record<string, unknown>;
    const matchingEvent = eventByTitle.get(titleKey(String(candidate.title || "")));
    const derived = matchingEvent
      ? { datePrecision: matchingEvent.datePrecision, sortMonth: matchingEvent.sortMonth, sortDay: matchingEvent.sortDay }
      : precisionFromDate(String(candidate.date || candidate.sortYear || ""));
    const semanticType = inferLegacyCandidateSemanticType({
      title: String(candidate.title || ""),
      description: matchingEvent?.description,
      significanceRationale: String(candidate.significanceRationale || "")
    });
    const wasSelected = candidate.selected === true;
    return {
      ...candidate,
      ...derived,
      semanticType,
      selected: wasSelected && semanticType === "EVENT",
      rejectionReason: wasSelected && semanticType !== "EVENT"
        ? `Excluded by Timeline Quality V3 because ${semanticType} is not a discrete chronological event.`
        : candidate.rejectionReason
    };
  }) : [];
  return timelineEditorialPlanSchema.parse({ ...value, candidates });
}

export function selectV3Chronology(plan: TimelineEditorialPlan, timeline: GeneratedTimeline): GeneratedTimeline {
  const selectedTitles = new Set(plan.candidates.filter((candidate) => candidate.selected && candidate.semanticType === "EVENT").map((candidate) => titleKey(candidate.title)));
  return generatedTimelineSchema.parse({ ...timeline, events: timeline.events.filter((event) => selectedTitles.has(titleKey(event.title))) });
}

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
  for (const candidate of selected) if (candidate.semanticType !== "EVENT") reasons.push(`eventSemantics: selected ${candidate.candidateId} is ${candidate.semanticType}; only EVENT is chronology-eligible.`);
  for (const reason of closedBoundaryReasons(plan, selected)) reasons.push(`datePrecision: ${reason}`);
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
    return compareHistoricalDates({ sortYear: Number(l.sortYear), sortMonth: typeof l.sortMonth === "number" ? l.sortMonth : null, sortDay: typeof l.sortDay === "number" ? l.sortDay : null }, { sortYear: Number(r.sortYear), sortMonth: typeof r.sortMonth === "number" ? r.sortMonth : null, sortDay: typeof r.sortDay === "number" ? r.sortDay : null });
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
  const candidateByTitle = new Map(selected.map((candidate) => [titleKey(candidate.title), candidate]));
  const semanticReasons = selected.filter((candidate) => candidate.semanticType !== "EVENT").map((candidate) => `${candidate.title} is ${candidate.semanticType}; only EVENT is chronology-eligible.`);
  const precisionMismatchReasons = input.timeline.events.flatMap((event) => {
    const candidate = candidateByTitle.get(titleKey(event.title));
    if (!candidate) return [];
    return candidate.datePrecision !== event.datePrecision || candidate.sortYear !== event.sortYear || candidate.sortMonth !== event.sortMonth || candidate.sortDay !== event.sortDay
      ? [`${event.title} does not preserve the selected candidate's evidenced date precision.`]
      : [];
  });
  const closedPrecisionReasons = closedBoundaryReasons(plan, input.timeline.events);
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
      ]),
    eventSemantics: semanticReasons.length === 0 ? passed(["Every selected chronology item is an EVENT."]) : failed(semanticReasons),
    datePrecision: precisionMismatchReasons.length === 0 && closedPrecisionReasons.length === 0
      ? passed(["Date precision is preserved and closed-episode events are contained within actual boundaries."])
      : failed([...precisionMismatchReasons, ...closedPrecisionReasons])
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
