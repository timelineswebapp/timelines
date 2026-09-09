import { z } from "zod";

const boundedText = (min: number, max: number) => z.string().trim().min(min).max(max);
const safeUrl = z.string().trim().url().max(2048).refine((value) => new URL(value).protocol === "https:", "HTTPS URL required.");
const requestLanguageSchema = boundedText(2, 20);
const requestMetadataSchema = z.record(z.unknown()).default({}).refine(
  (value) => Object.keys(value).length <= 32 && JSON.stringify(value).length <= 4096,
  "Metadata must contain at most 32 keys and serialize to at most 4096 characters."
);
const requestBase = {
  language: requestLanguageSchema.default("en"),
  metadata: requestMetadataSchema
};

export const topicRequestSchema = z.discriminatedUnion("requestType", [
  z.object({ ...requestBase, requestType: z.literal("timeline_request"), query: boundedText(3, 120) }),
  z.object({
    ...requestBase,
    requestType: z.literal("general_contact"),
    query: boundedText(3, 160).default("General contact"),
    email: z.string().trim().email().max(254),
    message: boundedText(3, 5000)
  }),
  z.object({
    ...requestBase,
    requestType: z.literal("timeline_proposal"),
    query: boundedText(3, 240),
    email: z.string().trim().email().max(254),
    message: boundedText(3, 5000),
    sourcesScope: boundedText(3, 5000)
  }),
  z.object({
    ...requestBase,
    requestType: z.literal("timeline_correction"),
    query: boundedText(3, 240),
    email: z.string().trim().email().max(254),
    targetTimeline: boundedText(3, 500),
    message: boundedText(3, 5000)
  })
]);

export const taskPayloadSchema = z.object({
  corpusId: z.string().regex(/^[a-z0-9][a-z0-9-]{2,62}$/),
  topicId: z.string().regex(/^[a-f0-9]{40}$/),
  jobId: z.string().uuid(),
  generation: z.number().int().positive(),
  origin: z.enum(["user", "founder", "autonomous", "migration", "retry"])
});

export const institutionalTaskPayloadSchema = taskPayloadSchema.extend({
  // Deterministic policy revisions use a content-addressed run identifier. Normal
  // generation jobs remain UUID-only through taskPayloadSchema.
  jobId: z.union([z.string().uuid(), z.string().regex(/^[a-f0-9]{40}$/)]),
  packageId: z.string().uuid(),
  decision: z.enum(["routine", "exceptional"])
});

export const sourceCandidateSchema = z.object({
  sourceId: boundedText(3, 100),
  title: boundedText(2, 500),
  url: safeUrl,
  publisher: boundedText(2, 300),
  publisherOrigin: z.enum(["grounding_metadata", "hostname_inference"]),
  retrievedAt: z.string().datetime(),
  groundingChunkIndex: z.number().int().nonnegative()
});

export const groundedEvidenceSegmentSchema = z.object({
  evidenceRef: boundedText(3, 100),
  exactEvidence: boundedText(20, 4000),
  sourceRefs: z.array(boundedText(3, 100)).min(1).max(50),
  startIndex: z.number().int().nonnegative().nullable(),
  endIndex: z.number().int().nonnegative().nullable()
});

