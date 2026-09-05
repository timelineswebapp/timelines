import assert from "node:assert/strict";
import test from "node:test";
import { assessSourceAuthority, selectAuthoritativeEvidence } from "./source-authority";
import { sourceAuthorityPublicationDefects } from "./pipeline";
import { hashValue } from "./normalization";
import type { GeneratedTimeline, GroundedEvidenceSegment, SourceCandidate } from "./schemas";
import { mergeResearchResults, type ResearchResult } from "./vertex";

function source(sourceId: string, publisher: string): SourceCandidate {
  return {
    sourceId,
    publisher,
    title: publisher,
    url: `https://${publisher}/record/${sourceId}`,
    publisherOrigin: "grounding_metadata",
    retrievedAt: "2026-09-05T00:00:00.000Z",
    groundingChunkIndex: Number(sourceId.replace(/\D/gu, "")) || 0
  };
}

function timeline(title: string, description: string, importance: number, sourceRefs: string[], evidenceRefs: string[]): GeneratedTimeline {
  return {
    title: `Timeline of ${title}`,
    description: `A bounded historical timeline covering ${title} with claim-level evidence and institutional source authority.`,
    category: "History",
    tags: ["history", "evidence"],
    events: [{
      date: "1969", datePrecision: "year", sortYear: 1969, sortMonth: null, sortDay: null,
      title, description, evidenceSummary: "Persisted evidence directly supports this material historical claim.",
      importance, location: null, sourceRefs, evidenceRefs, tags: ["history"]
    }]
  };
}

function evidence(evidenceRef: string, exactEvidence: string, sourceRefs: string[]): GroundedEvidenceSegment {
  return { evidenceRef, exactEvidence, sourceRefs, startIndex: 0, endIndex: exactEvidence.length };
}

function research(body: string, sources: SourceCandidate[], evidenceSegments: GroundedEvidenceSegment[], additionalVertexCallCount = 0): ResearchResult {
  return {
    body, sources, evidenceSegments, groundingMetadata: {},
    execution: {
      projectId: "tiimeliines", location: "global", model: "fixture", promptVersion: "fixture", schemaVersion: "fixture",
      promptHash: "a".repeat(64), responseHash: "b".repeat(64), startedAt: "2026-09-05T00:00:00.000Z",
      completedAt: "2026-09-05T00:00:01.000Z", usageMetadata: null
    },
    researchMetrics: { groundedSearchCallCount: 1, additionalVertexCallCount, repairCallCount: additionalVertexCallCount }
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

test("one definitive primary institutional record can establish a major routine milestone", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Apollo 11 launches", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", 5, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "nasa.gov")],
    evidenceSegments: [evidence("evidence-1", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", ["source-1"])]
  });
  assert.equal(result.overallVerdict, "passed");
  assert.equal(result.claims[0]!.definitivePrimaryAuthority, true);
  assert.equal(result.claims[0]!.corroborationRequired, false);
});

test("source quality and claim relevance remain separate dimensions", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Storming of the Bastille", "The Storming of the Bastille became a major turning point in the French Revolution.", 5, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "nasa.gov")],
    evidenceSegments: [evidence("evidence-1", "The Storming of the Bastille became a major turning point in the French Revolution.", ["source-1"])]
  });
  assert.equal(result.sourceInventory[0]!.authorityTier, "A");
  assert.equal(result.claims[0]!.evidence[0]!.claimRelevance, "direct");
  assert.equal(result.claims[0]!.evidence[0]!.evidenceRole, "secondary");
  assert.equal(result.overallVerdict, "failed", "NASA prestige must not establish unrelated French history alone");
});

test("multiple prestigious but claim-irrelevant institutions cannot manufacture corroboration", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Storming of the Bastille", "The Storming of the Bastille became a major turning point in the French Revolution.", 5, ["source-1", "source-2"], ["evidence-1"]),
    sources: [source("source-1", "nasa.gov"), source("source-2", "cern.ch")],
    evidenceSegments: [evidence("evidence-1", "The Storming of the Bastille became a major turning point in the French Revolution.", ["source-1", "source-2"])]
  });
  assert.equal(result.claims[0]!.independentStrongSourceCount, 0);
  assert.equal(result.overallVerdict, "failed");
});

