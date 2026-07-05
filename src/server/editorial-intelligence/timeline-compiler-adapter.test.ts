import assert from "node:assert/strict";
import test from "node:test";
import { adaptFactoryMilestonesToCompilerInput } from "@/src/server/editorial-intelligence/timeline-compiler-adapter";
import type { EditorialEvidenceSet } from "@/src/server/editorial-intelligence/contracts";
import type { FactoryObject } from "@/src/server/factory/contracts";
import { ApiError } from "@/src/server/api/responses";

const SET_ID = "00000000-0000-4000-8000-000000000001";
const MILESTONE_ID = "00000000-0000-4000-8000-000000000002";
const EVIDENCE_ID = "00000000-0000-4000-8000-000000000003";
const VALIDATION_ID = "00000000-0000-4000-8000-000000000004";

function evidenceSet(): EditorialEvidenceSet {
  return {
    editorialEvidenceSetId: SET_ID,
    topic: "Roman Republic",
    algorithmVersion: "ei-001-v1",
    inputFingerprint: "a".repeat(64),
    rankedEvidence: [{
      rank: 2, evidenceRecordId: EVIDENCE_ID, validationRecordId: VALIDATION_ID,
      duplicateOfEvidenceRecordId: null, chronologyYears: [-509],
      score: {
        historicalSignificance: 88, chronologicalImportance: 100, narrativeContribution: 70,
        coverageContribution: 100, novelty: 100, redundancy: 0, sourceDiversity: 100,
        evidenceStrength: 94, subjectCentrality: 100, total: 92
      }
    }],
    coverageAnalysis: { uniqueEvidenceCount: 1, duplicateEvidenceCount: 0, uniqueSourceCount: 1, sourceDiversityScore: 100, chronologyEvidenceRatio: 1 },
    timelineCoverage: { earliestYear: -509, latestYear: -509, representedYears: [-509], gaps: [], balanceScore: 50 },
    identifiedTurningPoints: [],
    canonicalSubject: { label: "Roman Republic", confidence: 100, supportingEvidenceRecordIds: [EVIDENCE_ID] },
    canonicalHistoricalObject: { label: "Roman Republic", supportingEvidenceRecordIds: [EVIDENCE_ID] },
    candidateMilestonesRanked: [{ rank: 1, evidenceRecordId: EVIDENCE_ID, year: -509, importanceScore: 91 }],
    editorialMetadata: { authorityDecision: false, publicationReadinessDecision: false, compilerOutput: false, evidenceRecordCount: 1, scoringScale: "integer_0_100" }
  };
}

function milestone(overrides: Partial<FactoryObject> = {}): FactoryObject {
  return {
    objectId: MILESTONE_ID,
    objectType: "candidate_milestone",
    title: "Roman Republic established",
    payload: {
      date: "509 BCE",
      datePrecision: "year",
      sourceRefs: [EVIDENCE_ID],
      evidence: [{ citations: [{ evidenceRecordId: EVIDENCE_ID }] }]
    },
    lifecycle: "draft",
    provenance: {},
    createdBy: "test",
    updatedBy: "test",
    ...overrides
  };
}

test("maps exact EI-001 evidence and Chronology Authority fields without identity inference", () => {
  const input = adaptFactoryMilestonesToCompilerInput({ editorialEvidenceSet: evidenceSet(), milestones: [milestone()] });
  assert.equal(input.canonicalSubject, "Roman Republic");
  assert.equal(input.milestones[0]!.canonicalIdentity, "Roman Republic established");
  assert.deepEqual(input.milestones[0]!.chronology, { sortYear: -509, sortMonth: null, sortDay: null, precision: "year" });
  assert.deepEqual(input.milestones[0]!.evidenceLineage, [{ evidenceRecordId: EVIDENCE_ID, validationRecordId: VALIDATION_ID }]);
  assert.equal(input.milestones[0]!.importanceScore, 91);
  assert.equal(input.milestones[0]!.evidenceStrength, 94);
});

test("rejects unrelated evidence, unsupported dates, and non-milestone objects", () => {
  const unrelated = milestone({ payload: { date: "509 BCE", datePrecision: "year", sourceRefs: ["00000000-0000-4000-8000-000000000099"] } });
  assert.throws(
    () => adaptFactoryMilestonesToCompilerInput({ editorialEvidenceSet: evidenceSet(), milestones: [unrelated] }),
    (error) => error instanceof ApiError && error.code === "EDITORIAL_COMPILER_UNRELATED_MILESTONE"
  );
  assert.throws(
    () => adaptFactoryMilestonesToCompilerInput({ editorialEvidenceSet: evidenceSet(), milestones: [milestone({ payload: { date: "unknown", datePrecision: "year", sourceRefs: [EVIDENCE_ID] } })] }),
    (error) => error instanceof ApiError && error.code === "EDITORIAL_COMPILER_CHRONOLOGY_INVALID"
  );
  assert.throws(
    () => adaptFactoryMilestonesToCompilerInput({ editorialEvidenceSet: evidenceSet(), milestones: [milestone({ objectType: "candidate_source" })] }),
    (error) => error instanceof ApiError && error.code === "EDITORIAL_COMPILER_OBJECT_TYPE_INVALID"
  );
});

