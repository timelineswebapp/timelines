import { readerEditorialReviewSchema, type GeneratedTimeline, type ReaderEditorialReview, type TimelineEditorialPlan } from "./schemas";

export const READER_EDITORIAL_POLICY_VERSION = "reader-editorial-v1" as const;

export type ReaderEditorialAssessment = {
  policyVersion: typeof READER_EDITORIAL_POLICY_VERSION;
  verdict: "passed" | "failed";
  criteria: ReaderEditorialReview["criteria"];
  findings: ReaderEditorialReview["findings"];
  informedReaderVerdict: ReaderEditorialReview["informedReaderVerdict"];
  summary: string;
  unresolvedReasons: string[];
};

function normalizedTitle(value: string): string {
  return value.toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/gu, " ").trim();
}

export function assessReaderEditorialReview(input: {
  plan: TimelineEditorialPlan;
  timeline: GeneratedTimeline;
  review: ReaderEditorialReview;
}): ReaderEditorialAssessment {
  const review = readerEditorialReviewSchema.parse(input.review);
  const timelineTitles = new Set(input.timeline.events.map((event) => normalizedTitle(event.title)));
  const unresolvedReasons: string[] = [];

  for (const criterion of review.criteria) {
    if (criterion.verdict === "failed") unresolvedReasons.push(`reader:${criterion.criterion}:${criterion.rationale}`);
  }
  for (const finding of review.findings) {
    for (const eventTitle of finding.eventTitles) {
      if (!timelineTitles.has(normalizedTitle(eventTitle))) {
        unresolvedReasons.push(`reader:unknown_event_reference:${eventTitle}`);
      }
    }
    if (finding.severity === "material") unresolvedReasons.push(`reader:${finding.code}:${finding.rationale}`);
  }
  if (review.informedReaderVerdict !== "publication_worthy") {
    unresolvedReasons.push(`reader:NOT_PUBLICATION_WORTHY:${review.summary}`);
  }

  const selectedTitles = input.plan.candidates
    .filter((candidate) => candidate.selected && candidate.semanticType === "EVENT")
    .map((candidate) => normalizedTitle(candidate.title));
  const composedTitles = input.timeline.events.map((event) => normalizedTitle(event.title));
  if (selectedTitles.length !== composedTitles.length || selectedTitles.some((title) => !timelineTitles.has(title))) {
    unresolvedReasons.push("reader:SELECTION_COMPOSITION_MISMATCH:The complete reader product does not match the selected EVENT set.");
  }

  const uniqueReasons = [...new Set(unresolvedReasons)];
  return {
    policyVersion: READER_EDITORIAL_POLICY_VERSION,
    verdict: uniqueReasons.length === 0 ? "passed" : "failed",
    criteria: review.criteria,
    findings: review.findings,
    informedReaderVerdict: review.informedReaderVerdict,
    summary: review.summary,
    unresolvedReasons: uniqueReasons
  };
}
