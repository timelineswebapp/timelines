import assert from "node:assert/strict";
import test from "node:test";
import { classifyCompletionYield, decideCompletionFallback } from "./completion-fallback";

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
