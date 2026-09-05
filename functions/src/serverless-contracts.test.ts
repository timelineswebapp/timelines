import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeTopic } from "./normalization";
import { generatedTimelineSchema, institutionalTaskPayloadSchema, taskPayloadSchema, timelineEditorialPlanSchema, topicRequestSchema } from "./schemas";
import { ACTIVE_CORPUS_ID } from "./config";

function event(sortYear: number, title: string) {
  return {
    date: String(Math.abs(sortYear)),
    datePrecision: "year" as const,
    sortYear,
    sortMonth: null,
    sortDay: null,
    title,
    description: `${title} is supported by grounded historical evidence and retained as a bounded milestone.`,
    evidenceSummary: `Grounded sources specifically support the chronology and historical significance of ${title}.`,
    importance: 4,
    location: null,
    sourceRefs: ["source-1"],
    evidenceRefs: ["evidence-1"],
    tags: ["History"]
  };
}

test("topic normalization is Unicode, punctuation, prefix, and whitespace stable", () => {
  const variants = [
    "History of the Printing Press",
    "  HISTORY—OF: the   Printing Press  ",
    "Timeline of the printing press"
  ].map((value) => normalizeTopic(value, "en", ACTIVE_CORPUS_ID));
  assert.equal(variants[0]!.topicId, variants[1]!.topicId);
  assert.equal(variants[0]!.topicId, variants[2]!.topicId);
  assert.equal(variants[0]!.normalizedTitle, "the printing press");
  assert.equal(variants[0]!.slug, "the-printing-press");
});

test("topic identity is isolated across corpus namespaces", () => {
  const clean = normalizeTopic("History of the Printing Press", "en", ACTIVE_CORPUS_ID);
  const legacy = normalizeTopic("History of the Printing Press", "en", "legacy-root");
  assert.notEqual(clean.topicId, legacy.topicId);
  assert.match(clean.scope, new RegExp(`^${ACTIVE_CORPUS_ID}:`));
});

test("generation schema accepts BCE chronology and rejects out-of-order authority", () => {
  const valid = {
    title: "A Durable Historical Topic",
    description: "A sufficiently detailed timeline description that explains the historical scope and evidentiary boundary for this test.",
    category: "History",
    tags: ["History", "Institutions"],
    events: [event(-300, "Early development"), event(-20, "Later BCE development"), event(100, "First CE development"), event(500, "Second CE development"), event(1000, "Medieval development"), event(1900, "Modern development")]
  };
  assert.equal(generatedTimelineSchema.parse(valid).events.length, 6);
  assert.equal(generatedTimelineSchema.safeParse({ ...valid, events: [...valid.events].reverse() }).success, false);
});

test("task payload rejects stale or unbounded identities", () => {
  assert.equal(taskPayloadSchema.safeParse({ topicId: "bad", jobId: "bad", generation: 0, origin: "user" }).success, false);
  assert.equal(taskPayloadSchema.safeParse({ corpusId: ACTIVE_CORPUS_ID, topicId: "a".repeat(40), jobId: "4af86d2f-1596-4b8c-a927-42e9e25b646d", generation: 1, origin: "user" }).success, true);
});

test("institutional tasks admit bounded content-addressed policy revisions without widening generation jobs", () => {
  const revision = { corpusId: ACTIVE_CORPUS_ID, topicId: "a".repeat(40), jobId: "b".repeat(40), generation: 2, origin: "founder", packageId: "dc01e8c2-fba4-55e3-9dd2-407af7dd3fee", decision: "routine" };
  assert.equal(taskPayloadSchema.safeParse(revision).success, false);
  assert.equal(institutionalTaskPayloadSchema.safeParse(revision).success, true);
  assert.equal(institutionalTaskPayloadSchema.safeParse({ ...revision, jobId: "b".repeat(41) }).success, false);
});

test("editorial plans reject provider over-selection before candidate composition", () => {
  const candidate = (index: number) => ({
    candidateId: `candidate-${index}`,
    title: `Material event ${index}`,
    date: String(1900 + index),
    datePrecision: "year" as const,
    sortYear: 1900 + index,
    sortMonth: null,
    sortDay: null,
    semanticType: "EVENT" as const,
    eraIds: ["era-1"],
    dimensionIds: ["dimension-1"],
    significance: { consequence: 4, structuralChange: 3, innovation: 2, adoption: 2, institutionalImportance: 3, socialImpact: 3, persistence: 3 },
    significanceRationale: "A materially significant event supported by the evidence.",
    sourceRefs: ["source-1"],
    evidenceRefs: ["evidence-1"],
    selected: true,
    rejectionReason: null
  });
  const scope = {
    topic: "Bounded historical episode",
    scopeSummary: "A sufficiently detailed closed historical episode used to validate bounded editorial selection behavior.",
    topicType: "closed_episode" as const,
    startBoundary: "1901",
    startYear: 1901,
    endBoundary: "1927",
    endYear: 1927,
    isOngoing: false,
    granularity: "standard" as const,
    majorEras: [
      { eraId: "era-1", label: "First era", startYear: 1901, endYear: 1913, rationale: "The opening phase contains the initial material developments." },
      { eraId: "era-2", label: "Second era", startYear: 1914, endYear: 1927, rationale: "The concluding phase contains the terminal material developments." }
    ],
    majorDimensions: [
      { dimensionId: "dimension-1", label: "Political", rationale: "Political decisions materially shaped this historical episode." },
      { dimensionId: "dimension-2", label: "Social", rationale: "Social consequences materially shaped this historical episode." }
    ],
    selectionPrinciples: ["Select materially significant chronological events.", "Retain complete evidence-backed era coverage."],
    knownCoverageRisks: []
  };
  const plan = { scope, candidates: Array.from({ length: 27 }, (_, index) => candidate(index + 1)), redundancyReview: [], omissionReview: [] };
  assert.equal(timelineEditorialPlanSchema.safeParse(plan).success, false);
  assert.equal(timelineEditorialPlanSchema.safeParse({ ...plan, candidates: plan.candidates.slice(0, 20) }).success, true);
});

