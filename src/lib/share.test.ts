import assert from "node:assert/strict";
import test from "node:test";
import { parseEventIdParam, parseMilestoneIdParam } from "@/src/lib/share";

test("public share identifiers accept only one canonical positive integer", () => {
  for (const parse of [parseEventIdParam, parseMilestoneIdParam]) {
    assert.equal(parse("42"), 42);
    assert.equal(parse(" 42 "), 42);
    assert.equal(parse(["42", "43"]), null);
    assert.equal(parse([]), null);
    assert.equal(parse("42.0"), null);
    assert.equal(parse("0"), null);
    assert.equal(parse("9007199254740992"), null);
  }
});
