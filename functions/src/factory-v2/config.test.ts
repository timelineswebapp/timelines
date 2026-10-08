import assert from "node:assert/strict";
import test from "node:test";
import { V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, V2_POLICY_VERSION, V2_PROMPT_VERSION, V2_SCHEMA_VERSION } from "./contracts";
import { assertV2AShadowEnabled, authorityFirstRunDeadlineAt, shadowConfig } from "./config";

test("V2-A executes only in non-public shadow mode with autonomous discovery paused", () => {
  const config = shadowConfig("2026-09-06T00:00:00.000Z");
  assert.doesNotThrow(() => assertV2AShadowEnabled(config));
  assert.equal(config.pipelineVersion, "factory-v2-a.41");
  assert.deepEqual(config.artifactPolicyBundle, { schemaVersion: V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, policyVersion: V2_POLICY_VERSION, promptVersion: V2_PROMPT_VERSION });
  assert.equal(V2_COMPLETED_KNOWLEDGE_SET_SCHEMA_VERSION, "factory-v2-a.6");
  assert.equal(V2_SCHEMA_VERSION, "factory-v2-a.4");
  assert.equal(V2_POLICY_VERSION, "authority-first-research.15");
  assert.equal(V2_PROMPT_VERSION, "factory-v2-a-prompts.13");
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), operatingMode: "OFF" }), /refuses/);
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), killSwitch: true }), /refuses/);
});

test("Authority-First whole-run deadline honors the versioned worker budget", () => {
  const startedAt = 1_000_000;
  assert.equal(authorityFirstRunDeadlineAt(startedAt, 1_200), startedAt + 1_200_000);
});
