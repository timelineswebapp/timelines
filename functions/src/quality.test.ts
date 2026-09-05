import assert from "node:assert/strict";
import test from "node:test";
import { assessEditorialPlan, assessTimelineQuality, normalizeGeneratedTimeline } from "./quality";
import { evaluateRoutinePolicy } from "./pipeline";
import type { GeneratedTimeline, TimelineEditorialPlan } from "./schemas";

const significance = { consequence: 5, structuralChange: 4, innovation: 4, adoption: 4, institutionalImportance: 4, socialImpact: 4, persistence: 5 };

function fixture(input: { topic: string; type: TimelineEditorialPlan["scope"]["topicType"]; ongoing: boolean; start: number; end: number | null; eras: Array<{ id: string; start: number; end: number }>; events: Array<{ year: number; title: string; era: string }> }) {
  const plan: TimelineEditorialPlan = {
    scope: {
      topic: input.topic,
      scopeSummary: `A bounded editorial history of ${input.topic} across its major transformations and enduring consequences.`,
      topicType: input.type,
      startBoundary: String(input.start), startYear: input.start,
      endBoundary: input.ongoing ? "Present" : String(input.end), endYear: input.end,
      isOngoing: input.ongoing, granularity: "standard",
      majorEras: input.eras.map((era) => ({ eraId: era.id, label: `${era.id} historical phase`, startYear: era.start, endYear: era.end, rationale: "This phase marks a distinct structural period in the subject history." })),
      majorDimensions: [
        { dimensionId: "political", label: "Political change", rationale: "Institutional decisions shape the subject trajectory." },
        { dimensionId: "social", label: "Social impact", rationale: "Adoption and consequences affect wider society." }
      ],
      selectionPrinciples: ["Prefer consequential turning points with durable effects.", "Represent every major era without padding the event count."],
      knownCoverageRisks: ["Available evidence may emphasize the best documented early period."]
    },
    candidates: input.events.map((event, index) => ({
      candidateId: `candidate-${index + 1}`, title: event.title, date: String(event.year), sortYear: event.year,
      eraIds: [event.era], dimensionIds: [index % 2 ? "social" : "political"], significance,
      significanceRationale: "This milestone materially changes the later development and understanding of the subject.",
      sourceRefs: ["source-1"], evidenceRefs: ["evidence-1"], selected: true, rejectionReason: null
    })),
    redundancyReview: [{ candidateIds: ["candidate-1", "candidate-2"], resolution: "distinct", rationale: "The milestones mark separate structural changes rather than duplicate descriptions." }],
    omissionReview: [{ development: "Expected defining transition", significance: "A knowledgeable reader would expect the defining transition to be represented.", resolution: "represented", candidateId: "candidate-1", evidenceRefs: ["evidence-1"], rationale: "The defining transition is represented by a selected grounded candidate." }]
  };
  const timeline: GeneratedTimeline = {
    title: input.topic,
    description: `This timeline presents the major transformations in ${input.topic} with balanced chronological coverage and grounded milestones.`,
    category: "History", tags: ["history", "society"],
    events: input.events.map((event) => ({ date: String(event.year), datePrecision: "year", sortYear: event.year, sortMonth: null, sortDay: null, title: event.title, description: `This event represents a consequential historical change associated with ${event.title} and its later effects.`, evidenceSummary: "The grounded evidence identifies the date and explains the milestone's historical consequence.", importance: 5, location: null, sourceRefs: ["source-1"], evidenceRefs: ["evidence-1"], tags: ["history"] }))
  };
  return { plan, timeline };
}

function assess(value: ReturnType<typeof fixture>, currentYear = 2026) {
  return assessTimelineQuality({ ...value, allowedSourceRefs: new Set(["source-1"]), allowedEvidenceRefs: new Set(["evidence-1"]), currentYear });
}

test("World Wide Web regression rejects an early-heavy timeline ending in 2004", () => {
  const old = fixture({ topic: "The History of the World Wide Web", type: "ongoing_subject", ongoing: true, start: 1989, end: null,
    eras: [{ id: "foundations", start: 1989, end: 1994 }, { id: "commercial", start: 1995, end: 2004 }, { id: "social-mobile", start: 2005, end: 2015 }, { id: "modern", start: 2016, end: 2026 }],
    events: [1989, 1990, 1991, 1992, 1994, 2004].map((year, index) => ({ year, title: `Web milestone ${index + 1}`, era: year <= 1994 ? "foundations" : "commercial" })) });
  const result = assess(old);
  assert.equal(result.verdict, "failed");
  assert.equal(result.checks.eraCoverage.status, "failed");
  assert.equal(result.checks.endpointCoverage.status, "failed");
});

