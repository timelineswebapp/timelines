import assert from "node:assert/strict";
import test from "node:test";
import { hashProtectedDocuments, protectedStateUnchanged, PROTECTED_COLLECTIONS, type ProtectedState } from "./protected-state";

test("protected collection hashes are content-sensitive and independent of read order", () => {
  const documents = [{ id: "b", data: { nested: { value: 2 } } }, { id: "a", data: { nested: { value: 1 } } }];
  assert.equal(hashProtectedDocuments(documents), hashProtectedDocuments([...documents].reverse()));
  assert.notEqual(hashProtectedDocuments(documents), hashProtectedDocuments([{ id: "a", data: { nested: { value: 9 } } }, documents[0]!]));
});

test("protected state parity requires both exact counts and content hashes", () => {
  const state = Object.fromEntries(PROTECTED_COLLECTIONS.map((name) => [name, { count: 1, sha256: "a".repeat(64) }])) as ProtectedState;
  assert.equal(protectedStateUnchanged(state, structuredClone(state)), true);
  const changed = structuredClone(state);
  changed.governanceDecisions.sha256 = "b".repeat(64);
  assert.equal(protectedStateUnchanged(state, changed), false);
});
