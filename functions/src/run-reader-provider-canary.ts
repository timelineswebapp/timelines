import { assessReaderEditorialReview } from "./editorial-reader";
import type { GeneratedTimeline, TimelineEditorialPlan } from "./schemas";
import { generateReaderEditorialReview } from "./vertex";

function fixture() {
  const events = ["Opening", "Escalation", "Decision", "Turning Point", "Resolution", "Aftermath Boundary"].map((title, index) => ({
    date: `October ${16 + index}, 1962`,
    datePrecision: "day" as const,
    sortYear: 1962,
    sortMonth: 10,
    sortDay: 16 + index,
    title,
    description: `${title} materially changes the bounded synthetic episode and is explained in chronological context for the reader.`,
    evidenceSummary: `The synthetic fixture evidence supports the date and declared narrative role of ${title}.`,
    importance: 5,
    location: null,
    sourceRefs: ["source-1"],
    evidenceRefs: ["evidence-1"],
    tags: ["provider-canary"]
  }));
  const timeline: GeneratedTimeline = {
    title: "A Synthetic Bounded Crisis",
    description: "A coherent synthetic provider-contract fixture progressing from a clear opening through resolution and an immediate terminal boundary.",
    category: "Provider Canary",
    tags: ["provider-canary", "non-public"],
    events
  };
  const plan = {
    scope: {
      topic: timeline.title,
      scopeSummary: timeline.description,
      subjectClass: "episode" as const,
      titlePromise: "Explain the complete synthetic crisis from opening through its immediate terminal boundary.",
      inclusionRules: ["Include only discrete events that materially change the synthetic episode."],
      exclusionRules: ["Exclude background states, later legacy, and events outside the bounded interval."],
      openingCriterion: "The first selected event initiates the bounded episode.",
      terminalCriterion: "The final selected event marks its immediate terminal boundary.",
      selectedSetRationale: "The six events provide the minimum coherent opening, escalation, decision, turning point, resolution, and terminal boundary.",
      topicType: "closed_episode" as const,
      startBoundary: "October 16, 1962",
      startYear: 1962,
      endBoundary: "October 21, 1962",
      endYear: 1962,
      isOngoing: false,
      granularity: "standard" as const,
      majorEras: [
        { eraId: "opening", label: "Opening", startYear: 1962, endYear: 1962, rationale: "The synthetic episode opens and escalates." },
        { eraId: "resolution", label: "Resolution", startYear: 1962, endYear: 1962, rationale: "The episode turns and reaches its terminal boundary." }
      ],
      majorDimensions: [
        { dimensionId: "political", label: "Political", rationale: "Decisions drive the synthetic episode." },
        { dimensionId: "operational", label: "Operational", rationale: "Operational changes establish its sequence." }
      ],
      selectionPrinciples: ["Select indispensable trajectory-changing events.", "Exclude context and legacy from chronology."],
      knownCoverageRisks: []
    },
    candidates: events.map((event, index) => ({
      candidateId: `candidate-${index}`,
      title: event.title,
      date: event.date,
      datePrecision: event.datePrecision,
      sortYear: event.sortYear,
      sortMonth: event.sortMonth,
      sortDay: event.sortDay,
      semanticType: "EVENT" as const,
      editorialClass: index === 0 || index === 3 || index === 5 ? "ESSENTIAL" as const : "MAJOR" as const,
      narrativeRole: index === 0 ? "OPENING" as const : index === 3 ? "TURNING_POINT" as const : index === 5 ? "TERMINAL" as const : "MAJOR_DEVELOPMENT" as const,
      eraIds: [index < 3 ? "opening" : "resolution"],
      dimensionIds: [index % 2 ? "political" : "operational"],
      significance: { consequence: 5, structuralChange: 5, innovation: 1, adoption: 1, institutionalImportance: 5, socialImpact: 4, persistence: 4 },
      significanceRationale: "This synthetic event materially changes the episode trajectory.",
      selectionRationale: "This event is necessary for the declared reader-facing progression.",
      sourceRefs: ["source-1"],
      evidenceRefs: ["evidence-1"],
      selected: true,
      rejectionReason: null
    })),
    redundancyReview: [],
    omissionReview: []
  } satisfies TimelineEditorialPlan;
  return { plan, timeline };
}

async function main() {
  const valid = fixture();
  const validResult = await generateReaderEditorialReview(valid.timeline.title, valid.plan, valid.timeline);
  const validAssessment = assessReaderEditorialReview({ ...valid, review: validResult.review });
  if (validAssessment.verdict !== "passed") throw new Error(`Valid reader canary failed: ${validAssessment.unresolvedReasons.join(" | ")}`);

  const invalidTimeline: GeneratedTimeline = structuredClone(valid.timeline);
  invalidTimeline.events[0] = { ...invalidTimeline.events[0]!, title: "Unselected Replacement Opening" };
  const invalidResult = await generateReaderEditorialReview(invalidTimeline.title, valid.plan, invalidTimeline);
  const invalidAssessment = assessReaderEditorialReview({ plan: valid.plan, timeline: invalidTimeline, review: invalidResult.review });
  if (invalidAssessment.verdict !== "failed" || !invalidAssessment.unresolvedReasons.some((reason) => reason.includes("SELECTION_COMPOSITION_MISMATCH"))) {
    throw new Error("Invalid reader canary did not fail closed on candidate-to-composition mismatch.");
  }

  console.log(JSON.stringify({
    canary: "TL-EDITORIAL-EXCELLENCE-001C",
    persistence: "none",
    provider: {
      projectId: validResult.execution.projectId,
      location: validResult.execution.location,
      model: validResult.execution.model,
      promptVersion: validResult.execution.promptVersion,
      schemaVersion: validResult.execution.schemaVersion
    },
    valid: { verdict: validAssessment.verdict, providerCallCount: validResult.providerCallCount, criteriaCount: validAssessment.criteria.length },
    invalid: { verdict: invalidAssessment.verdict, providerCallCount: invalidResult.providerCallCount, reasons: invalidAssessment.unresolvedReasons }
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