test("World Wide Web replacement passes balanced era and modern endpoint gates", () => {
  const modern = fixture({ topic: "The History of the World Wide Web", type: "ongoing_subject", ongoing: true, start: 1989, end: null,
    eras: [{ id: "foundations", start: 1989, end: 1994 }, { id: "commercial", start: 1995, end: 2004 }, { id: "social-mobile", start: 2005, end: 2015 }, { id: "modern", start: 2016, end: 2026 }],
    events: [{ year: 1989, title: "The Web is proposed", era: "foundations" }, { year: 1991, title: "The Web opens publicly", era: "foundations" }, { year: 1995, title: "Commercial adoption accelerates", era: "commercial" }, { year: 2004, title: "Participatory platforms expand", era: "commercial" }, { year: 2007, title: "Mobile browsing becomes mainstream", era: "social-mobile" }, { year: 2014, title: "Modern standards converge", era: "social-mobile" }, { year: 2016, title: "Secure delivery becomes standard", era: "modern" }, { year: 2023, title: "The modern platform web evolves", era: "modern" }] });
  assert.equal(assess(modern).verdict, "passed");
});

test("heterogeneous closed, long-duration, and biography fixtures pass", () => {
  const fixtures = [
    fixture({ topic: "The French Revolution", type: "closed_episode", ongoing: false, start: 1789, end: 1799, eras: [{ id: "collapse", start: 1789, end: 1791 }, { id: "republic", start: 1792, end: 1794 }, { id: "directory", start: 1795, end: 1799 }], events: [{ year: 1789, title: "Estates-General convenes", era: "collapse" }, { year: 1791, title: "Constitution restructures France", era: "collapse" }, { year: 1792, title: "The Republic is proclaimed", era: "republic" }, { year: 1794, title: "The Terror ends", era: "republic" }, { year: 1795, title: "The Directory begins", era: "directory" }, { year: 1799, title: "The Consulate succeeds the Directory", era: "directory" }] }),
    fixture({ topic: "The History of Astronomy", type: "long_duration", ongoing: true, start: -2000, end: null, eras: [{ id: "ancient", start: -2000, end: 499 }, { id: "early-modern", start: 500, end: 1799 }, { id: "modern", start: 1800, end: 2026 }], events: [{ year: -1800, title: "Systematic sky records emerge", era: "ancient" }, { year: 150, title: "A geocentric synthesis is compiled", era: "ancient" }, { year: 1543, title: "Heliocentric astronomy is published", era: "early-modern" }, { year: 1687, title: "Gravity unifies celestial motion", era: "early-modern" }, { year: 1929, title: "Cosmic expansion is established", era: "modern" }, { year: 2022, title: "A new infrared observatory begins science", era: "modern" }] }),
    fixture({ topic: "The Life of Marie Curie", type: "biography", ongoing: false, start: 1867, end: 1934, eras: [{ id: "formation", start: 1867, end: 1894 }, { id: "discovery", start: 1895, end: 1906 }, { id: "leadership", start: 1907, end: 1934 }], events: [{ year: 1867, title: "Maria Skłodowska is born", era: "formation" }, { year: 1891, title: "She begins study in Paris", era: "formation" }, { year: 1898, title: "Polonium and radium are announced", era: "discovery" }, { year: 1903, title: "The Nobel Prize recognizes radiation research", era: "discovery" }, { year: 1914, title: "Curie directs wartime radiology work", era: "leadership" }, { year: 1934, title: "Marie Curie dies", era: "leadership" }] })
  ];
  for (const value of fixtures) assert.equal(assess(value).verdict, "passed", value.plan.scope.topic);
});

test("deterministic normalization sorts events and retains strongest three attributable references", () => {
  const event = (year: number, title: string) => ({ date: String(year), datePrecision: "year", sortYear: year, sortMonth: null, sortDay: null, title: ` ${title} `, description: " A sufficiently detailed description of this grounded historical milestone and consequence. ", evidenceSummary: " Grounded evidence supports the milestone date and its historical importance. ", importance: 4, location: null, sourceRefs: ["source-4", "source-2", "source-1", "source-3", "source-2"], evidenceRefs: ["evidence-1", "evidence-2", "evidence-3", "evidence-4"], tags: [" web ", "web", "history"] });
  const normalized = normalizeGeneratedTimeline({ title: " Test Timeline ", description: " A sufficiently detailed timeline description that is long enough for schema validation and public presentation. ", category: " History ", tags: [" history ", "history", "technology"], events: [event(2000, "Later milestone"), event(1990, "Earlier milestone"), event(2001, "Third milestone"), event(2002, "Fourth milestone"), event(2003, "Fifth milestone"), event(2004, "Sixth milestone")] }, [
    { evidenceRef: "evidence-1", exactEvidence: "Exact grounded evidence segment long enough for validation.", sourceRefs: ["source-1", "source-2"], startIndex: null, endIndex: null },
    { evidenceRef: "evidence-2", exactEvidence: "Another exact grounded evidence segment for this milestone.", sourceRefs: ["source-2", "source-3"], startIndex: null, endIndex: null },
    { evidenceRef: "evidence-3", exactEvidence: "A third exact grounded evidence segment for this milestone.", sourceRefs: ["source-4"], startIndex: null, endIndex: null },
    { evidenceRef: "evidence-4", exactEvidence: "A fourth exact grounded evidence segment that is retained internally.", sourceRefs: ["source-4"], startIndex: null, endIndex: null }
  ]);
  assert.equal(normalized.events[0]!.sortYear, 1990);
  assert.deepEqual(normalized.events[0]!.sourceRefs, ["source-2", "source-4", "source-1"]);
  assert.deepEqual(normalized.events[0]!.evidenceRefs, ["evidence-1", "evidence-2", "evidence-3"]);
  assert.deepEqual(normalized.tags, ["history", "technology"]);
});

