import assert from "node:assert/strict";
import test from "node:test";
import { adaptReaderProviderResponse, READER_PROVIDER_NORMALIZATION } from "./reader-provider-contract";

const labels = ["Scope fidelity", "Chronological intelligibility", "Milestone significance", "Narrative progression", "Omission severity", "Redundancy", "Temporal balance", "Title and summary fidelity", "Publication worthiness"];

function validProviderResponse(judgment = "PASS") {
  const response: Record<string, string> = {
    material_findings_json: "[]",
    overall_publication_judgment: "PUBLICATION WORTHY",
    summary: "The complete synthetic timeline is coherent, properly scoped, non-redundant, and publication worthy."
  };
  labels.forEach((label, offset) => {
    const index = offset + 1;
    response[`criterion_${index}_identity`] = label;
    response[`criterion_${index}_judgment`] = judgment;
    response[`criterion_${index}_explanation`] = `The provider explicitly judged ${label} against the complete reader-facing product.`;
  });
  return response;
}

test("semantic vocabulary normalizes through small explicit allowlists", () => {
  for (const token of ["PASS", "PASSED", "YES"]) assert.ok(adaptReaderProviderResponse(validProviderResponse(token)).criteria.every((item) => item.verdict === "passed"));
  for (const token of ["FAIL", "FAILED", "NO"]) {
    const input = validProviderResponse(token);
    input.overall_publication_judgment = "NOT PUBLISHABLE";
    assert.ok(adaptReaderProviderResponse(input).criteria.every((item) => item.verdict === "failed"));
  }
  assert.equal(Object.keys(READER_PROVIDER_NORMALIZATION.criteria).length, 9);
});

test("unknown, ambiguous, prose, missing, and duplicate judgments fail closed", () => {
  const unknown = validProviderResponse(); unknown.criterion_1_judgment = "acceptable";
  assert.throws(() => adaptReaderProviderResponse(unknown), /Unknown or ambiguous/);
  const prose = validProviderResponse(); prose.criterion_1_judgment = "seems good";
  assert.throws(() => adaptReaderProviderResponse(prose), /Unknown or ambiguous/);
  const missing = validProviderResponse(); delete missing.criterion_9_identity;
  assert.throws(() => adaptReaderProviderResponse(missing));
  const duplicate = validProviderResponse(); duplicate.criterion_9_identity = "Scope fidelity";
  assert.throws(() => adaptReaderProviderResponse(duplicate), /Duplicate reader criterion/);
});

test("adapter preserves explicit failure, non-publication verdict, and provider finding text", () => {
  const input = validProviderResponse();
  input.criterion_6_judgment = "FAIL";
  input.overall_publication_judgment = "NOT PUBLICATION WORTHY";
  input.material_findings_json = JSON.stringify([{ criterion: "Redundancy", text: "Two selected milestones repeat the same substantive development without adding historical progression.", eventTitles: ["Decision", "Turning Point"] }]);
  const canonical = adaptReaderProviderResponse(input);
  assert.equal(canonical.criteria.find((item) => item.criterion === "redundancy")?.verdict, "failed");
  assert.equal(canonical.informedReaderVerdict, "not_publication_worthy");
  assert.equal(canonical.findings[0]?.rationale, "Two selected milestones repeat the same substantive development without adding historical progression.");
  assert.equal(canonical.findings[0]?.code, "SUBSTANTIVE_REDUNDANCY");
});

test("findings cannot be manufactured and contradictory judgments fail canonical validation", () => {
  assert.deepEqual(adaptReaderProviderResponse(validProviderResponse()).findings, []);
  const malformed = validProviderResponse(); malformed.material_findings_json = "not-json";
  assert.throws(() => adaptReaderProviderResponse(malformed), /valid JSON/);
  const contradiction = validProviderResponse(); contradiction.criterion_5_judgment = "FAIL";
  assert.throws(() => adaptReaderProviderResponse(contradiction), /Publication-worthy verdict cannot coexist/);
});
