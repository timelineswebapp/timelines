import assert from "node:assert/strict";
import test from "node:test";
import { BraveExplicitSearchClient, authorizeSearchQueries, executeAuthorizedQueries, normalizeSearchQuery, type SearchQueryCandidate } from "./explicit-search";
import type { ResearchMap } from "./contracts";

function mapWithCriticalQuestions(count: number): ResearchMap {
  return {
    questions: Array.from({ length: count }, (_, index) => ({ questionId: `question-${index}`, priority: "CRITICAL" }))
  } as ResearchMap;
}

function candidate(index: number, overrides: Partial<SearchQueryCandidate> = {}): SearchQueryCandidate {
  const proposedText = overrides.proposedText || `provider authored historical query ${index}`;
  return {
    queryId: overrides.queryId || `query-${index}`,
    researchQuestionIds: overrides.researchQuestionIds || [`question-${index}`],
    gapIds: overrides.gapIds || [],
    phaseIds: overrides.phaseIds || [`phase-${index}`],
    dimensionIds: overrides.dimensionIds || [`dimension-${index}`],
    language: overrides.language || "en",
    geography: overrides.geography || ["US"],
    proposedText,
    normalizedText: overrides.normalizedText || normalizeSearchQuery(proposedText),
    role: overrides.role || "PHASE_DIMENSION",
    intendedSourceClass: overrides.intendedSourceClass || "SCHOLARLY_SECONDARY",
    criticality: overrides.criticality || "CRITICAL"
  };
}

test("25 proposed queries authorize exactly 25 with complete critical coverage", () => {
  const decisions = authorizeSearchQueries({ candidates: Array.from({ length: 25 }, (_, index) => candidate(index)), researchMap: mapWithCriticalQuestions(25) });
  assert.equal(decisions.filter((item) => item.authorizationStatus === "AUTHORIZED").length, 25);
});

test("normalized duplicate queries are rejected without consuming authorization", () => {
  const candidates = [candidate(0), candidate(1, { proposedText: "  PROVIDER   AUTHORED historical query 0 ", researchQuestionIds: ["question-0"] })];
  const decisions = authorizeSearchQueries({ candidates, researchMap: mapWithCriticalQuestions(1) });
  assert.deepEqual(decisions.map((item) => [item.authorizationStatus, item.rejectionReason]), [["AUTHORIZED", null], ["REJECTED", "DUPLICATE_NORMALIZED_QUERY"]]);
});

test("a 25-candidate set with a safe normalized duplicate stays within the 25-query cap", () => {
  const candidates = Array.from({ length: 25 }, (_, index) => candidate(index));
  candidates[24] = candidate(24, { proposedText: " PROVIDER authored historical query 23 ", researchQuestionIds: ["question-23"] });
  const decisions = authorizeSearchQueries({ candidates, researchMap: mapWithCriticalQuestions(24) });
  assert.equal(decisions.filter((item) => item.authorizationStatus === "AUTHORIZED").length, 24);
  assert.equal(decisions[24]!.rejectionReason, "DUPLICATE_NORMALIZED_QUERY");
});

test("coverage-aware selection preserves all critical questions within a smaller budget", () => {
  const candidates = [
    candidate(0, { researchQuestionIds: ["question-0", "question-1"] }),
    candidate(1, { researchQuestionIds: ["question-1"] }),
    candidate(2, { researchQuestionIds: ["question-2"] })
  ];
  const decisions = authorizeSearchQueries({ candidates, researchMap: mapWithCriticalQuestions(3), maximumAuthorizedQueries: 2 });
  assert.deepEqual(decisions.filter((item) => item.authorizationStatus === "AUTHORIZED").map((item) => item.queryId), ["query-0", "query-2"]);
});

test("remaining slots are allocated deterministically across query roles", () => {
  const candidates = [
    candidate(0, { role: "PHASE_DIMENSION" }),
    candidate(1, { researchQuestionIds: ["question-0"], role: "ORIENTATION", criticality: "IMPORTANT" }),
    candidate(2, { researchQuestionIds: ["question-0"], role: "AUTHORITY_TARGETED", criticality: "IMPORTANT" })
  ];
  const decisions = authorizeSearchQueries({ candidates, researchMap: mapWithCriticalQuestions(1), maximumAuthorizedQueries: 3 });
  assert.deepEqual(decisions.filter((item) => item.authorizationStatus === "AUTHORIZED").map((item) => item.role), ["PHASE_DIMENSION", "ORIENTATION", "AUTHORITY_TARGETED"]);
});

test("critical coverage that cannot fit fails before any provider execution", () => {
  assert.throws(() => authorizeSearchQueries({ candidates: [candidate(0), candidate(1)], researchMap: mapWithCriticalQuestions(2), maximumAuthorizedQueries: 1 }), /QUERY_BUDGET_INSUFFICIENT_FOR_REQUIRED_COVERAGE/u);
});

test("missing critical candidate fails closed", () => {
  assert.throws(() => authorizeSearchQueries({ candidates: [candidate(0)], researchMap: mapWithCriticalQuestions(2) }), /no provider-authored query covers/u);
});