export const generatedEventSchema = z.object({
  date: boundedText(1, 100),
  datePrecision: z.enum(["year", "month", "day", "approximate"]),
  sortYear: z.number().int().min(-10000).max(3000),
  sortMonth: z.number().int().min(1).max(12).nullable(),
  sortDay: z.number().int().min(1).max(31).nullable(),
  title: boundedText(3, 240),
  description: boundedText(30, 1600),
  evidenceSummary: boundedText(20, 800),
  importance: z.number().int().min(1).max(5),
  location: z.string().trim().max(240).nullable(),
  sourceRefs: z.array(boundedText(3, 100)).min(1).max(3),
  evidenceRefs: z.array(boundedText(3, 100)).min(1).max(3),
  tags: z.array(boundedText(2, 80)).min(1).max(8)
}).refine((event) => event.evidenceSummary.toLocaleLowerCase("en-US") !== event.description.toLocaleLowerCase("en-US"), {
  path: ["evidenceSummary"],
  message: "Evidence summary must be distinct from the public event description."
}).superRefine((event, context) => {
  if (event.datePrecision === "day" && (event.sortMonth === null || event.sortDay === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Day precision requires sortMonth and sortDay." });
  }
  if (event.datePrecision === "month" && (event.sortMonth === null || event.sortDay !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Month precision requires sortMonth and no sortDay." });
  }
  if ((event.datePrecision === "year" || event.datePrecision === "approximate") && (event.sortMonth !== null || event.sortDay !== null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Year and approximate precision cannot invent month or day components." });
  }
});

function temporalInterval(event: { sortYear: number; sortMonth: number | null; sortDay: number | null }) {
  const month = event.sortMonth;
  const day = event.sortDay;
  const start = event.sortYear * 10_000 + (month ?? 1) * 100 + (day ?? 1);
  const endMonth = month ?? 12;
  const endDay = day ?? new Date(Date.UTC(event.sortYear, endMonth, 0)).getUTCDate();
  return { start, end: event.sortYear * 10_000 + endMonth * 100 + endDay };
}

export function compareHistoricalDates(
  left: { sortYear: number; sortMonth: number | null; sortDay: number | null },
  right: { sortYear: number; sortMonth: number | null; sortDay: number | null }
) {
  const l = temporalInterval(left);
  const r = temporalInterval(right);
  if (l.end < r.start) return -1;
  if (r.end < l.start) return 1;
  return 0;
}

export const generatedTimelineSchema = z.object({
  title: boundedText(3, 160),
  description: boundedText(60, 1600),
  category: boundedText(2, 80),
  tags: z.array(boundedText(2, 80)).min(2).max(12),
  events: z.array(generatedEventSchema).min(6).max(20)
}).superRefine((timeline, context) => {
  for (let index = 1; index < timeline.events.length; index += 1) {
    const previous = timeline.events[index - 1]!;
    const current = timeline.events[index]!;
    if (compareHistoricalDates(previous, current) > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["events", index],
        message: "Events must be ordered chronologically."
      });
    }
  }
});

const nullableBoundaryYear = z.number().int().min(-10000).max(3000).nullable();

export const timelineScopePlanSchema = z.object({
  topic: boundedText(3, 160),
  scopeSummary: boundedText(40, 1600),
  topicType: z.enum(["closed_episode", "ongoing_subject", "biography", "institution", "long_duration"]),
  startBoundary: boundedText(1, 160),
  startYear: nullableBoundaryYear,
  endBoundary: boundedText(1, 160),
  endYear: nullableBoundaryYear,
  isOngoing: z.boolean(),
  granularity: z.enum(["overview", "standard", "detailed"]).default("standard"),
  majorEras: z.array(z.object({
    eraId: boundedText(2, 80),
    label: boundedText(3, 160),
    startYear: nullableBoundaryYear,
    endYear: nullableBoundaryYear,
    rationale: boundedText(20, 600)
  })).min(2).max(16),
  majorDimensions: z.array(z.object({
    dimensionId: boundedText(2, 80),
    label: boundedText(3, 120),
    rationale: boundedText(20, 500)
  })).min(2).max(16),
  selectionPrinciples: z.array(boundedText(10, 400)).min(2).max(12),
  knownCoverageRisks: z.array(boundedText(10, 500)).max(12),
  subjectClass: z.enum(["episode", "conflict", "biography", "institution", "technology", "scientific_development", "cultural_intellectual_movement", "long_duration_subject", "ongoing_subject"]).optional(),
  titlePromise: boundedText(30, 800).optional(),
  inclusionRules: z.array(boundedText(10, 400)).min(1).max(12).optional(),
  exclusionRules: z.array(boundedText(10, 400)).min(1).max(12).optional(),
  openingCriterion: boundedText(20, 600).optional(),
  terminalCriterion: boundedText(20, 600).optional(),
  selectedSetRationale: boundedText(30, 1000).optional()
});

export const timelineCandidateSchema = z.object({
  candidateId: boundedText(1, 100),
  title: boundedText(3, 240),
  date: boundedText(1, 100),
  datePrecision: z.enum(["year", "month", "day", "approximate"]),
  sortYear: z.number().int().min(-10000).max(3000),
  sortMonth: z.number().int().min(1).max(12).nullable(),
  sortDay: z.number().int().min(1).max(31).nullable(),
  semanticType: z.enum(["EVENT", "STATE_LEGACY", "CONTEXT", "FUTURE"]),
  editorialClass: z.enum(["ESSENTIAL", "MAJOR", "SUPPORTING", "EXCLUDE"]).optional(),
  narrativeRole: z.enum(["OPENING", "TURNING_POINT", "MAJOR_DEVELOPMENT", "TERMINAL", "SUPPORTING", "CONTEXTUAL"]).optional(),
  selectionRationale: boundedText(20, 800).optional(),
  eraIds: z.array(boundedText(2, 80)).min(1).max(4),
  dimensionIds: z.array(boundedText(2, 80)).min(1).max(8),
  significance: z.object({
    consequence: z.number().int().min(1).max(5),
    structuralChange: z.number().int().min(1).max(5),
    innovation: z.number().int().min(1).max(5),
    adoption: z.number().int().min(1).max(5),
    institutionalImportance: z.number().int().min(1).max(5),
    socialImpact: z.number().int().min(1).max(5),
    persistence: z.number().int().min(1).max(5)
  }),
  significanceRationale: boundedText(20, 800),
  sourceRefs: z.array(boundedText(3, 100)).min(1).max(50),
  evidenceRefs: z.array(boundedText(3, 100)).min(1).max(50),
  selected: z.boolean(),
  rejectionReason: z.string().trim().min(10).max(600).nullable()
}).superRefine((candidate, context) => {
  if (candidate.selected && candidate.semanticType !== "EVENT") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selected"], message: "Only EVENT candidates are eligible for chronological selection." });
  }
  if (candidate.selected && candidate.rejectionReason !== null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Selected candidates cannot have a rejection reason." });
  }
  if (!candidate.selected && candidate.rejectionReason === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["rejectionReason"], message: "Rejected candidates require a reason." });
  }
  if (candidate.datePrecision === "day" && (candidate.sortMonth === null || candidate.sortDay === null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Day precision requires month and day." });
  if (candidate.datePrecision === "month" && (candidate.sortMonth === null || candidate.sortDay !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Month precision requires month and no day." });
  if ((candidate.datePrecision === "year" || candidate.datePrecision === "approximate") && (candidate.sortMonth !== null || candidate.sortDay !== null)) context.addIssue({ code: z.ZodIssueCode.custom, path: ["datePrecision"], message: "Coarse precision cannot carry invented month/day values." });
});

const omissionReviewItemSchema = z.object({
  development: boundedText(3, 300),
  significance: boundedText(10, 600),
  resolution: z.enum(["represented", "grounded_candidate_added", "not_applicable", "unresolved"]),
  classification: z.enum([
    "missing_material_milestone",
    "contextual_non_event_theme",
    "outside_declared_scope",
    "inappropriate_for_granularity",
    "already_adequately_represented"
  ]).optional(),
  candidateId: z.string().trim().min(1).max(100).nullable(),
  evidenceRefs: z.array(boundedText(3, 100)).max(50),
  rationale: boundedText(10, 800)
}).superRefine((omission, context) => {
  const represented = omission.resolution === "represented" || omission.resolution === "grounded_candidate_added";
  if (represented && omission.classification && omission.classification !== "already_adequately_represented") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classification"], message: "Represented omissions must be classified as already adequately represented." });
  }
  if (omission.classification === "already_adequately_represented" && (!represented || omission.candidateId === null)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["classification"], message: "Already represented omissions require a represented resolution and candidate." });
  }
  if (omission.classification === "missing_material_milestone" && omission.resolution !== "unresolved") {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["resolution"], message: "A missing material milestone must remain unresolved." });
  }
});

