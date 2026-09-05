import assert from "node:assert/strict";
import test from "node:test";
import { assertV2AShadowEnabled, shadowConfig } from "./config";

test("V2-A executes only in non-public shadow mode with autonomous discovery paused", () => {
  assert.doesNotThrow(() => assertV2AShadowEnabled(shadowConfig("2026-09-06T00:00:00.000Z")));
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), operatingMode: "OFF" }), /refuses/);
  assert.throws(() => assertV2AShadowEnabled({ ...shadowConfig(), killSwitch: true }), /refuses/);
});
