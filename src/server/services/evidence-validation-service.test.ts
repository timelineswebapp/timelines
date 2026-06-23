import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalEvidenceTimestamp } from "@/src/server/services/evidence-validation-service";

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
