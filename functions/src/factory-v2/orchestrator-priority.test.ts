import assert from "node:assert/strict";
import test from "node:test";
import { buildRegisteredAuthorityGroundingQuery, failedGroundingEscalationOperation, prioritizeContinuationQuestionIds, shouldContinueSameAuthorityDiscovery } from "./orchestrator";

test("bounded continuation escalation follows sealed completion-plan order", () => {
  const ordered = prioritizeContinuationQuestionIds(["chronology", "casualties", "relief", "rebuilding"], ["relief", "casualties", "rebuilding", "chronology"]);
  assert.deepEqual(ordered.slice(0, 2), ["relief", "casualties"]);
});

test("specialist and sitemap discovery never suppress their sealed same-authority fallback", () => {
  assert.equal(shouldContinueSameAuthorityDiscovery({ status: "SUCCEEDED", returnedUrls: ["https://example.org/collections/"], specialistCollectionProfileId: "specialist-profile-1", mechanism: "DIRECT_URL" }), true);
  assert.equal(shouldContinueSameAuthorityDiscovery({ status: "SUCCEEDED", returnedUrls: ["https://example.org/governance"], specialistCollectionProfileId: null, mechanism: "SITEMAP" }), true);
  assert.equal(shouldContinueSameAuthorityDiscovery({ status: "SUCCEEDED", returnedUrls: ["https://example.org/topic"], specialistCollectionProfileId: null, mechanism: "DIRECT_URL" }), false);
  assert.equal(shouldContinueSameAuthorityDiscovery({ status: "FAILED", returnedUrls: [], specialistCollectionProfileId: null, mechanism: "DIRECT_URL" }), true);
});

test("grounding escalation is constrained to the sealed registered-authority domains", () => {
  const query = buildRegisteredAuthorityGroundingQuery({ title: "Example", question: "What happened?", verifiedDomains: ["Archives.gov", "archives.gov", "loc.gov"] });
  assert.match(query, /registered authority domains: archives\.gov, loc\.gov/);
  assert.doesNotMatch(query, /site:/);
  assert.doesNotMatch(query, /example\.com/);
});

test("unattributable Grounding is retained as a failed bounded operation and cannot become evidence", () => {
  const operation = failedGroundingEscalationOperation({
    escalationDecisionId: "escalation-decision-1234567890", researchQuestionId: "research-question-1234567890",
    purpose: "Locate directly retrievable registered-authority evidence for the unmet question.", error: new Error("GROUNDING_UNATTRIBUTABLE_SUPPORT")
  });
  assert.equal(operation.status, "FAILED");
  assert.equal(operation.mechanism, "GOOGLE_GROUNDING_ESCALATION");
  assert.deepEqual(operation.returnedUrls, []);
  assert.deepEqual(operation.providerInternalQueries, []);
  assert.equal(operation.latencyMs, null);
  assert.equal(operation.failureReason, "GROUNDING_UNATTRIBUTABLE_SUPPORT");
});
