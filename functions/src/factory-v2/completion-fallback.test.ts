import assert from "node:assert/strict";
import test from "node:test";
import { classifyCompletionYield, decideCompletionFallback, sealCompletionAuthorityUniverse } from "./completion-fallback";

const classify = (overrides: Partial<Parameters<typeof classifyCompletionYield>[0]> = {}) => classifyCompletionYield({ retrieved: true, securityRejected: false, deadlineExceeded: false, budgetExhausted: false, admissibleGapClaims: 0, rejectedClaims: 0, ...overrides });

test("completion fallback: qualifying first candidate stops", () => assert.equal(decideCompletionFallback({ yield: classify({ admissibleGapClaims: 1 }), sealedCandidatesRemaining: 1 }), "STOP_QUALIFYING_EVIDENCE"));
test("completion fallback: zero yield permits the next sealed candidate", () => assert.equal(decideCompletionFallback({ yield: classify(), sealedCandidatesRemaining: 1 }), "TRY_NEXT_SEALED_CANDIDATE"));
test("completion fallback: two zero yields exhaust the sealed pool", () => assert.equal(decideCompletionFallback({ yield: classify(), sealedCandidatesRemaining: 0 }), "STOP_CANDIDATES_EXHAUSTED"));
test("completion fallback: retrieval failure remains distinct from zero yield", () => assert.equal(classify({ retrieved: false }), "RETRIEVAL_FAILED"));
test("completion fallback: rejected claims remain distinct from zero yield", () => assert.equal(classify({ rejectedClaims: 1 }), "CLAIMS_INADMISSIBLE"));
test("completion fallback: only gap-bound accepted claims qualify", () => assert.equal(classify({ admissibleGapClaims: 0 }), "ZERO_CLAIM_YIELD"));
test("completion fallback: weak or inadmissible claims do not source-shop", () => assert.equal(decideCompletionFallback({ yield: classify({ rejectedClaims: 1 }), sealedCandidatesRemaining: 1 }), "STOP_INADMISSIBLE_CLAIMS"));
test("completion fallback: unregistered authority is not an input to policy", () => assert.equal(decideCompletionFallback({ yield: classify(), sealedCandidatesRemaining: 0 }), "STOP_CANDIDATES_EXHAUSTED"));
test("completion fallback: no candidate outside the sealed pool can be selected", () => assert.equal(decideCompletionFallback({ yield: classify(), sealedCandidatesRemaining: 0 }), "STOP_CANDIDATES_EXHAUSTED"));
test("completion fallback: gap identity is not altered by a retry", () => assert.equal(classify(), "ZERO_CLAIM_YIELD"));
test("completion fallback: no scope or map reopening decision exists", () => assert.equal(typeof decideCompletionFallback, "function"));
test("completion fallback: budget exhaustion stops before another candidate", () => assert.equal(decideCompletionFallback({ yield: classify({ budgetExhausted: true }), sealedCandidatesRemaining: 1 }), "STOP_BUDGET_OR_DEADLINE"));
test("completion fallback: deadline exhaustion stops before another candidate", () => assert.equal(decideCompletionFallback({ yield: classify({ deadlineExceeded: true }), sealedCandidatesRemaining: 1 }), "STOP_BUDGET_OR_DEADLINE"));
test("completion fallback: security rejection fails closed", () => assert.equal(decideCompletionFallback({ yield: classify({ securityRejected: true }), sealedCandidatesRemaining: 1 }), "STOP_SECURITY_FAIL_CLOSED"));
test("completion fallback: first attempt remains represented by its zero-yield result", () => assert.equal(classify(), "ZERO_CLAIM_YIELD"));
test("completion fallback: a completed set can carry attempt identity without changing yield", () => assert.equal(classify({ admissibleGapClaims: 1 }), "QUALIFYING_EVIDENCE"));
test("completion fallback: terminal exhaustion is explicit", () => assert.equal(decideCompletionFallback({ yield: "RETRIEVAL_FAILED", sealedCandidatesRemaining: 0 }), "STOP_CANDIDATES_EXHAUSTED"));
test("completion fallback: policy has no subject-specific identity", () => assert.doesNotMatch(`${classifyCompletionYield}\n${decideCompletionFallback}`, /ada lovelace/iu));

const authority = (id: string, overrides: Record<string, unknown> = {}) => ({
  bindingId: `binding-${id}`, publisherVersionId: `publisher-${id}`, researchQuestionIds: ["question-1"], roles: ["CORROBORATION"], subjectRelationship: "INDEPENDENT", independenceGroupId: `group-${id}`, languages: ["en"], geography: ["United Kingdom"], historicalJurisdictionCapacityIds: [], validationStatus: "ELIGIBLE" as const, ...overrides
});
const requirement = { questionId: "question-1", gapObligationIds: ["gap-1"], requiredRoles: ["PRIMARY_RECORD", "CORROBORATION"], permittedSubjectRelationships: ["INDEPENDENT"], minimumIndependentGroups: 0, languages: ["en"] };

test("completion authority universe: all eligible authorities seal before discovery", () => {
  const result = sealCompletionAuthorityUniverse({ bindings: [authority("c"), authority("a"), authority("b")], requirements: [requirement], candidateCeiling: 4 });
  assert.deepEqual(result.map((item) => [item.publisherVersionId, item.disposition]), [["publisher-a", "ELIGIBLE"], ["publisher-b", "ELIGIBLE"], ["publisher-c", "ELIGIBLE"]]);
});
test("completion authority universe: wrong role, relationship, language, and jurisdiction are excluded before sealing", () => {
  const result = sealCompletionAuthorityUniverse({ bindings: [authority("wrong-role", { roles: ["INTERPRETATION"] }), authority("wrong-relationship", { subjectRelationship: "SUBJECT_SELF" }), authority("wrong-language", { languages: ["fr"] }), authority("wrong-jurisdiction", { historicalJurisdictionCapacityIds: [] }), authority("ok", { historicalJurisdictionCapacityIds: ["capacity-1"] })], requirements: [{ ...requirement, historicalJurisdictionCapacityIds: ["capacity-1"] }], candidateCeiling: 4 });
  assert.deepEqual(result.map((item) => item.publisherVersionId), ["publisher-ok"]);
});
test("completion authority universe: deterministic cap retains excluded lineage", () => {
  const result = sealCompletionAuthorityUniverse({ bindings: [authority("a"), authority("b"), authority("c")], requirements: [requirement], candidateCeiling: 2 });
  assert.deepEqual(result.map((item) => [item.candidateRank, item.disposition, item.exclusionReason]), [[1, "ELIGIBLE", null], [2, "ELIGIBLE", null], [3, "EXCLUDED_CEILING", "PER_GAP_AUTHORITY_CEILING"]]);
});
test("completion authority universe: registry outsiders cannot enter because only bindings are inputs", () => {
  const result = sealCompletionAuthorityUniverse({ bindings: [authority("bound")], requirements: [requirement], candidateCeiling: 4 });
  assert.equal(result.length, 1);
  assert.equal(result[0]!.publisherVersionId, "publisher-bound");
});
