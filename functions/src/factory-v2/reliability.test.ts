import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapPublisherRegistry } from "./authority";
import { buildEvidenceSegment } from "./contracts/builders";
import type { ResearchMap } from "./contracts";
import { admitSourcesByQuestion, institutionalRetrievalPriority, isDiscoveryRelevant, rankCoverageSourcesByQuestion, selectEvidencePacket, selectIndependentCoverageCandidates, selectUsableCoverageCandidates } from "./reliability";
import { TEST_CONTEXT } from "./test-fixtures";

const question = {
  questionId: "question-launch", text: "When did Apollo 11 launch from Kennedy Space Center?", phaseIds: ["phase-launch"], dimensionIds: ["dimension-operations"],
  claimTypesExpected: ["DATE", "OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Kennedy Space Center"], contested: false, dateCritical: true, priority: "CRITICAL", state: "UNRESEARCHED"
} as ResearchMap["questions"][number];

test("Evidence packet ranking preserves exact segments while rejecting navigation-first ordering", () => {
  const texts = ["Skip to content", "HOME", "Apollo 11 launched from Kennedy Space Center on July 16, 1969.", "Privacy and cookie settings"];
  const segments = texts.map((exactText, index) => buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-1", exactText, segmentType: "TEXT", startOffset: index * 100, endOffset: index * 100 + exactText.length, page: null, section: null, selector: null, extractionMethod: "SAFE_HTML_TEXT", sourceCompleteness: "FULL_SNAPSHOT" }));
  const packet = selectEvidencePacket({ question, segments, entityNames: ["Apollo 11"], maximumSegments: 2 });
  assert.equal(packet.segments.length, 1);
  assert.equal(packet.segments[0]!.exactText, texts[2]);
  assert.equal(packet.segments[0]!.evidenceSegmentId, segments[2]!.evidenceSegmentId);
});

function candidate(url: string, title: string, discoveryText: string, order: number, domain = new URL(url).hostname.replace(/^www\./u, "")) {
  return { canonicalUrl: url, originalUrl: url, title, discoveryText, domain, queryId: "query-1", researchQuestionIds: [question.questionId], role: "PHASE_DIMENSION" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, discoveryOrder: order };
}

test("coverage admission is gap-aware, temporal, event-aware, authoritative, bounded and deterministic", () => {
  const phaseQuestion = { ...question, text: "What authoritative dated developments occurred during Mobile Web 2010-2020?", phaseIds: ["phase-mobile"], dimensionIds: ["dimension-technology"] } as ResearchMap["questions"][number];
  const map = { phases: [{ phaseId: "phase-mobile", label: "Mobile Web (2010-2020)", temporalRule: "2010 through 2020", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-technology", label: "Technological Development", required: true, rationale: "locked" }], questions: [phaseQuestion] } as ResearchMap;
  const values = [
    candidate("https://www.w3.org/", "W3C", "The World Wide Web was created in 1989.", 0),
    candidate("https://www.w3.org/mobile/history", "Mobile Web standards history 2010-2020", "W3C released and adopted mobile standards in 2014 and 2018.", 1),
    candidate("https://en.wikipedia.org/wiki/Mobile_web", "Mobile web", "Launched in 2014", 2, "wikipedia.org"),
    candidate("https://example.edu/mobile", "Mobile Web chronology", "A conference adopted a standard in 2016.", 3)
  ];
  const publishers = bootstrapPublisherRegistry(TEST_CONTEXT);
  const first = rankCoverageSourcesByQuestion({ candidates: values, map, publishers, maximumSources: 3 });
  const second = rankCoverageSourcesByQuestion({ candidates: [...values].reverse(), map, publishers, maximumSources: 3 });
  assert.deepEqual(first, second);
  assert.equal(first.decisions.find((item) => item.domain === "wikipedia.org")?.disposition, "EXCLUDED_PROHIBITED");
  assert.equal(first.retrievalCandidates.some((item) => item.domain === "wikipedia.org"), false);
  assert.equal(first.decisions.some((item) => item.domain === "wikipedia.org"), true);
  assert.equal(first.retrievalCandidates[0]!.canonicalUrl, "https://www.w3.org/mobile/history");
  assert.ok(first.decisions.find((item) => item.canonicalUrl.includes("example.edu"))?.authorityEligibility === "PROVISIONAL");
  assert.ok(first.decisions.every((item) => Number.isFinite(item.admissionScore) && Object.keys(item.components).length === 7));
  assert.ok(first.retrievalCandidates.length <= 3);
});

test("verified authority status cannot admit a topic-irrelevant discovery page", () => {
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [question] } as ResearchMap;
  const irrelevant = candidate("https://www.archives.gov/press/2025-museum-redesign", "Museum redesign", "New interactive exhibits opened in 2025.", 0, "archives.gov");
  const relevant = candidate("https://www.nasa.gov/history/apollo-11-launch-1969", "Apollo 11 launch 1969", "Apollo 11 launched from Kennedy Space Center in 1969.", 1, "nasa.gov");
  const result = rankCoverageSourcesByQuestion({ candidates: [irrelevant, relevant], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 2 });
  assert.equal(isDiscoveryRelevant(irrelevant, question, map), false);
  assert.equal(result.decisions.find((item) => item.canonicalUrl === irrelevant.canonicalUrl)?.disposition, "EXCLUDED_IRRELEVANT");
  assert.deepEqual(result.retrievalCandidates.map((item) => item.canonicalUrl), [relevant.canonicalUrl]);
});

test("bounded completion may retrieve one question-bound verified authority when discovery metadata is lexically empty", () => {
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [question] } as ResearchMap;
  const boundButMetadataPoor = { ...candidate("https://www.nasa.gov/history/records", "Records", "", 0, "nasa.gov"), role: "AUTHORITY_TARGETED" as const };
  const defaultAdmission = rankCoverageSourcesByQuestion({ candidates: [boundButMetadataPoor], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 1 });
  const completionAdmission = rankCoverageSourcesByQuestion({ candidates: [boundButMetadataPoor], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 1, allowBoundAuthorityCompletionFallback: true });
  assert.equal(defaultAdmission.decisions[0]?.disposition, "EXCLUDED_IRRELEVANT");
  assert.deepEqual(defaultAdmission.retrievalCandidates, []);
  assert.equal(completionAdmission.decisions[0]?.disposition, "RETRIEVAL_CANDIDATE");
  assert.deepEqual(completionAdmission.retrievalCandidates.map((item) => item.canonicalUrl), [boundButMetadataPoor.canonicalUrl]);
});

test("bounded completion fallback never admits provisional or orientation-only discovery", () => {
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [question] } as ResearchMap;
  const provisional = { ...candidate("https://unknown.example/records", "Records", "", 0, "unknown.example"), role: "AUTHORITY_TARGETED" as const };
  const orientationOnly = { ...candidate("https://www.nasa.gov/records", "Records", "", 1, "nasa.gov"), role: "ORIENTATION" as const };
  const result = rankCoverageSourcesByQuestion({ candidates: [provisional, orientationOnly], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 2, allowBoundAuthorityCompletionFallback: true });
  assert.deepEqual(result.retrievalCandidates, []);
  assert.ok(result.decisions.every((item) => item.disposition !== "RETRIEVAL_CANDIDATE"));
});

test("generic development and press-release path terms cannot fake chronology relevance", () => {
  const chronologyQuestion = { ...question, questionId: "software-chronology-question-printing", text: "What discrete dated occurrences establish the chronology of The Development of the Printing Press?", phaseIds: ["phase-printing"], dimensionIds: ["dimension-printing"] } as ResearchMap["questions"][number];
  const map = { phases: [{ phaseId: "phase-printing", label: "Contemporary Developments", temporalRule: "modern printing developments", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-printing", label: "Printing technology", required: true, rationale: "locked" }], questions: [chronologyQuestion] } as ResearchMap;
  const irrelevant = { ...candidate("https://www.bl.uk/about/press/releases/groundbreaking-british-library-development-confirmed", "Groundbreaking British Library development confirmed", "", 0, "bl.uk"), researchQuestionIds: [chronologyQuestion.questionId] };
  assert.equal(isDiscoveryRelevant(irrelevant, chronologyQuestion, map), false);
  const result = rankCoverageSourcesByQuestion({ candidates: [irrelevant], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 1 });
  assert.equal(result.decisions[0]?.disposition, "EXCLUDED_IRRELEVANT");
});

test("coverage admission does not force diversity over materially stronger same-domain sources", () => {
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [question] } as ResearchMap;
  const values = [candidate("https://www.nasa.gov/a", "Apollo 11 launch 1969", "NASA launched Apollo 11 in 1969.", 1), candidate("https://www.nasa.gov/b", "Apollo 11 conference 1969", "NASA announced the launch in 1969.", 2), candidate("https://weak.example/general", "Apollo history", "General context", 0, "weak.example")];
  const result = rankCoverageSourcesByQuestion({ candidates: values, map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 2 });
  assert.deepEqual(result.retrievalCandidates.map((item) => item.domain), ["nasa.gov", "nasa.gov"]);
});

test("gap completion retrieval remains bounded to four ranked alternatives per question", () => {
  const map = {
    phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }],
    dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }],
    questions: [question]
  } as ResearchMap;
  const values = Array.from({ length: 10 }, (_, index) => candidate(`https://source-${index}.example/history`, `Source ${index}`, "Apollo 11 launched in 1969", index, `source-${index}.example`));
  const result = rankCoverageSourcesByQuestion({ candidates: values, map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 30 });
  assert.equal(result.retrievalCandidates.length, 4);
  assert.equal(result.decisions.filter((item) => item.disposition === "EXCLUDED_BUDGET").length, 6);
});

