import assert from "node:assert/strict";
import test from "node:test";
import { buildAtomicClaimVersion, buildCanonicalEventVersion, buildEvidenceSegment, buildResearchMap } from "../factory-v2/contracts/builders";
import type { ClaimAuthorityVerdict } from "../factory-v2/contracts";
import type { SourceDocument, SourceSnapshot } from "../factory-v2/contracts";
import type { SignificanceProposal } from "../factory-v2/contracts/assembly";
import { assembleTimelineSelection } from "../factory-v2/selection";
import { TEST_CONTEXT, date, scopeFixture } from "../factory-v2/test-fixtures";
import { buildEventLock, sealConstrainedComposition } from "./contracts";
import { adaptEvidenceFirstForInstitutionalGates } from "./gate-adapter";
import { assessEditorialPlan, assessTimelineQuality } from "../quality";
import { assessSourceAuthority } from "../source-authority";

const scope = scopeFixture();
const map = buildResearchMap(TEST_CONTEXT, scope, {
  version: 1,
  phases: scope.expectedPhases.map((label, index) => ({ phaseId: `phase-${index + 1}`, label, temporalRule: `The locked ${label} phase.`, required: true, rationale: `Required ${label} phase coverage.` })),
  dimensions: scope.requiredDimensions.map((label, index) => ({ dimensionId: `dimension-${index + 1}`, label, required: true, rationale: `Required ${label} coverage.` })),
  entities: [],
  questions: scope.expectedPhases.map((label, index) => ({ questionId: `question-${index + 1}`, text: `What occurred in the ${label} phase of the mission?`, phaseIds: [`phase-${index + 1}`], dimensionIds: [`dimension-${index % 2 + 1}`], claimTypesExpected: ["OCCURRENCE"], likelySourceClasses: ["PRIMARY_INSTITUTIONAL"], expectedAuthorities: ["NASA"], languages: ["en"], geography: ["Earth"], contested: false, dateCritical: true, priority: "CRITICAL" as const, state: "SATISFIED" as const })),
  terminology: [],
  knownUncertainty: []
});

const criteria = { turningPointValue: "HIGH", causalImportance: "HIGH", consequence: "HIGH", institutionalImportance: "MEDIUM", adoptionOrScale: "LOW", explanatoryValue: "HIGH", topicRelevance: "HIGH", historiographicalProminence: "HIGH", relationshipToLaterDevelopments: "MEDIUM", uniqueness: "HIGH" } as const;