export const timelineEditorialPlanSchema = z.object({
  scope: timelineScopePlanSchema,
  candidates: z.array(timelineCandidateSchema).min(6).max(60),
  redundancyReview: z.array(z.object({
    candidateIds: z.array(boundedText(1, 100)).min(2).max(12),
    resolution: z.enum(["distinct", "merged", "excluded", "excessive_unresolved"]),
    rationale: boundedText(20, 800)
  })).max(20),
  omissionReview: z.array(omissionReviewItemSchema).max(20)
}).superRefine((plan, context) => {
  const selectedCount = plan.candidates.filter((candidate) => candidate.selected).length;
  if (selectedCount < 6 || selectedCount > 20) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["candidates"],
      message: `Editorial plans must select between 6 and 20 EVENT candidates; received ${selectedCount}.`
    });
  }
});

export const READER_EDITORIAL_CRITERIA = [
  "scope_fidelity",
  "chronological_intelligibility",
  "milestone_significance",
  "narrative_progression",
  "omission_severity",
  "redundancy",
  "temporal_balance",
  "title_summary_fidelity",
  "publication_worthiness"
] as const;

export const READER_EDITORIAL_FINDING_CODES = [
  "SCOPE_DRIFT",
  "CHRONOLOGY_UNCLEAR",
  "INSIGNIFICANT_MILESTONE",
  "NARRATIVE_DISCONTINUITY",
  "MATERIAL_OMISSION",
  "SUBSTANTIVE_REDUNDANCY",
  "TEMPORAL_IMBALANCE",
  "TITLE_SUMMARY_MISMATCH",
  "NOT_PUBLICATION_WORTHY"
] as const;