test("coverage extraction replaces an inaccessible higher-ranked source with the next bounded candidate", () => {
  const selected = selectUsableCoverageCandidates([
    { canonicalKey: "a", admissionScore: 500, usable: false },
    { canonicalKey: "b", admissionScore: 450, usable: true },
    { canonicalKey: "c", admissionScore: 400, usable: true },
    { canonicalKey: "d", admissionScore: 350, usable: true }
  ], 2);
  assert.deepEqual(selected.map((item) => item.canonicalKey), ["b", "c"]);
});

test("contested extraction prefers independent publisher groups before duplicate-group rank", () => {
  const selected = selectIndependentCoverageCandidates([
    { canonicalKey: "a", admissionScore: 500, usable: true, independenceGroupId: "group-1" },
    { canonicalKey: "b", admissionScore: 490, usable: true, independenceGroupId: "group-1" },
    { canonicalKey: "c", admissionScore: 450, usable: true, independenceGroupId: "group-2" }
  ], 2);
  assert.deepEqual(selected.map((item) => item.canonicalKey), ["a", "c"]);
});

test("initial admission excludes prohibited orientation sources and retains alternatives when the first authority is robots-denied or inaccessible", () => {
  const map = { questions: [question] } as ResearchMap;
  const candidates = [
    candidate("https://en.wikipedia.org/wiki/Apollo_11", "Apollo 11", "orientation", 0, "wikipedia.org"),
    candidate("https://www.nasa.gov/robots-denied", "NASA robots-denied", "Apollo 11 launch 1969", 1, "nasa.gov"),
    candidate("https://www.archives.gov/alternative", "NARA alternative", "Apollo 11 launch 1969", 2, "archives.gov"),
    candidate("https://airandspace.si.edu/alternative", "Museum alternative", "Apollo 11 launch 1969", 3, "airandspace.si.edu")
  ];
  const admitted = admitSourcesByQuestion({ candidates, map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 4 });
  assert.equal(admitted.some((item) => item.domain === "wikipedia.org"), false);
  assert.deepEqual(new Set(admitted.map((item) => item.domain)), new Set(["nasa.gov", "archives.gov", "airandspace.si.edu"]));
  const usable = selectUsableCoverageCandidates(admitted.map((item) => ({ ...item, canonicalKey: item.canonicalUrl, usable: !item.canonicalUrl.includes("robots-denied") })), 2);
  assert.deepEqual(usable.map((item) => item.domain).sort(), ["airandspace.si.edu", "archives.gov"]);
});

