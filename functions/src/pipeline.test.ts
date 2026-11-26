import assert from "node:assert/strict";
import test from "node:test";
import { requiresHumanGovernanceReview } from "./pipeline";

test("autonomous generation always requires Founder Governance review", () => {
  assert.equal(
    requiresHumanGovernanceReview({ origin: "autonomous" }, { outcome: "routine" }),
    true
  );
});

test("routine non-autonomous generation retains the institutional transition path", () => {
  assert.equal(
    requiresHumanGovernanceReview({ origin: "founder" }, { outcome: "routine" }),
    false
  );
});

test("exceptional generation always requires Founder Governance review", () => {
  assert.equal(
    requiresHumanGovernanceReview({ origin: "user" }, { outcome: "exceptional" }),
    true
  );
});
