import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { EditorialEvidenceSubject } from "./contracts";
import { prepareEditorialEvidenceSet } from "./editorial-foundation";

function evidence(id: string, source: string, claim: string, quality = 0.9): EditorialEvidenceSubject {
  return {
    evidence: {
      evidenceRecordId: id, corpusDocumentId: `c-${id}`, sourceSnapshotId: `ss-${id}`, sourceRecordId: source,
      provider: "wikidata", retrievalTimestamp: "2026-01-01T00:00:00Z", spanStart: 0, spanEnd: claim.length,
      quoteText: claim, normalizedClaim: claim, createdBy: "test",
      provenance: { corpusDocumentId: `c-${id}`, sourceSnapshotId: `ss-${id}`, sourceRecordId: source,
        provider: "wikidata", retrievalTimestamp: "2026-01-01T00:00:00Z", retrievalProvenance: {} as never }
    },
    validationRecordId: `v-${id}`, sourceTitle: source, sourceAuthorityScore: quality,
    validation: {
      validationType: "structural_and_grounding_validation", evidenceRecordId: id, corpusDocumentId: `c-${id}`,
      sourceSnapshotId: `ss-${id}`, sourceRecordId: source, provider: "wikidata",
      validatedAt: "2026-01-01T00:00:00Z", validator: "test", authorityDecision: false,
      publicationReadinessDecision: false, groundingAssessment: {
        topic: "test", topicRelevance: 1, claimGrounded: true, citationGrounded: true,
        chronologySupported: true, authorityGrounded: true, publicationSuitable: true,
        evidenceQualityScore: quality, unsupportedClaims: [], rejectionReasons: []
      }
    }
  };
}

test("deterministic ranking is independent of repository order", () => {
  const rows = [evidence("b", "s1", "In 1969 ARPANET launched and transformed networking."),
    evidence("a", "s2", "In 1983 ARPANET adopted TCP/IP.")];
  assert.deepEqual(prepareEditorialEvidenceSet("ARPANET", rows), prepareEditorialEvidenceSet("ARPANET", [...rows].reverse()));
});

test("significant turning points lead milestone ranking", () => {
  const set = prepareEditorialEvidenceSet("printing press", [
    evidence("routine", "s1", "In 1470 printing press equipment was recorded."),
    evidence("turn", "s2", "In 1450 the first printing press breakthrough transformed publication.")
  ]);
  assert.equal(set.candidateMilestonesRanked[0]!.evidenceRecordId, "turn");
  assert.equal(set.identifiedTurningPoints[0]!.evidenceRecordId, "turn");
});

test("duplicate suppression retains complete traceability", () => {
  const set = prepareEditorialEvidenceSet("French Revolution", [
    evidence("a", "s1", "In 1789 the French Revolution began."),
    evidence("b", "s2", "In 1789 the French Revolution began.")
  ]);
  assert.equal(set.coverageAnalysis.duplicateEvidenceCount, 1);
  assert.equal(set.rankedEvidence.length, 2);
  assert.equal(set.rankedEvidence.find((row) => row.evidenceRecordId === "b")?.duplicateOfEvidenceRecordId, "a");
});

test("coverage analysis reports chronology gaps, diversity, and balance", () => {
  const set = prepareEditorialEvidenceSet("space exploration", [
    evidence("a", "s1", "In 1957 space exploration began with Sputnik."),
    evidence("b", "s2", "In 1969 space exploration changed with the Moon landing."),
    evidence("c", "s3", "In 2020 space exploration entered a new period.")
  ]);
  assert.deepEqual(set.timelineCoverage.representedYears, [1957, 1969, 2020]);
  assert.equal(set.timelineCoverage.gaps.length, 2);
  assert.equal(set.coverageAnalysis.uniqueSourceCount, 3);
});

test("canonical selection is generic across historical topics", () => {
  for (const [topic, claim] of [["Meiji Restoration", "In 1868 the Meiji Restoration transformed Japan."],
    ["Mali Empire", "In 1324 the Mali Empire influenced trade."],
    ["vaccination", "In 1796 vaccination began with Jenner."]] as const) {
    const set = prepareEditorialEvidenceSet(topic, [evidence(topic, "source", claim)]);
    assert.equal(set.canonicalSubject.label, topic);
    assert.equal(set.canonicalSubject.confidence, 100);
    assert.equal(set.canonicalHistoricalObject.label, topic);
  }
});

test("regression: preparation never asserts authority or publication readiness", () => {
  const set = prepareEditorialEvidenceSet("abolition", [evidence("a", "s1", "In 1833 abolition changed law.")]);
  assert.equal(set.editorialMetadata.authorityDecision, false);
  assert.equal(set.editorialMetadata.publicationReadinessDecision, false);
  assert.equal(set.editorialMetadata.compilerOutput, false);
});

test("repository persistence enforces immutable evidence and validation lineage", () => {
  const migration = readFileSync("db/migrations/20260714_editorial_intelligence_foundation.sql", "utf8");
  const repository = readFileSync("src/server/repositories/editorial-evidence-repository.ts", "utf8");
  const pipeline = readFileSync("src/server/factory/pipeline-registry.ts", "utf8");
  assert.match(migration, /REFERENCES evidence_records\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /REFERENCES evidence_validation_records\(id\) ON DELETE RESTRICT/);
  assert.match(migration, /BEFORE UPDATE OR DELETE ON factory_editorial_evidence_set_inputs/);
  assert.match(repository, /INNER JOIN LATERAL/);
  assert.match(repository, /status = 'passed'/);
  assert.match(repository, /withWriteTransaction/);
  assert.match(pipeline, /"evidence_validation", "editorial_intelligence_foundation", "research_worker"/);
});