test("equally relevant verified authority outranks a provisional source", () => {
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [question] } as ResearchMap;
  const signal = "Apollo 11 launched from Kennedy Space Center in 1969.";
  const result = rankCoverageSourcesByQuestion({ candidates: [candidate("https://weak.example/launch", "Apollo 11 launch 1969", signal, 0, "weak.example"), candidate("https://www.nasa.gov/launch", "Apollo 11 launch 1969", signal, 1)], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 2 });
  assert.equal(result.retrievalCandidates[0]!.domain, "nasa.gov");
});

test("Source admission treats the global source budget as a ceiling and prioritizes diverse known authority per question", () => {
  const map = { questions: [question] } as ResearchMap;
  const candidates = [
    { canonicalUrl: "https://www.nasa.gov/a", originalUrl: "https://www.nasa.gov/a", title: "NASA A", domain: "nasa.gov", queryId: "query-1", researchQuestionIds: [question.questionId], role: "AUTHORITY_TARGETED" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, discoveryOrder: 1 },
    { canonicalUrl: "https://www.nasa.gov/b", originalUrl: "https://www.nasa.gov/b", title: "NASA B", domain: "nasa.gov", queryId: "query-1", researchQuestionIds: [question.questionId], role: "AUTHORITY_TARGETED" as const, intendedSourceClass: "PRIMARY_INSTITUTIONAL" as const, discoveryOrder: 2 },
    { canonicalUrl: "https://example.edu/history", originalUrl: "https://example.edu/history", title: "Academic", domain: "example.edu", queryId: "query-1", researchQuestionIds: [question.questionId], role: "PHASE_DIMENSION" as const, intendedSourceClass: "SCHOLARLY_SECONDARY" as const, discoveryOrder: 3 },
    { canonicalUrl: "https://en.wikipedia.org/wiki/Apollo_11", originalUrl: "https://en.wikipedia.org/wiki/Apollo_11", title: "Wikipedia", domain: "wikipedia.org", queryId: "query-1", researchQuestionIds: [question.questionId], role: "ORIENTATION" as const, intendedSourceClass: "WIKIPEDIA" as const, discoveryOrder: 0 }
  ];
  const admitted = admitSourcesByQuestion({ candidates, map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 60, perQuestion: 2 });
  assert.equal(admitted.length, 2);
  assert.equal(admitted[0]!.domain, "nasa.gov");
  assert.equal(new Set(admitted.map((item) => item.domain)).size, 2);
  assert.equal(admitted.some((item) => item.domain === "wikipedia.org"), false);
});

