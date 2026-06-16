import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeImportTags } from "@/src/server/services/import-service";

describe("normalizeImportTags", () => {
  it("splits semicolon-delimited tags", () => {
    assert.deepEqual(normalizeImportTags("Rome;Politics;Military"), ["Rome", "Politics", "Military"]);
  });

  it("splits comma-delimited tags", () => {
    assert.deepEqual(normalizeImportTags("Rome,Politics,Military"), ["Rome", "Politics", "Military"]);
  });

  it("splits pipe-delimited tags", () => {
    assert.deepEqual(normalizeImportTags("Rome|Politics|Military"), ["Rome", "Politics", "Military"]);
  });

  it("deduplicates tags by normalized slug", () => {
    assert.deepEqual(normalizeImportTags("Rome;Politics;Rome"), ["Rome", "Politics"]);
  });

  it("trims whitespace around tags", () => {
    assert.deepEqual(normalizeImportTags(" Rome ; Politics ; Military "), ["Rome", "Politics", "Military"]);
  });

  it("ignores empty values", () => {
    assert.deepEqual(normalizeImportTags("Rome;; Politics, |Military|"), ["Rome", "Politics", "Military"]);
  });
});
