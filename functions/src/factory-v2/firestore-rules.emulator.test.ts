import assert from "node:assert/strict";
import test from "node:test";

test("Unauthenticated browser-style REST access cannot read or write private V2 Production Memory", { skip: !process.env.FIRESTORE_EMULATOR_HOST }, async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST!;
  const documentUrl = `http://${host}/v1/projects/tiimeliines/databases/(default)/documents/corpora/test-clean-corpus/v2AtomicClaims/browser-attempt`;
  const write = await fetch(documentUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fields: { state: { stringValue: "FORGED" } } }) });
  assert.equal(write.status, 403);
  const read = await fetch(documentUrl);
  assert.equal(read.status, 403);
  const publicRead = await fetch(`http://${host}/v1/projects/tiimeliines/databases/(default)/documents/corpora/test-clean-corpus/platformReadModels/timeline--fixture`);
  assert.equal(publicRead.status, 403);
});