test("visitor request contracts remain compatible and metadata is bounded", () => {
  const proposal = topicRequestSchema.parse({
    requestType: "timeline_proposal",
    query: "A proposed institutional history",
    language: "en",
    email: "editor@example.com",
    message: "Please consider this proposed timeline for editorial review.",
    sourcesScope: "Public archives and institutional publications should be evaluated.",
    metadata: { source: "site_navigation_drawer" }
  });
  assert.equal(proposal.requestType, "timeline_proposal");
  assert.equal(topicRequestSchema.safeParse({
    requestType: "general_contact",
    query: "General contact",
    language: "en",
    email: "editor@example.com",
    message: "A valid editorial contact message.",
    metadata: { oversized: "x".repeat(5000) }
  }).success, false);
});

test("generation schema rejects evidence that merely repeats public copy", () => {
  const repeated = event(1900, "Repeated evidence");
  repeated.evidenceSummary = repeated.description;
  assert.equal(generatedTimelineSchema.safeParse({
    title: "A Durable Historical Topic",
    description: "A sufficiently detailed timeline description that explains the historical scope and evidentiary boundary for this test.",
    category: "History",
    tags: ["History", "Institutions"],
    events: [repeated, event(1901, "Second"), event(1902, "Third"), event(1903, "Fourth"), event(1904, "Fifth"), event(1905, "Sixth")]
  }).success, false);
});

test("serverless implementation retains institutional separation and bounded execution", () => {
  const pipeline = readFileSync("src/pipeline.ts", "utf8");
  const vertex = readFileSync("src/vertex.ts", "utf8");
  const ledger = readFileSync("src/topic-ledger.ts", "utf8");
  const publicApi = readFileSync("src/public-api.ts", "utf8");
  const tasks = readFileSync("src/tasks.ts", "utf8");
  const config = readFileSync("src/config.ts", "utf8");
  const corpus = readFileSync("src/corpus.ts", "utf8");
  const index = readFileSync("src/index.ts", "utf8");
  for (const collection of ["factoryObjects", "corpusDocuments", "evidenceRecords", "evidenceValidations", "sourceAuthorityArtifacts", "governancePackages", "governanceDecisions", "libraryAdmissions", "publishedMemory", "platformReadModels"]) {
    assert.match(pipeline, new RegExp(`\"${collection}\"`));
  }
  assert.match(vertex, /tools: \[\{ googleSearch: \{\} \}\]/);
  assert.match(vertex, /responseJsonSchema/);
  assert.match(vertex, /normalizeGeneratedTimeline/);
  assert.match(vertex, /timelineEditorialPlanSchema\.parse/);
  assert.match(pipeline, /qualityArtifactRef/);
  assert.match(pipeline, /sourceAuthorityArtifactRef/);
  assert.match(pipeline, /sourceAuthorityVerdict !== "passed"/);
  assert.match(pipeline, /Candidate and Source Authority snapshot lineage do not match/);
  assert.match(pipeline, /reassessPersistedGeneration/);
  assert.match(pipeline, /Persisted reassessment requires an AWAITING_REVIEW topic/);
  assert.match(pipeline, /priorQualityArtifactId/);
  assert.match(ledger, /runTransaction/);
  assert.match(config, /priority-topic-generation/);
  assert.match(config, /autonomous-topic-generation/);
  assert.match(config, /institutional-transitions/);
  assert.match(tasks, /deadlineSeconds: 1800/);
  assert.match(pipeline, /enqueueInstitutionalTask/);
  assert.match(ledger, /retryDeferredEnqueues/);
  assert.match(ledger, /limit\(boundedLimit\)/);
  assert.match(ledger, /origin: "user"/);
  assert.match(ledger, /priority: 1000/);
  assert.match(ledger, /enqueueGenerationTask\(result\.task, true\)/);
  assert.match(ledger, /data\.origin !== "autonomous"/);
  assert.match(index, /promotions_suppressed_for_exceptional_review_backlog/);
  assert.match(index, /AUTONOMOUS_EXCEPTIONAL_REVIEW_BACKLOG/);
  assert.match(index, /autonomousReviewBacklog/);
  assert.match(publicApi, /input\.requestType === "timeline_request"/);
  assert.match(publicApi, /captureVisitorRequest/);
  assert.match(publicApi, /\.offset\(offset\)\s*\.limit\(limit\)/);
  assert.match(corpus, /db\.collection\("corpora"\)\.doc\(ACTIVE_CORPUS_ID\)\.collection\(name\)/);
  assert.match(corpus, /NO_LEGACY_CONTENT_REUSE/);
  assert.match(corpus, /VERTEX_GOOGLE_SEARCH_GROUNDING/);
  assert.match(index, /discard_unscoped_task/);
  for (const source of [pipeline, ledger, publicApi, index]) assert.doesNotMatch(source, /db\.collection\(/);
});
