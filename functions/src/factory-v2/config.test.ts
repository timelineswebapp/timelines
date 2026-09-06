import assert from "node:assert/strict";
import test from "node:test";
import { V2_POLICY_VERSION, V2_PROMPT_VERSION, V2_SCHEMA_VERSION } from "./contracts";
import { assertV2AShadowEnabled, shadowConfig } from "./config";

test("V2-A executes only in non-public shadow mode with autonomous discovery paused", () => {
  const config = shadowConfig("2026-09-06T00:00:00.000Z");
  assert.doesNotThrow(() => assertV2AShadowEnabled(config));
  assert.equal(config.pipelineVersion, "factory-v2-a.11");
  assert.deepEqual(config.artifactPolicyBundle, { schemaVersion: V2_SCHEMA_VERSION, policyVersion: V2_POLICY_VERSION, promptVersion: V2_PROMPT_VERSION });
  assert.equal(V2_SCHEMA_VERSION, "factory-v2-a.3");
  assert.equal(V2_POLICY_VERSION, "evidence-first-v2-a.10");
  assert.equal(V2_PROMPT_VERSION, "factory-v2-a-prompts.8");
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), operatingMode: "OFF" }), /refuses/);
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), killSwitch: true }), /refuses/);
});