function fixture() {
  const days = [16, 17, 18, 20, 21, 24];
  const segments = Array.from({ length: 6 }, (_, index) => buildEvidenceSegment(TEST_CONTEXT, {
    sourceSnapshotId: `snapshot-${index}`,
    exactText: `Authoritative evidence for locked Apollo mission event number ${index + 1}.`,
    segmentType: "TEXT",
    startOffset: null,
    endOffset: null,
    page: null,
    section: "Mission chronology",
    selector: null,
    extractionMethod: "fixture",
    sourceCompleteness: "FULL_SNAPSHOT"
  }));
  const claims = segments.map((segment, index) => buildAtomicClaimVersion(TEST_CONTEXT, {
    scopeContractId: scope.scopeContractId,
    subject: { kind: "EVENT", id: null, label: `Apollo mission event ${index + 1}` },
    predicate: "OCCURRENCE",
    object: { kind: "TEXT", id: null, value: `Apollo mission event ${index + 1} occurred` },
    normalizedAssertion: `Apollo mission event ${index + 1} occurred`,
    claimType: "OCCURRENCE",
    risk: "ROUTINE",
    temporal: { start: date(1969, "DAY", 7, days[index]!), end: null },
    candidateEventClusterId: null,
    locationEntityIds: [],
    qualifiers: [],
    extractedFromSnapshotId: segment.sourceSnapshotId,
    extractedFromSegmentIds: [segment.evidenceSegmentId],
    conflictState: "NONE",
    validationState: "SUPPORTED",
    evidenceVerdictId: `verdict-${index}`,
    supersedesClaimVersionId: null
  }));
  const events = claims.map((claim, index) => buildCanonicalEventVersion(TEST_CONTEXT, {
    version: 1,
    scopeContractId: scope.scopeContractId,
    canonicalTitle: `Apollo mission event ${index + 1}`,
    semanticClass: "EVENT",
    eventSubtype: "OCCURRENCE",
    temporal: { start: date(1969, "DAY", 7, days[index]!), end: null, uncertainty: null },
    actionKey: `mission-action-${index}`,
    primaryEntityKeys: ["apollo-11"],
    locationKeys: ["mission-area"],
    coreClaimVersionIds: [claim.claimVersionId],
    supportingClaimVersionIds: [],
    authorityState: "FACTORY_CANDIDATE",
    canonicalizationState: "RESOLVED",
    parentEventId: null,
    supersedesEventVersionId: null
  }));
  const verdicts = claims.map((claim) => ({ claimVersionId: claim.claimVersionId, verdict: "SUPPORTED" } as ClaimAuthorityVerdict));
  const significance: SignificanceProposal = {
    judgments: events.map((event, index) => ({ eventVersionId: event.eventVersionId, significanceClass: "ESSENTIAL", comparativeRank: index + 1, criteria, rationale: `This occurrence is essential to the complete locked Apollo mission account ${index + 1}.`, phaseCoverage: [{ phaseId: `phase-${index % 3 + 1}`, relation: "PRIMARY", rationale: "This occurrence directly represents the required mission phase." }], dimensionCoverage: [{ dimensionId: `dimension-${index % 2 + 1}`, relation: "PRIMARY", rationale: "This occurrence directly represents the required mission dimension." }], redundantWithEventVersionIds: [], redundancyRationale: null })),
    comparisons: [],
    completenessFindings: []
  };
  const completedKnowledgeSet = { completedKnowledgeSetId: "completed-set-1", payloadHash: "a".repeat(64) };
  const selection = assembleTimelineSelection({
    context: { ...TEST_CONTEXT, completedKnowledgeSetId: completedKnowledgeSet.completedKnowledgeSetId, completedKnowledgeSetHash: completedKnowledgeSet.payloadHash, finalCoverageAuditId: "final-audit-1", finalCoverageAuditHash: "b".repeat(64), candidateInputHash: "c".repeat(64) },
    scope,
    researchMap: map,
    events,
    claims,
    authorityVerdicts: verdicts,
    conflicts: [],
    significance,
    modelExecutionRef: null
  });
  const lockInput = { corpusId: TEST_CONTEXT.corpusId, topicId: TEST_CONTEXT.topicId, generation: 1, generationReleaseId: "release-1", scope, completedKnowledgeSet, selection, events, claims, evidenceSegments: segments };
  const eventLock = buildEventLock(lockInput);
  return { eventLock, lockInput, scope, map, selection, events, claims, segments };
}

function proposal(eventLock: ReturnType<typeof fixture>["eventLock"]) {
  return {
    eventLockId: eventLock.eventLockId,
    title: "Apollo 11 Mission",
    description: "A source-grounded chronological account of Apollo 11 from launch through lunar operations and safe return to Earth.",
    category: "Space exploration",
    tags: ["Apollo 11", "Moon landing"],
    events: eventLock.events.map((event) => ({ eventVersionId: event.eventVersionId, description: `This locked occurrence explains an essential step in the Apollo 11 mission chronology and its immediate operational meaning.`, evidenceSummary: `The cited mission evidence directly supports the occurrence represented by ${event.canonicalTitle}.`, location: "Earth–Moon system", tags: ["Apollo 11"], claimVersionIdsUsed: [...event.coreClaimVersionIds], evidenceSegmentIdsUsed: [...event.evidenceSegmentIds] }))
  };
}

