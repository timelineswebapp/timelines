import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessEvidenceGrounding, canonicalEvidenceTimestamp } from "@/src/server/services/evidence-validation-service";

describe("evidence validation timestamp normalization", () => {
  it("treats PostgreSQL text timestamps and ISO timestamps as equal", () => {
    assert.equal(
      canonicalEvidenceTimestamp("2026-06-23 07:19:21.294+03"),
      canonicalEvidenceTimestamp("2026-06-23T04:19:21.294Z")
    );
  });

  it("preserves invalid timestamp failure semantics", () => {
    assert.equal(canonicalEvidenceTimestamp("not-a-timestamp"), null);
    assert.notEqual(
      canonicalEvidenceTimestamp("2026-06-23 07:19:21.294+03"),
      canonicalEvidenceTimestamp("2026-06-23T04:19:22.294Z")
    );
  });
});

describe("Evidence Grounding Authority", () => {
  const baseSubject = {
    evidenceRecordId: "evidence-1",
    corpusDocumentId: "corpus-1",
    sourceSnapshotId: "snapshot-1",
    sourceRecordId: "source-1",
    provider: "wikidata",
    retrievalTimestamp: "2026-06-30T00:00:00.000Z",
    spanStart: 0,
    spanEnd: 80,
    quoteText: "The 1918 influenza pandemic caused widespread mortality during the twentieth century.",
    normalizedClaim: "The 1918 influenza pandemic caused widespread mortality during the twentieth century.",
    provenance: {},
    createdBy: "test",
    corpusDocumentExists: true,
    sourceSnapshotExists: true,
    sourceRecordExists: true,
    corpusTextLength: 100,
    sourceTitle: "1918 influenza pandemic",
    sourceDescription: "Historical pandemic record.",
    sourceProvenance: {
      relevanceAssessment: { accepted: true, authorityRelevance: 0.8 }
    }
  } as any;

  it("admits topic-aligned, claim-grounded evidence with resolvable authority", () => {
    const result = assessEvidenceGrounding(baseSubject, "The History of Pandemics");
    assert.equal(result.publicationSuitable, true);
    assert.equal(result.chronologySupported, true);
    assert.equal(result.rejectionReasons.length, 0);
  });

  it("rejects structurally complete evidence that does not support the Topic", () => {
    const result = assessEvidenceGrounding({
      ...baseSubject,
      quoteText: "The National Security Council advises the president on foreign policy.",
      normalizedClaim: "The National Security Council advises the president on foreign policy."
    }, "The History of Pandemics");
    assert.equal(result.topicRelevance, 0);
    assert.equal(result.publicationSuitable, false);
    assert.match(result.rejectionReasons.join(" "), /Topic/);
  });
});