test("institutional research candidates outrank orientation sources without treating a suffix as authority", () => {
  const map = { questions: [question] } as ResearchMap;
  const academic = candidate("https://history.example.edu/archive", "University archive", "Apollo records", 2, "history.example.edu");
  const orientation = { ...candidate("https://weak.example/summary", "General summary", "Apollo records", 0, "weak.example"), role: "ORIENTATION" as const, intendedSourceClass: "OTHER" as const };
  const admitted = admitSourcesByQuestion({ candidates: [orientation, academic], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 1, perQuestion: 1 });
  assert.equal(admitted[0]!.domain, "history.example.edu");
  assert.equal(institutionalRetrievalPriority(academic), 70);
  assert.equal(institutionalRetrievalPriority({ ...academic, role: "ORIENTATION", intendedSourceClass: "OTHER" }), 0);
});

test("independent scholarship requirements reserve a discovered registered scholarly candidate", () => {
  const scholarlyQuestion = { ...question, historicalPerspectiveRequirements: [{ kind: "INDEPENDENT_SCHOLARSHIP" as const, label: "Independent scholarship", rationale: "Independent scholarly interpretation is materially required." }] };
  const map = { phases: [{ phaseId: "phase-launch", label: "Launch phase (1969-1970)", temporalRule: "1969 through 1970", required: true, rationale: "locked" }], dimensions: [{ dimensionId: "dimension-operations", label: "Operations", required: true, rationale: "locked" }], questions: [scholarlyQuestion] } as ResearchMap;
  const evidence = "Apollo 11 launched in 1969.";
  const result = rankCoverageSourcesByQuestion({ candidates: [
    candidate("https://www.nasa.gov/a", "Apollo 11 launch", evidence, 0, "nasa.gov"),
    candidate("https://www.nasa.gov/b", "Apollo 11 records", evidence, 1, "nasa.gov"),
    candidate("https://academic.oup.com/history/apollo", "Apollo scholarship", evidence, 2, "academic.oup.com")
  ], map, publishers: bootstrapPublisherRegistry(TEST_CONTEXT), maximumSources: 3 });
  assert.ok(result.retrievalCandidates.some((item) => item.domain === "academic.oup.com"));
});