test("Event Lock seals exact selected events, dates, claims, evidence, and lineage", () => {
  const { eventLock, lockInput } = fixture();
  assert.equal(eventLock.events.length, 6);
  assert.equal(eventLock.events[0]!.temporal.start.day, 16);
  assert.equal(eventLock.governanceSubmissionAllowed, false);
  assert.equal(eventLock.payloadHash.length, 64);
  assert.deepEqual(buildEventLock(lockInput), eventLock);
});

test("constrained composition is deterministic and preserves exact Event Lock membership", () => {
  const { eventLock } = fixture();
  const composed = sealConstrainedComposition({ eventLock, proposal: proposal(eventLock) });
  const replay = sealConstrainedComposition({ eventLock, proposal: proposal(eventLock) });
  assert.equal(composed.compositionId, replay.compositionId);
  assert.equal(composed.eventLockPayloadHash, eventLock.payloadHash);
  assert.deepEqual(composed.events.map((event) => event.eventVersionId), eventLock.events.map((event) => event.eventVersionId));
});

test("composition cannot alter membership, claims, evidence, or Event Lock identity", () => {
  const { eventLock } = fixture();
  const base = proposal(eventLock);
  assert.throws(() => sealConstrainedComposition({ eventLock, proposal: { ...base, eventLockId: "different-lock" } }), /EVENT_LOCK_MISMATCH/);
  assert.throws(() => sealConstrainedComposition({ eventLock, proposal: { ...base, events: base.events.slice(1) } }), /MEMBERSHIP_CHANGED/);
  assert.throws(() => sealConstrainedComposition({ eventLock, proposal: { ...base, events: base.events.map((event, index) => index === 0 ? { ...event, claimVersionIdsUsed: ["invented-claim"] } : event) } }), /CLAIM_BOUNDARY_VIOLATION/);
  assert.throws(() => sealConstrainedComposition({ eventLock, proposal: { ...base, events: base.events.map((event, index) => index === 0 ? { ...event, evidenceSegmentIdsUsed: ["invented-evidence"] } : event) } }), /EVIDENCE_BOUNDARY_VIOLATION/);
});

test("Event Lock adapts into unchanged Timeline Quality and final Source Authority gates", () => {
  const { eventLock, scope, map, selection, events, claims, segments } = fixture();
  const composition = sealConstrainedComposition({ eventLock, proposal: proposal(eventLock) });
  const sourceDocuments = segments.map((segment, index) => ({ sourceId: `source-${index}`, title: `NASA mission record ${index + 1}`, canonicalUrl: `https://www.nasa.gov/history/apollo-${index + 1}` } as SourceDocument));
  const sourceSnapshots = segments.map((segment, index) => ({ sourceSnapshotId: segment.sourceSnapshotId, sourceId: `source-${index}`, retrievedAt: "2026-09-09T00:00:00.000Z" } as SourceSnapshot));
  const adapted = adaptEvidenceFirstForInstitutionalGates({ scope, researchMap: map, selection, eventLock, composition, events, claims, evidenceSegments: segments, sourceSnapshots, sourceDocuments });
  const allowedSourceRefs = new Set(adapted.sources.map((source) => source.sourceId));
  const allowedEvidenceRefs = new Set(adapted.evidenceSegments.map((segment) => segment.evidenceRef));
  assert.deepEqual(assessEditorialPlan({ plan: adapted.plan, allowedSourceRefs, allowedEvidenceRefs }), []);
  assert.equal(assessTimelineQuality({ plan: adapted.plan, timeline: adapted.timeline, allowedSourceRefs, allowedEvidenceRefs }).verdict, "passed");
  assert.equal(assessSourceAuthority({ timeline: adapted.timeline, sources: adapted.sources, evidenceSegments: adapted.evidenceSegments }).overallVerdict, "passed");
  assert.deepEqual(adapted.timeline.events.map((event) => event.title), eventLock.events.map((event) => event.canonicalTitle));
});
