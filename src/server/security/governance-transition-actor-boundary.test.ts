import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const transitionRoutes = [
  "approvals/[id]/approve-step", "approvals/[id]/complete-chain", "approvals/[id]/reject-step",
  "decisions/[id]/approve", "decisions/[id]/escalate", "decisions/[id]/reject", "decisions/[id]/review", "decisions/[id]/submit", "decisions/[id]/supersede",
  "disputes/[id]/close", "disputes/[id]/escalate", "disputes/[id]/resolve", "disputes/[id]/triage",
  "feedback-packages/[id]/acknowledge", "feedback-packages/[id]/close", "feedback-packages/[id]/resolve",
  "publication-packages/[id]/accept", "publication-packages/[id]/certify-readiness", "publication-packages/[id]/publish", "publication-packages/[id]/reject", "publication-packages/[id]/return", "publication-packages/[id]/submit-library-review", "publication-packages/[id]/submit",
  "queues/[id]/advance", "queues/[id]/escalate"
];

test("every actor-bearing Governance transition derives authority from an appointment", async () => {
  for (const route of transitionRoutes) {
    const source = await readFile(join(process.cwd(), "app/api/admin/governance", route, "route.ts"), "utf8");
    assert.match(source, /resolveInstitutionalActor/);
    assert.match(source, /omit\(\{ actor: true \}\)/);
    assert.match(source, /\["governance"\]/);
  }
});

test("Governance initiation derives its current actor from an appointment", async () => {
  const [decision, approval] = await Promise.all([
    readFile(join(process.cwd(), "app/api/admin/governance/decisions/route.ts"), "utf8"),
    readFile(join(process.cwd(), "app/api/admin/governance/approvals/route.ts"), "utf8")
  ]);
  assert.match(decision, /governanceDecisionSchema\.omit\(\{ actor: true \}\)/);
  assert.match(decision, /governance\.decision\.create/);
  assert.match(approval, /omit\(\{ requestedBy: true \}\)/);
  assert.match(approval, /governance\.approval\.create/);
});

test("Historical Library mutations derive authority from a Library appointment", async () => {
  const routes = [
    "admissions/[packageId]", "feedback-packages",
    "published-snapshots/[id]/merge", "published-snapshots/[id]/preservations",
    "published-snapshots/[id]/retirements", "published-snapshots/[id]/revisions",
    "published-snapshots/[id]/splits", "published-snapshots/[id]/supersessions",
    "published-snapshots/[id]/withdrawals"
  ];
  for (const route of routes) {
    const source = await readFile(join(process.cwd(), "app/api/admin/historical-library", route, "route.ts"), "utf8");
    assert.match(source, /resolveInstitutionalActor/);
    assert.match(source, /omit\(\{ actor: true \}\)/);
    assert.match(source, /\["historical_library"\]/);
  }
});