test("rejected queries never execute and result lineage remains exact", async () => {
  const calls: string[] = [];
  const transport = async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify({ web: { results: [{ title: "IOC history", url: "https://olympics.com/ioc/ancient-olympic-games/history", description: "Institutional history of the ancient Olympic Games." }] } }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "provider-call-1" } });
  };
  const decisions = authorizeSearchQueries({ candidates: [candidate(0), candidate(1, { proposedText: " PROVIDER authored historical query 0 ", researchQuestionIds: ["question-0"] })], researchMap: mapWithCriticalQuestions(1) });
  const result = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", transport, 0.005, true), maximumConcurrency: 2 });
  assert.equal(calls.length, 1);
  const request = new URL(calls[0]!);
  assert.equal(request.searchParams.get("q"), "provider authored historical query 0");
  assert.equal(request.searchParams.get("spellcheck"), "false");
  assert.equal(request.searchParams.get("result_filter"), "web");
  assert.equal(result.acquisitions.length, 1);
  assert.equal(result.ledgerEntries[0]!.executionStatus, "SUCCEEDED");
  assert.deepEqual(result.ledgerEntries[0]!.resultUrls, ["https://olympics.com/ioc/ancient-olympic-games/history"]);
  assert.equal(result.ledgerEntries[1]!.executionStatus, "NOT_AUTHORIZED");
  assert.equal(result.ledgerEntries[1]!.transportAttempts, 0);
});

test("a bounded transport retry retains one logical query identity", async () => {
  let calls = 0;
  const transport = async () => {
    calls += 1;
    if (calls === 1) return new Response("temporary", { status: 503 });
    return new Response(JSON.stringify({ web: { results: [] } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  const decisions = authorizeSearchQueries({ candidates: [candidate(0)], researchMap: mapWithCriticalQuestions(1) });
  const result = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", transport, 0.005, true), maximumConcurrency: 1 });
  assert.equal(calls, 2);
  assert.equal(result.ledgerEntries.length, 1);
  assert.equal(result.ledgerEntries[0]!.transportAttempts, 2);
  assert.equal(result.ledgerEntries[0]!.quotaUnits, 2);
  assert.equal(result.ledgerEntries[0]!.returnedResultCount, 0);
});

test("quota exhaustion and malformed responses fail explicitly", async () => {
  const decisions = authorizeSearchQueries({ candidates: [candidate(0)], researchMap: mapWithCriticalQuestions(1) });
  const quota = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", async () => new Response("quota", { status: 429 }), 0.005, true), maximumConcurrency: 1 });
  assert.match(quota.failure?.message || "", /SEARCH_PROVIDER_QUOTA_EXHAUSTED/u);
  assert.equal(quota.ledgerEntries[0]!.executionStatus, "FAILED");
  assert.equal(quota.ledgerEntries[0]!.transportAttempts, 1);
  const malformed = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", async () => new Response(JSON.stringify({ web: { results: [{ url: 42 }] } }), { status: 200 }), 0.005, true), maximumConcurrency: 1 });
  assert.match(malformed.failure?.message || "", /SEARCH_PROVIDER_MALFORMED_RESPONSE/u);
  assert.equal(malformed.ledgerEntries[0]!.executionStatus, "FAILED");
  assert.equal(malformed.ledgerEntries[0]!.transportAttempts, 1);
});

test("provider failure records the failed query and leaves later work pending", async () => {
  let calls = 0;
  const decisions = authorizeSearchQueries({ candidates: [candidate(0), candidate(1)], researchMap: mapWithCriticalQuestions(2) });
  const result = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", async () => { calls += 1; return new Response("temporary", { status: 503 }); }, 0.005, true), maximumConcurrency: 1 });
  assert.match(result.failure?.message || "", /SEARCH_PROVIDER_HTTP_503/u);
  assert.equal(calls, 2);
  assert.deepEqual(result.ledgerEntries.map((entry) => entry.executionStatus), ["FAILED", "PENDING"]);
  assert.deepEqual(result.ledgerEntries.map((entry) => entry.transportAttempts), [2, 0]);
});

test("missing credential prevents all search execution", async () => {
  let called = false;
  const decisions = authorizeSearchQueries({ candidates: [candidate(0)], researchMap: mapWithCriticalQuestions(1) });
  const result = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("", async () => { called = true; return new Response(); }, 0.005, true), maximumConcurrency: 1 });
  assert.match(result.failure?.message || "", /EXPLICIT_SEARCH_CREDENTIAL_MISSING/u);
  assert.equal(result.ledgerEntries[0]!.executionStatus, "PENDING");
  assert.equal(called, false);
});

test("unconfirmed storage rights prevent all search execution", async () => {
  let called = false;
  const decisions = authorizeSearchQueries({ candidates: [candidate(0)], researchMap: mapWithCriticalQuestions(1) });
  const result = await executeAuthorizedQueries({ decisions, client: new BraveExplicitSearchClient("secret", async () => { called = true; return new Response(); }, null, false), maximumConcurrency: 1 });
  assert.match(result.failure?.message || "", /EXPLICIT_SEARCH_STORAGE_RIGHTS_UNCONFIRMED/u);
  assert.equal(result.ledgerEntries[0]!.executionStatus, "PENDING");
  assert.equal(called, false);
});
