import assert from "node:assert/strict";
import test from "node:test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { V2FirestoreRepository } from "./firestore";
import { scopeFixture, TEST_CONTEXT } from "../test-fixtures";
import { buildEvidenceSegment, buildAtomicClaimVersion, buildClaimEvidenceEdge, immutableEnvelope, sealArtifact } from "../contracts/builders";

const enabled = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

test("Firestore emulator enforces corpus paths, immutable idempotency, heads, and edge integrity", { skip: !enabled }, async () => {
  const app = getApps()[0] || initializeApp({ projectId: "tiimeliines" });
  const firestore = getFirestore(app);
  const repository = new V2FirestoreRepository({ firestore, corpusId: TEST_CONTEXT.corpusId });
  const scope = scopeFixture();
  assert.equal(repository.reference("v2ScopeContracts", scope.artifactId).path, `corpora/${TEST_CONTEXT.corpusId}/v2ScopeContracts/${scope.artifactId}`);
  assert.equal(await repository.createImmutable("v2ScopeContracts", scope), "CREATED");
  assert.equal(await repository.createImmutable("v2ScopeContracts", scope), "IDEMPOTENT");
  const collision = sealArtifact({ ...scope, title: "Collision payload" });
  await assert.rejects(repository.createImmutable("v2ScopeContracts", collision), /collision/);
  await assert.rejects(new V2FirestoreRepository({ firestore, corpusId: "other-clean-corpus" }).createImmutable("v2ScopeContracts", scope), /Cross-corpus/);

  const segment = buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-existing", exactText: "Apollo 11 launched from Kennedy Space Center on July 16, 1969.", segmentType: "TEXT", startOffset: 0, endOffset: 65, page: null, section: null, selector: null, extractionMethod: "TEST", sourceCompleteness: "FULL_SNAPSHOT" });
  const snapshot = sealArtifact({ ...immutableEnvelope(TEST_CONTEXT, "snapshot-existing"), sourceSnapshotId: "snapshot-existing", contentHash: "0".repeat(64) });
  await repository.createImmutable("v2SourceSnapshots", snapshot);
  await repository.createImmutable("v2EvidenceSegments", segment);
  const batchedSegments = [1, 2].map((index) => buildEvidenceSegment(TEST_CONTEXT, { sourceSnapshotId: "snapshot-existing", exactText: `Bounded batch evidence segment ${index}.`, segmentType: "TEXT", startOffset: index * 40, endOffset: index * 40 + 33, page: null, section: null, selector: null, extractionMethod: "TEST", sourceCompleteness: "FULL_SNAPSHOT" }));
  assert.deepEqual(await repository.createImmutableBatch("v2EvidenceSegments", batchedSegments), { created: 2, idempotent: 0 });
  assert.deepEqual(await repository.createImmutableBatch("v2EvidenceSegments", batchedSegments), { created: 0, idempotent: 2 });
  await assert.rejects(repository.createImmutableBatch("v2EvidenceSegments", [batchedSegments[0]!, batchedSegments[0]!]), /unique artifact IDs/);

  const claim = buildAtomicClaimVersion(TEST_CONTEXT, { scopeContractId: scope.scopeContractId, subject: { kind: "EVENT", id: null, label: "Apollo 11 launch" }, predicate: "DATE", object: { kind: "DATE", id: null, value: { year: 1969, month: 7, day: 16, precision: "DAY", earliestYear: null, latestYear: null, label: "July 16, 1969" } }, normalizedAssertion: "Apollo 11 launched July 16, 1969", claimType: "DATE", risk: "MATERIAL", temporal: null, candidateEventClusterId: null, locationEntityIds: [], qualifiers: [], extractedFromSnapshotId: "snapshot-existing", extractedFromSegmentIds: [segment.evidenceSegmentId], conflictState: "NONE", validationState: "STRUCTURALLY_VALID", evidenceVerdictId: null, supersedesClaimVersionId: null });
  await repository.createImmutable("v2AtomicClaimVersions", claim);
  const edge = buildClaimEvidenceEdge(TEST_CONTEXT, { claimVersionId: claim.claimVersionId, evidenceSegmentId: segment.evidenceSegmentId, relationship: "SUPPORTS", relevance: "DIRECT", authorityFinding: "STRONG", publisherVersionId: null, independenceGroupId: "independence-test", dependenceBasis: [], evaluator: "DETERMINISTIC" });
  assert.equal(await repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge, references: [{ collection: "v2AtomicClaimVersions", id: claim.artifactId }, { collection: "v2EvidenceSegments", id: segment.artifactId }] }), "CREATED");
  const broken = buildClaimEvidenceEdge(TEST_CONTEXT, { claimVersionId: claim.claimVersionId, evidenceSegmentId: "missing-segment", relationship: "SUPPORTS", relevance: "DIRECT", authorityFinding: "STRONG", publisherVersionId: null, independenceGroupId: "independence-test", dependenceBasis: [], evaluator: "DETERMINISTIC" });
  await assert.rejects(repository.createEdgeWithReferences({ collection: "v2ClaimEvidence", edge: broken, references: [{ collection: "v2AtomicClaimVersions", id: claim.artifactId }, { collection: "v2EvidenceSegments", id: "missing-segment" }] }), /referential integrity/);

  assert.equal(await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: null, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, state: "CANDIDATE", updatedAt: TEST_CONTEXT.createdAt } }), "CREATED");
  assert.equal(await repository.advanceHead({ collection: "v2AtomicClaims", headId: claim.claimId, expectedCurrentVersionId: null, nextVersionId: claim.claimVersionId, data: { claimId: claim.claimId, state: "CANDIDATE", updatedAt: TEST_CONTEXT.createdAt } }), "IDEMPOTENT");
  await assert.rejects(repository.boundedQuery("v2AtomicClaimVersions", [], 201), /explicit limit/);
  const reconstructed = await repository.reference("v2ScopeContracts", scope.artifactId).get();
  assert.equal(reconstructed.data()?.payloadHash, scope.payloadHash);
});