test("Wikipedia is orientation and cannot be the sole authority for a major claim", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Berlin Wall Opens", "The Berlin Wall opened in 1989 after border guards allowed crowds to cross.", 5, ["source-1", "source-2"], ["evidence-1"]),
    sources: [source("source-1", "wikipedia.org"), source("source-2", "preceden.com")],
    evidenceSegments: [evidence("evidence-1", "The Berlin Wall opened in 1989 after border guards allowed crowds to cross.", ["source-1", "source-2"])]
  });
  assert.equal(result.claims[0]!.evidence.find((item) => item.sourceRef === "source-1")!.claimAuthority, "orientation");
  assert.equal(result.overallVerdict, "failed");
});

test("Britannica plus an independent scholarly source satisfies major secondary corroboration", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Harlem Renaissance expands", "The Harlem Renaissance expanded Black cultural production and influence during the 1920s.", 5, ["source-1", "source-2", "source-3"], ["evidence-1"]),
    sources: [source("source-1", "britannica.com"), source("source-2", "history.ox.ac.uk"), source("source-3", "wikipedia.org")],
    evidenceSegments: [evidence("evidence-1", "The Harlem Renaissance expanded Black cultural production and influence during the 1920s.", ["source-1", "source-2", "source-3"])]
  });
  assert.equal(result.overallVerdict, "passed");
  assert.deepEqual(result.claims[0]!.corroborationGroups, ["encyclopaedia-britannica", "ox.ac.uk"].sort());
});

test("multiple URLs from one publisher do not constitute independent corroboration", () => {
  const result = assessSourceAuthority({
    timeline: timeline("A constitutional settlement", "A constitutional settlement in 1969 reorganized the national government.", 5, ["source-1", "source-2"], ["evidence-1"]),
    sources: [source("source-1", "history.harvard.edu"), source("source-2", "news.harvard.edu")],
    evidenceSegments: [evidence("evidence-1", "A constitutional settlement in 1969 reorganized the national government.", ["source-1", "source-2"])]
  });
  assert.equal(result.claims[0]!.independentStrongSourceCount, 1);
  assert.equal(result.overallVerdict, "failed");
});

test("materially conflicting strong evidence routes to exceptional review", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Treaty Signed", "The Treaty was signed to establish a new political settlement.", 5, ["source-1", "source-2"], ["evidence-1", "evidence-2"]),
    sources: [source("source-1", "history.ox.ac.uk"), source("source-2", "history.harvard.edu")],
    evidenceSegments: [
      evidence("evidence-1", "The Treaty Signed ceremony occurred in 1989 and established a new political settlement.", ["source-1"]),
      evidence("evidence-2", "The Treaty Signed ceremony occurred in 1990 and established a new political settlement.", ["source-2"])
    ]
  });
  assert.equal(result.overallVerdict, "exceptional_review");
  assert.match(result.claims[0]!.conflictFindings.join(" "), /conflicting event years/);
});

test("weak-web disagreement cannot manufacture an authoritative conflict", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Treaty Signed", "The Treaty was signed to establish a new political settlement.", 5, ["source-1", "source-2"], ["evidence-1", "evidence-2"]),
    sources: [source("source-1", "britannica.com"), source("source-2", "medium.com")],
    evidenceSegments: [
      evidence("evidence-1", "The Treaty Signed ceremony occurred in 1969 and established a new political settlement.", ["source-1"]),
      evidence("evidence-2", "The Treaty Signed ceremony occurred in 1970 and established a new political settlement.", ["source-2"])
    ]
  });
  assert.deepEqual(result.conflictFindings, []);
  assert.equal(result.overallVerdict, "failed", "one non-definitive strong source still lacks major-claim corroboration");
});