test("Governance routes failed editorial quality to human review and accepts a passing fixture", () => {
  const value = fixture({ topic: "A Governed Institution", type: "institution", ongoing: true, start: 1900, end: null, eras: [{ id: "formation", start: 1900, end: 1949 }, { id: "growth", start: 1950, end: 1999 }, { id: "modern", start: 2000, end: 2026 }], events: [{ year: 1900, title: "The institution is founded", era: "formation" }, { year: 1930, title: "Its mandate expands", era: "formation" }, { year: 1960, title: "A new charter is adopted", era: "growth" }, { year: 1990, title: "International operations begin", era: "growth" }, { year: 2010, title: "Digital services launch", era: "modern" }, { year: 2024, title: "Modern governance is established", era: "modern" }] });
  const quality = assess(value);
  const sources = ["source-1", "source-2"].map((sourceId, index) => ({ sourceId, title: `Source ${index + 1}`, url: `https://example${index + 1}.com/source`, publisher: `Publisher ${index + 1}`, publisherOrigin: "grounding_metadata" as const, retrievedAt: "2026-01-01T00:00:00.000Z", groundingChunkIndex: index }));
  assert.equal(evaluateRoutinePolicy(value.timeline, sources, quality).outcome, "routine");
  const failedQuality = { ...quality, verdict: "failed" as const, unresolvedReasons: ["eraCoverage:missing modern era"] };
  const decision = evaluateRoutinePolicy(value.timeline, sources, failedQuality);
  assert.equal(decision.outcome, "exceptional");
  assert.match(decision.reasons.join(" "), /timeline_quality:eraCoverage/);
});

test("closed-topic events cannot exceed declared boundaries", () => {
  const value = fixture({ topic: "A Closed Historical Episode", type: "closed_episode", ongoing: false, start: 1900, end: 1910, eras: [{ id: "opening", start: 1900, end: 1903 }, { id: "turning", start: 1904, end: 1907 }, { id: "closing", start: 1908, end: 1910 }], events: [{ year: 1900, title: "The episode begins", era: "opening" }, { year: 1903, title: "The opening phase concludes", era: "opening" }, { year: 1905, title: "A central turning point occurs", era: "turning" }, { year: 1907, title: "The balance changes", era: "turning" }, { year: 1910, title: "The episode reaches its endpoint", era: "closing" }, { year: 1911, title: "An unrelated aftermath is added", era: "closing" }] });
  assert.match(assessEditorialPlan({ plan: value.plan, allowedSourceRefs: new Set(["source-1"]), allowedEvidenceRefs: new Set(["evidence-1"]), currentYear: 2026 }).join(" "), /exceeds declared end boundary/);
  assert.equal(assess(value).checks.scope.status, "failed");
});

test("future projections cannot pass as historical events", () => {
  const value = fixture({ topic: "An Ongoing Institution", type: "institution", ongoing: true, start: 2000, end: null, eras: [{ id: "formation", start: 2000, end: 2008 }, { id: "growth", start: 2009, end: 2017 }, { id: "current", start: 2018, end: 2026 }], events: [{ year: 2000, title: "The institution begins", era: "formation" }, { year: 2008, title: "The first mandate is completed", era: "formation" }, { year: 2012, title: "Operations expand", era: "growth" }, { year: 2017, title: "A structural reform is adopted", era: "growth" }, { year: 2024, title: "A modern program launches", era: "current" }, { year: 2033, title: "A projected mission will end", era: "current" }] });
  assert.match(assessEditorialPlan({ plan: value.plan, allowedSourceRefs: new Set(["source-1"]), allowedEvidenceRefs: new Set(["evidence-1"]), currentYear: 2026 }).join(" "), /future-dated 2033/);
  assert.equal(assess(value).checks.scope.status, "failed");
});
