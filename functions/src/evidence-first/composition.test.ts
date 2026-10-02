import assert from "node:assert/strict";
import test from "node:test";
import type { AtomicClaimVersion, EvidenceSegment } from "../factory-v2/contracts";
import { attachPayloadHash, contentAddressedId } from "../factory-v2/hashing";
import { eventLockSchema } from "./contracts";
import { composeFromEventLock, type CompositionProvider } from "./composition";

const claim = { claimVersionId: "claim-1", normalizedAssertion: "The verified launch occurred.", extractedFromSegmentIds: ["segment-1"] } as AtomicClaimVersion;
const evidence = { evidenceSegmentId: "segment-1", exactText: "The verified launch occurred.", sourceSnapshotId: "snapshot-1" } as EvidenceSegment;
const lockSemantic = {
  artifactType: "EVENT_LOCK" as const,
  schemaVersion: "event-lock-v1" as const,
  pipelineVersion: "evidence-first-generation-v1" as const,
  corpusId: "test-clean-corpus",
  topicId: "topic-1",
  generation: 1,
  generationReleaseId: "release-1",
  scopeContractId: "scope-1",
  scopePayloadHash: "a".repeat(64),
  completedKnowledgeSetId: "knowledge-1",
  completedKnowledgeSetHash: "b".repeat(64),
  selectionArtifactId: "selection-1",
  selectionPayloadHash: "c".repeat(64),
  parentArtifactIds: ["scope-1", "knowledge-1", "selection-1"],
  events: [{ eventVersionId: "event-1", canonicalTitle: "Verified launch", temporal: { start: { year: 1969, month: 7, day: 16, precision: "DAY", earliestYear: null, latestYear: null, label: "16 July 1969" }, end: null, uncertainty: null }, significanceClass: "ESSENTIAL", selectionRationale: "This event opens the mission chronology.", coreClaimVersionIds: ["claim-1"], supportingClaimVersionIds: [], evidenceSegmentIds: ["segment-1"], sourceSnapshotIds: ["snapshot-1"] }]
    .map((event, index) => ({ ordinal: index + 1, ...event })),
  executionMode: "SHADOW" as const,
  publicationEligible: false as const,
  immutable: true as const,
  governanceSubmissionAllowed: false as const
};
const eventLockId = contentAddressedId("event-lock", lockSemantic);
const lock = eventLockSchema.parse(attachPayloadHash({ artifactId: eventLockId, eventLockId, ...lockSemantic }));

const valid = { eventLockId, title: "Apollo 11", description: "A source-grounded account of the Apollo 11 mission and the operational sequence that carried it from launch onward.", category: "Space exploration", tags: ["Apollo 11", "Moon landing"], events: [{ eventVersionId: "event-1", description: "The launch began the operational Apollo 11 mission and placed its crew on the trajectory toward lunar operations.", evidenceSummary: "The cited record directly establishes that the verified launch occurred.", location: "Florida", tags: ["Launch"], claimVersionIdsUsed: ["claim-1"], evidenceSegmentIdsUsed: ["segment-1"] }] };

function provider(responses: unknown[]): CompositionProvider {
  let index = 0;
  return { generateContent: async (request) => {
    const config = request.config as Record<string, unknown>;
    assert.equal(config.responseMimeType, "application/json");
    assert.equal("tools" in request, false);
    return { text: JSON.stringify(responses[index++]), usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } };
  } };
}

test("constrained writer has no research tool and seals a valid Event Lock composition", async () => {
  const result = await composeFromEventLock({ eventLock: lock, claims: [claim], evidenceSegments: [evidence], provider: provider([valid]), deadlineAt: Date.now() + 10_000 });
  assert.equal(result.composition.eventLockId, lock.eventLockId);
  assert.equal(result.execution.validationState, "VALID");
  assert.equal(result.execution.transportAttempts, 1);
});

test("constrained writer repairs wording contract from the same Event Lock only once", async () => {
  const invalid = { ...valid, events: [{ ...valid.events[0], claimVersionIdsUsed: ["invented-claim"] }] };
  const result = await composeFromEventLock({ eventLock: lock, claims: [claim], evidenceSegments: [evidence], provider: provider([invalid, valid]), deadlineAt: Date.now() + 10_000 });
  assert.equal(result.execution.validationState, "REPAIRED");
  assert.equal(result.execution.transportAttempts, 2);
});

test("constrained writer fails closed when repair still changes historical knowledge", async () => {
  const invalid = { ...valid, events: [{ ...valid.events[0], evidenceSegmentIdsUsed: ["invented-evidence"] }] };
  await assert.rejects(() => composeFromEventLock({ eventLock: lock, claims: [claim], evidenceSegments: [evidence], provider: provider([invalid, invalid]), deadlineAt: Date.now() + 10_000 }), /CONSTRAINED_COMPOSITION_FAILED/);
});

test("constrained writer retries transient transport failures within the same Event Lock", async () => {
  let calls = 0;
  const result = await composeFromEventLock({ eventLock: lock, claims: [claim], evidenceSegments: [evidence], provider: { generateContent: async () => {
    calls += 1;
    if (calls < 3) throw new Error("temporary provider unavailable");
    return { text: JSON.stringify(valid) };
  } }, deadlineAt: Date.now() + 10_000 });
  assert.equal(calls, 3);
  assert.equal(result.execution.transportAttempts, 3);
});

test("constrained writer fails closed after transport retry exhaustion", async () => {
  let calls = 0;
  await assert.rejects(() => composeFromEventLock({ eventLock: lock, claims: [claim], evidenceSegments: [evidence], provider: { generateContent: async () => {
    calls += 1;
    throw new Error("provider unavailable");
  } }, deadlineAt: Date.now() + 10_000 }), /CONSTRAINED_COMPOSITION_TRANSPORT_EXHAUSTED/);
  assert.equal(calls, 3);
});
