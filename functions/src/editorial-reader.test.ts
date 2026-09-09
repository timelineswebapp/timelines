import assert from "node:assert/strict";
import test from "node:test";
import { assessReaderEditorialReview } from "./editorial-reader";
import type { GeneratedTimeline, ReaderEditorialReview, TimelineEditorialPlan } from "./schemas";
import { parseReaderEditorialJson } from "./vertex";

const criteria = [
  "scope_fidelity", "chronological_intelligibility", "milestone_significance", "narrative_progression",
  "omission_severity", "redundancy", "temporal_balance", "title_summary_fidelity", "publication_worthiness"
] as const;

function fixture() {
  const events = ["Opening", "Escalation", "Decision", "Turning Point", "Resolution", "Aftermath Boundary"].map((title, index) => ({
    date: `October ${16 + index}, 1962`, datePrecision: "day" as const, sortYear: 1962, sortMonth: 10, sortDay: 16 + index,
    title, description: `${title} materially changes the bounded historical episode and is explained with grounded historical evidence.`,
    evidenceSummary: `Exact evidence supports the date and historical role of ${title}.`, importance: 5, location: null,
    sourceRefs: ["source-1"], evidenceRefs: ["evidence-1"], tags: ["history"]
  }));
  const timeline: GeneratedTimeline = { title: "A Bounded Crisis", description: "A coherent account of the crisis from opening through its resolution and immediate boundary.", category: "History", tags: ["history", "crisis"], events };
  const plan = {
    scope: { topic: timeline.title, scopeSummary: timeline.description, topicType: "closed_episode", startBoundary: "October 16, 1962", startYear: 1962, endBoundary: "October 21, 1962", endYear: 1962, isOngoing: false, granularity: "standard", majorEras: [{ eraId: "opening", label: "Opening", startYear: 1962, endYear: 1962, rationale: "The episode opens and develops during this bounded phase." }, { eraId: "resolution", label: "Resolution", startYear: 1962, endYear: 1962, rationale: "The episode turns and reaches its declared terminal boundary." }], majorDimensions: [{ dimensionId: "political", label: "Political", rationale: "Political decisions drive the bounded historical episode." }, { dimensionId: "operational", label: "Operational", rationale: "Operational changes explain the historical sequence." }], selectionPrinciples: ["Select indispensable trajectory-changing events.", "Exclude context and legacy from chronology."], knownCoverageRisks: [] },
    candidates: events.map((event, index) => ({ candidateId: `candidate-${index}`, title: event.title, date: event.date, datePrecision: event.datePrecision, sortYear: event.sortYear, sortMonth: event.sortMonth, sortDay: event.sortDay, semanticType: "EVENT" as const, eraIds: [index < 3 ? "opening" : "resolution"], dimensionIds: [index % 2 ? "political" : "operational"], significance: { consequence: 5, structuralChange: 5, innovation: 1, adoption: 1, institutionalImportance: 5, socialImpact: 4, persistence: 4 }, significanceRationale: "This event materially changes the episode trajectory.", sourceRefs: ["source-1"], evidenceRefs: ["evidence-1"], selected: true, rejectionReason: null })),
    redundancyReview: [], omissionReview: []
  } satisfies TimelineEditorialPlan;
  return { plan, timeline };
}

function passingReview(): ReaderEditorialReview {
  return { criteria: criteria.map((criterion) => ({ criterion, verdict: "passed", rationale: `The complete product passes ${criterion} under informed reader review.` })), findings: [], informedReaderVerdict: "publication_worthy", summary: "The selected milestones form a coherent, scoped, non-redundant, and publication-worthy historical progression." };
}