export const readerEditorialCriterionSchema = z.enum(READER_EDITORIAL_CRITERIA);

export const readerEditorialReviewSchema = z.object({
  criteria: z.array(z.object({
    criterion: readerEditorialCriterionSchema,
    verdict: z.enum(["passed", "failed"]),
    rationale: boundedText(20, 1200)
  }).strict()).length(9),
  findings: z.array(z.object({
    code: z.enum(READER_EDITORIAL_FINDING_CODES),
    severity: z.enum(["material", "minor"]),
    eventTitles: z.array(boundedText(3, 240)).max(20),
    rationale: boundedText(20, 1200)
  }).strict()).max(30),
  informedReaderVerdict: z.enum(["publication_worthy", "not_publication_worthy"]),
  summary: boundedText(40, 1600)
}).strict().superRefine((review, context) => {
  const expected = readerEditorialCriterionSchema.options;
  const received = review.criteria.map((criterion) => criterion.criterion);
  if (new Set(received).size !== expected.length || expected.some((criterion) => !received.includes(criterion))) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["criteria"], message: "Reader review must assess every criterion exactly once." });
  }
  const hasMaterialFinding = review.findings.some((finding) => finding.severity === "material");
  const hasFailedCriterion = review.criteria.some((criterion) => criterion.verdict === "failed");
  if (review.informedReaderVerdict === "publication_worthy" && (hasMaterialFinding || hasFailedCriterion)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["informedReaderVerdict"], message: "Publication-worthy verdict cannot coexist with a failed criterion or material finding." });
  }
});

export const discoverySchema = z.object({
  candidates: z.array(z.object({
    title: boundedText(3, 120),
    significance: boundedText(20, 600),
    relevanceScore: z.number().min(0).max(1)
  })).max(10)
});

export type TopicRequestInput = z.infer<typeof topicRequestSchema>;
export type TaskPayload = z.infer<typeof taskPayloadSchema>;
export type GeneratedTimeline = z.infer<typeof generatedTimelineSchema>;
export type TimelineScopePlan = z.infer<typeof timelineScopePlanSchema>;
export type TimelineEditorialPlan = z.infer<typeof timelineEditorialPlanSchema>;
export type TimelineCandidate = z.infer<typeof timelineCandidateSchema>;
export type ReaderEditorialReview = z.infer<typeof readerEditorialReviewSchema>;
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;
export type GroundedEvidenceSegment = z.infer<typeof groundedEvidenceSegmentSchema>;