test("routine facts still fail closed when only weak general-web evidence exists", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Local organization founded", "A local organization was founded in 1969 to coordinate community events.", 2, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "medium.com")],
    evidenceSegments: [evidence("evidence-1", "A local organization was founded in 1969 to coordinate community events.", ["source-1"])]
  });
  assert.equal(result.overallVerdict, "failed");
});

test("targeted authority research merges with deterministic non-colliding lineage and bounded cost", () => {
  const initial = research("Initial", [source("source-1", "wikipedia.org")], [evidence("evidence-1", "Initial evidence for the historical claim.", ["source-1"])]);
  const repair = research("Repair", [source("source-1", "britannica.com"), source("source-2", "wikipedia.org")], [
    evidence("evidence-1", "Professionally edited reference evidence for the historical claim.", ["source-1", "source-2"])
  ], 1);
  const merged = mergeResearchResults(initial, repair);
  assert.equal(merged.sources.length, 3);
  assert.deepEqual(merged.sources.map((item) => item.sourceId), ["source-1", "source-2", "source-3"]);
  assert.equal(merged.evidenceSegments[1]!.evidenceRef, "evidence-2");
  assert.deepEqual(merged.evidenceSegments[1]!.sourceRefs, ["source-2", "source-3"]);
  assert.deepEqual(merged.researchMetrics, { groundedSearchCallCount: 2, additionalVertexCallCount: 1, repairCallCount: 1 });
});

test("non-English and non-Western institutional authorities are supported without an English-only default", () => {
  const fixtures = [
    { publisher: "bundesarchiv.de", title: "German Federal Archives issues a record", description: "The German Federal Archives issued an official record in 1969 documenting the program milestone." },
    { publisher: "ndl.go.jp", title: "National Diet Library of Japan issues a record", description: "The National Diet Library of Japan issued an official record in 1969 documenting the program milestone." },
    { publisher: "unesco.org", title: "UNESCO issues a record", description: "UNESCO issued an official record in 1969 documenting the program milestone." }
  ];
  for (const fixture of fixtures) {
    const result = assessSourceAuthority({
      timeline: timeline(fixture.title, fixture.description, 2, ["source-1"], ["evidence-1"]),
      sources: [source("source-1", fixture.publisher)],
      evidenceSegments: [evidence("evidence-1", fixture.description, ["source-1"])]
    });
    assert.equal(result.sourceInventory[0]!.authorityTier, "A", fixture.publisher);
    assert.equal(result.overallVerdict, "passed", fixture.publisher);
  }
});

test("verified German institutions retain explicit identity and scholarly status", () => {
  const germanTimeline = timeline("Germany is reunified", "Germany completed reunification in 1990 when the German Democratic Republic acceded to the Federal Republic.", 5, ["source-1", "source-2"], ["evidence-1"]);
  germanTimeline.events[0] = { ...germanTimeline.events[0]!, date: "1990", sortYear: 1990 };
  const result = assessSourceAuthority({
    timeline: germanTimeline,
    sources: [source("source-1", "diplo.de"), source("source-2", "germanhistorydocs.org")],
    evidenceSegments: [evidence("evidence-1", "Germany completed reunification in 1990 when the German Democratic Republic acceded to the Federal Republic.", ["source-1", "source-2"])]
  });
  assert.equal(result.overallVerdict, "passed");
  assert.equal(result.sourceInventory[0]!.institutionalStatus, "verified_institutional");
  assert.equal(result.sourceInventory[0]!.publisherIdentity, "german-federal-foreign-office");
  assert.equal(result.sourceInventory[1]!.scholarlyStatus, "verified_scholarly");
  assert.equal(result.sourceInventory[1]!.publisherIdentity, "german-historical-institute");
});

