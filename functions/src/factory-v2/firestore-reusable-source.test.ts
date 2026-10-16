import assert from "node:assert/strict";
import test from "node:test";
import { V2FirestoreRepository } from "./repositories/firestore";
import { contentAddressedId } from "./hashing";

test("reusable-source cache rejects a source document whose Firestore identity is corrupted", async () => {
  const corpusId = "reusable-source-corpus";
  const canonicalUrl = "https://example.org/reusable-source";
  const sourceId = contentAddressedId("source", canonicalUrl);
  const repository = new V2FirestoreRepository({ firestore: {} as never, corpusId });
  (repository as any).getById = async () => ({
    id: "source-document-mismatch",
    sourceId,
    corpusId,
    canonicalUrl,
    canonicalUrlHash: "a".repeat(64),
    publisherId: null,
    title: "Reusable source",
    authors: [],
    publicationDate: null,
    sourceClass: "PRIMARY_INSTITUTIONAL",
    language: "en",
    primarySecondaryRole: "PRIMARY",
    authorityDomains: ["history"],
    access: "OPEN",
    currentSnapshotId: "reusable-snapshot",
    supersedesSourceId: null,
    identityHash: "b".repeat(64),
    updatedAt: "2026-10-16T05:00:00.000Z"
  });

  await assert.rejects(repository.getReusableSource(canonicalUrl), /source document identity/);
});
