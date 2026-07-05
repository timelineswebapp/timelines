import assert from "node:assert/strict";
import test from "node:test";
import {
  EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION,
  EDITORIAL_TIMELINE_COMPILER_VERSION,
  type EditorialTimelineCompilerInput,
  type GroundedMilestoneCandidate
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import { compileEditorialTimeline } from "@/src/server/editorial-intelligence/timeline-compiler";

const EVIDENCE_SET_ID = "00000000-0000-4000-8000-000000000001";

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function milestone(input: {
  id: number;
  identity: string;
  year: number;
  month?: number | null;
  day?: number | null;
  precision?: GroundedMilestoneCandidate["chronology"]["precision"];
  rank?: number;
  importance?: number;
  strength?: number;
}): GroundedMilestoneCandidate {
  return {
    milestoneId: uuid(input.id),
    canonicalIdentity: input.identity,
    chronology: {
      sortYear: input.year,
      sortMonth: input.month ?? null,
      sortDay: input.day ?? null,
      precision: input.precision ?? "year"
    },
    evidenceLineage: [{
      evidenceRecordId: uuid(input.id + 100),
      validationRecordId: uuid(input.id + 200)
    }],
    editorialRank: input.rank ?? input.id,
    importanceScore: input.importance ?? 80,
    evidenceStrength: input.strength ?? 90
  };
}

function compilerInput(topic: string, milestones: readonly GroundedMilestoneCandidate[]): EditorialTimelineCompilerInput {
  return { canonicalSubject: topic, editorialEvidenceSetId: EVIDENCE_SET_ID, milestones };
}

test("is referentially transparent and independent of input order", () => {
  const milestones = [
    milestone({ id: 3, identity: "ARPANET adopts TCP/IP", year: 1983 }),
    milestone({ id: 1, identity: "ARPANET first connection", year: 1969, month: 10, day: 29, precision: "day" }),
    milestone({ id: 2, identity: "Packet switching research", year: 1965 })
  ];
  const first = compileEditorialTimeline(compilerInput("ARPANET", milestones));
  const second = compileEditorialTimeline(compilerInput("ARPANET", [...milestones].reverse()));
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(first.selectionAlgorithmVersion, EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION);
  assert.equal(first.compilerVersion, EDITORIAL_TIMELINE_COMPILER_VERSION);
  assert.match(first.compilerInputFingerprint, /^[a-f0-9]{64}$/);
});

test("selects one canonical milestone per deterministic duplicate group", () => {
  const weaker = milestone({ id: 2, identity: "Storming of the Bastille", year: 1789, month: 7, day: 14, precision: "day", rank: 2, importance: 80, strength: 70 });
  const stronger = milestone({ id: 1, identity: " storming OF THE bastille ", year: 1789, month: 7, day: 14, precision: "day", rank: 1, importance: 90, strength: 95 });
  const result = compileEditorialTimeline(compilerInput("French Revolution", [weaker, stronger]));
  assert.deepEqual(result.selectedMilestones.map((item) => item.milestoneId), [stronger.milestoneId]);
  assert.deepEqual(result.excludedMilestones, [{
    milestoneId: weaker.milestoneId,
    canonicalMilestoneId: stronger.milestoneId,
    exclusionReason: "duplicate_of_canonical_milestone"
  }]);
  assert.ok(result.selectedMilestones[0]!.selectionReasons.includes("stronger_historical_importance"));
});

test("uses evidence strength and stable identity as deterministic tie-breakers", () => {
  const evidenceWinner = milestone({ id: 2, identity: "Sputnik launch", year: 1957, rank: 1, importance: 90, strength: 95 });
  const weakerEvidence = milestone({ id: 3, identity: "Sputnik launch", year: 1957, rank: 1, importance: 90, strength: 80 });
  const stableIdWinner = milestone({ id: 4, identity: "Apollo 11 landing", year: 1969, rank: 2, importance: 95, strength: 95 });
  const stableIdLoser = milestone({ id: 5, identity: "Apollo 11 landing", year: 1969, rank: 2, importance: 95, strength: 95 });
  const result = compileEditorialTimeline(compilerInput("Space exploration", [
    stableIdLoser, weakerEvidence, stableIdWinner, evidenceWinner
  ]));
  assert.deepEqual(result.selectedMilestones.map((item) => item.milestoneId), [evidenceWinner.milestoneId, stableIdWinner.milestoneId]);
  assert.ok(result.selectedMilestones[0]!.selectionReasons.includes("stronger_evidence"));
  assert.ok(result.selectedMilestones[1]!.selectionReasons.includes("stable_identity_tiebreak"));
});

test("orders BCE, coarse precision, exact dates, and same-date ties deterministically", () => {
  const sameDateHighId = milestone({ id: 5, identity: "Distinct event B", year: 1868, month: 1, day: 3, precision: "day" });
  const sameDateLowId = milestone({ id: 4, identity: "Distinct event A", year: 1868, month: 1, day: 3, precision: "day" });
  const result = compileEditorialTimeline(compilerInput("Comparative chronology", [
    milestone({ id: 3, identity: "Year-level event", year: 1868 }),
    sameDateHighId,
    milestone({ id: 1, identity: "Ancient event", year: -509 }),
    sameDateLowId,
    milestone({ id: 2, identity: "Month-level event", year: 1868, month: 1, precision: "month" })
  ]));
  assert.deepEqual(result.selectedMilestones.map((item) => item.milestoneId), [
    uuid(1), uuid(3), uuid(2), uuid(4), uuid(5)
  ]);
  assert.deepEqual(result.selectedMilestones.map((item) => item.sequence), [1, 2, 3, 4, 5]);
});

test("never emits the same milestone more than once", () => {
  const unique = [
    milestone({ id: 1, identity: "Meiji Restoration proclaimed", year: 1868 }),
    milestone({ id: 2, identity: "Charter Oath issued", year: 1868, month: 4, day: 6, precision: "day" })
  ];
  const result = compileEditorialTimeline(compilerInput("Meiji Restoration", unique));
  assert.equal(new Set(result.selectedMilestones.map((item) => item.milestoneId)).size, result.selectedMilestones.length);
  assert.throws(
    () => compileEditorialTimeline(compilerInput("Meiji Restoration", [unique[0]!, unique[0]!])),
    /Duplicate milestone input/
  );
});

test("preserves complete canonical evidence lineage without mutating inputs", () => {
  const candidate = milestone({ id: 1, identity: "Mansa Musa pilgrimage", year: 1324 });
  const secondLineage = {
    evidenceRecordId: uuid(150),
    validationRecordId: uuid(250)
  };
  const input = compilerInput("Mali Empire", [{
    ...candidate,
    evidenceLineage: [secondLineage, ...candidate.evidenceLineage]
  }]);
  const before = structuredClone(input);
  const result = compileEditorialTimeline(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.selectedMilestones[0]!.evidenceLineage, [
    candidate.evidenceLineage[0],
    secondLineage
  ]);
});

test("fails closed for missing chronology, evidence lineage, invalid scores, and unbounded input", () => {
  const valid = milestone({ id: 1, identity: "Vaccination experiment", year: 1796 });
  assert.throws(() => compileEditorialTimeline(compilerInput("Vaccination", [{ ...valid, chronology: { ...valid.chronology, sortYear: 0 } }])), /sortYear/);
  assert.throws(() => compileEditorialTimeline(compilerInput("Vaccination", [{ ...valid, evidenceLineage: [] }])), /requires evidence lineage/);
  assert.throws(() => compileEditorialTimeline(compilerInput("Vaccination", [{ ...valid, importanceScore: 101 }])), /importanceScore/);
  assert.throws(() => compileEditorialTimeline(compilerInput("Vaccination", Array.from({ length: 201 }, (_, index) =>
    milestone({ id: index + 1, identity: `Milestone ${index}`, year: 1000 + index })
  ))), /at most 200/);
});

test("output remains minimal and contains no composition or reader-facing fields", () => {
  const result = compileEditorialTimeline(compilerInput("Abolition", [
    milestone({ id: 1, identity: "Slavery Abolition Act", year: 1833 })
  ]));
  const serialized = JSON.stringify(result);
  for (const forbidden of ["title", "summary", "description", "narrativeRole", "frame", "seo", "coherenceScore", "completenessScore"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  }
});