test("production reader JSON extraction accepts only raw objects or one exact JSON fence", () => {
  assert.deepEqual(parseReaderEditorialJson('{"criteria":[]}'), { criteria: [] });
  assert.deepEqual(parseReaderEditorialJson('```json\n{"criteria":[]}\n```'), { criteria: [] });
  assert.throws(() => parseReaderEditorialJson('Result: {"criteria":[]}'), /exactly one JSON object/);
  assert.throws(() => parseReaderEditorialJson('```json\n{"criteria":[]}\n```\nextra'), /exactly one JSON object/);
});

test("reader-level assessment passes only a complete clean nine-criterion review", () => {
  const input = fixture();
  assert.equal(assessReaderEditorialReview({ ...input, review: passingReview() }).verdict, "passed");
});

test("material omission and not-publication-worthy verdict fail closed", () => {
  const input = fixture();
  const review = passingReview();
  review.criteria.find((criterion) => criterion.criterion === "omission_severity")!.verdict = "failed";
  review.findings.push({ code: "MATERIAL_OMISSION", severity: "material", eventTitles: [], rationale: "The decisive diplomatic settlement is absent from the selected chronology." });
  review.informedReaderVerdict = "not_publication_worthy";
  review.summary = "The timeline is coherent in part but omits the decisive settlement and is not publication-worthy.";
  const result = assessReaderEditorialReview({ ...input, review });
  assert.equal(result.verdict, "failed");
  assert.match(result.unresolvedReasons.join("\n"), /MATERIAL_OMISSION/);
});

test("reader findings cannot refer to events outside the immutable composed product", () => {
  const input = fixture();
  const review = passingReview();
  review.findings.push({ code: "INSIGNIFICANT_MILESTONE", severity: "minor", eventTitles: ["Invented event"], rationale: "This finding attempts to reference an event absent from the composed timeline." });
  const result = assessReaderEditorialReview({ ...input, review });
  assert.equal(result.verdict, "failed");
  assert.match(result.unresolvedReasons.join("\n"), /unknown_event_reference/);
});

test("reader review cannot override candidate-to-composition mismatch", () => {
  const input = fixture();
  input.timeline.events[0]!.title = "Different opening";
  const result = assessReaderEditorialReview({ ...input, review: passingReview() });
  assert.equal(result.verdict, "failed");
  assert.match(result.unresolvedReasons.join("\n"), /SELECTION_COMPOSITION_MISMATCH/);
});

test("reader gate rejects famous but peripheral padding, paraphrased redundancy, imbalance, and title mismatch", () => {
  const input = fixture();
  const cases: Array<{ finding: ReaderEditorialReview["findings"][number]; criterion: ReaderEditorialReview["criteria"][number]["criterion"] }> = [
    { criterion: "milestone_significance", finding: { code: "INSIGNIFICANT_MILESTONE", severity: "material", eventTitles: ["Decision"], rationale: "This culturally famous item is peripheral to the declared subject and displaces a material milestone." } },
    { criterion: "redundancy", finding: { code: "SUBSTANTIVE_REDUNDANCY", severity: "material", eventTitles: ["Escalation", "Decision"], rationale: "These differently titled cards describe the same historical development at overlapping granularity." } },
    { criterion: "temporal_balance", finding: { code: "TEMPORAL_IMBALANCE", severity: "material", eventTitles: [], rationale: "The selected chronology concentrates on the opening and leaves the decisive later phase inadequately represented." } },
    { criterion: "title_summary_fidelity", finding: { code: "TITLE_SUMMARY_MISMATCH", severity: "material", eventTitles: [], rationale: "The public title promises the complete crisis while the summary and selected chronology cover only its opening phase." } }
  ];
  for (const { finding, criterion } of cases) {
    const review = passingReview();
    review.findings = [finding];
    review.criteria.find((item) => item.criterion === criterion)!.verdict = "failed";
    review.informedReaderVerdict = "not_publication_worthy";
    const result = assessReaderEditorialReview({ ...input, review });
    assert.equal(result.verdict, "failed", finding.code);
    assert.match(result.unresolvedReasons.join("\n"), new RegExp(finding.code));
  }
});