test("official UN records are claim-relevant for a named UNESCO institutional action", () => {
  const result = assessSourceAuthority({
    timeline: timeline("UNESCO adopts a convention", "UNESCO adopted an international cultural convention in 1969 through its General Conference.", 5, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "un.org")],
    evidenceSegments: [evidence("evidence-1", "UNESCO adopted an international cultural convention in 1969 through its General Conference.", ["source-1"])]
  });
  assert.equal(result.claims[0]!.evidence[0]!.evidenceRole, "primary");
  assert.equal(result.claims[0]!.definitivePrimaryAuthority, true);
  assert.equal(result.overallVerdict, "passed");
});

test("country-code government domains retain their actual geography instead of defaulting to the United States", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Cultural ministry record", "The cultural ministry issued a record in 1969 documenting the national program.", 2, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "cultura.gov.it")],
    evidenceSegments: [evidence("evidence-1", "The cultural ministry issued a record in 1969 documenting the national program.", ["source-1"])]
  });
  assert.equal(result.sourceInventory[0]!.geographicContext, "Italy");
  assert.equal(result.sourceInventory[0]!.geographicBasis, "country_code_domain");
});

test("deterministic evidence selection prefers direct institutional evidence over weak discovery sources", () => {
  const value = timeline("Apollo 11 launches", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", 5, ["source-1"], ["evidence-1"]);
  const selected = selectAuthoritativeEvidence({
    timeline: value,
    sources: [source("source-1", "wikipedia.org"), source("source-2", "nasa.gov")],
    evidenceSegments: [
      evidence("evidence-1", "Apollo 11 was a mission discussed in a general chronology.", ["source-1"]),
      evidence("evidence-2", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", ["source-2"])
    ]
  });
  assert.equal(selected.events[0]!.evidenceRefs[0], "evidence-2");
  assert.equal(selected.events[0]!.sourceRefs[0], "source-2");
});

test("one self-interested primary source cannot establish an interpretive claim", () => {
  const result = assessSourceAuthority({
    timeline: timeline("Apollo 11 legacy", "Apollo 11 is widely considered the mission that caused a permanent transformation of global culture.", 5, ["source-1"], ["evidence-1"]),
    sources: [source("source-1", "nasa.gov")],
    evidenceSegments: [evidence("evidence-1", "Apollo 11 is widely considered the mission that caused a permanent transformation of global culture.", ["source-1"])]
  });
  assert.equal(result.claims[0]!.claimRisk, "contested_interpretive");
  assert.equal(result.claims[0]!.corroborationRequired, true);
  assert.equal(result.overallVerdict, "failed");
});

test("publication gate verifies immutable Source Authority ownership, integrity, and complete passing claim coverage", () => {
  const value = timeline("Apollo 11 launches", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", 5, ["source-1"], ["evidence-1"]);
  const assessment = assessSourceAuthority({
    timeline: value,
    sources: [source("source-1", "nasa.gov")],
    evidenceSegments: [evidence("evidence-1", "NASA launched Apollo 11 in 1969 as the first crewed lunar landing mission.", ["source-1"])]
  });
  const payload = { ...assessment, sourceSnapshotRef: "snapshot-1" };
  const artifact = {
    topicId: "topic-1", runId: "job-1", objectRef: "object-1", sourceSnapshotRef: "snapshot-1",
    policyVersion: assessment.policyVersion, payload, payloadHash: hashValue(stableJson(payload))
  };
  const input = { topicId: "topic-1", jobId: "job-1", timelineObjectId: "object-1", sourceSnapshotId: "snapshot-1", timeline: value, artifact };
  assert.deepEqual(sourceAuthorityPublicationDefects(input), []);
  assert.match(sourceAuthorityPublicationDefects({ ...input, artifact: { ...artifact, payloadHash: "tampered" } }).join(" "), /integrity/);
  const nonPassingPayload = { ...payload, overallVerdict: "failed" as const, unresolvedSourceIssues: ["material gap"] };
  assert.match(sourceAuthorityPublicationDefects({
    ...input,
    artifact: { ...artifact, payload: nonPassingPayload, payloadHash: hashValue(stableJson(nonPassingPayload)) }
  }).join(" "), /clean passing verdict/);
});
