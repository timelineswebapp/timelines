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
});

export const generatedTimelineSchema = z.object({
  title: boundedText(3, 160),
  description: boundedText(60, 1600),
  category: boundedText(2, 80),
  tags: z.array(boundedText(2, 80)).min(2).max(12),
  events: z.array(generatedEventSchema).min(6).max(20)
}).superRefine((timeline, context) => {
  const compareChronology = (left: z.infer<typeof generatedEventSchema>, right: z.infer<typeof generatedEventSchema>) => {
    const leftKey = [left.sortYear, left.sortMonth ?? 0, left.sortDay ?? 0];
    const rightKey = [right.sortYear, right.sortMonth ?? 0, right.sortDay ?? 0];
    for (let index = 0; index < leftKey.length; index += 1) {
      if (leftKey[index]! < rightKey[index]!) return -1;
      if (leftKey[index]! > rightKey[index]!) return 1;
    }
    return 0;
  };
  for (let index = 1; index < timeline.events.length; index += 1) {
    const previous = timeline.events[index - 1]!;
    const current = timeline.events[index]!;
    if (compareChronology(previous, current) > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["events", index],
        message: "Events must be ordered chronologically."
      });
    }
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
export type SourceCandidate = z.infer<typeof sourceCandidateSchema>;
export type GroundedEvidenceSegment = z.infer<typeof groundedEvidenceSegmentSchema>;
