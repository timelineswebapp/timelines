import assert from "node:assert/strict";
import test from "node:test";
import { sourceSubmissionUrlMatchesAuthority } from "./source-submission-eligibility";

test("submitted sources require an exact original authority binding and registered domain", () => {
  const base = { boundPublisherVersionIds: ["publisher-version-001"], publisherVersionId: "publisher-version-001", knownDomains: ["archive.example.org"] };
  assert.equal(sourceSubmissionUrlMatchesAuthority({ ...base, submittedUrl: "https://collections.archive.example.org/item/1" }), true);
  assert.equal(sourceSubmissionUrlMatchesAuthority({ ...base, submittedUrl: "https://archive-example.org/item/1" }), false);
  assert.equal(sourceSubmissionUrlMatchesAuthority({ ...base, publisherVersionId: "unbound-publisher", submittedUrl: "https://archive.example.org/item/1" }), false);
  assert.equal(sourceSubmissionUrlMatchesAuthority({ ...base, submittedUrl: "http://archive.example.org/item/1" }), false);
});
