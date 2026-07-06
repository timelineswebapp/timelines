import assert from "node:assert/strict";
import test from "node:test";
import {
  EDITORIAL_COMPOSITION_PLANNER_VERSION,
  EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION,
  type EditorialCompositionPlannerInput
} from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import { planEditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-planner";
import type {
  EditorialTimelineCandidate,
  EditorialTimelineSelectedMilestone
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

function uuid(value: number): string {
  return `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
}

function milestone(id: number, sequence: number, year: number): EditorialTimelineSelectedMilestone {
  return {
    milestoneId: uuid(id),
    sequence,
    chronology: { sortYear: year, sortMonth: null, sortDay: null, precision: "year" },
    evidenceLineage: [{ evidenceRecordId: uuid(id + 100), validationRecordId: uuid(id + 200) }],
    selectionReasons: ["unique_grounded_milestone"]
  };
}

function candidate(selectedMilestones: readonly EditorialTimelineSelectedMilestone[]): EditorialTimelineCandidate {
  return {
    canonicalSubject: "Printing Press",
    editorialEvidenceSetId: uuid(900),
    compilerVersion: "ei-002-compiler-v1",
    selectionAlgorithmVersion: "ei-002-selection-v1",
    compilerInputFingerprint: "a".repeat(64),
    selectedMilestones,
    excludedMilestones: [],
    compilerMetadata: {
      authorityDecision: false,
      publicationReadinessDecision: false,
      sourceMilestoneCount: selectedMilestones.length
    }
  };
}

function input(selectedMilestones: readonly EditorialTimelineSelectedMilestone[]): EditorialCompositionPlannerInput {
  return {
    editorialTimelineCandidateId: uuid(800),
    timelineCandidate: candidate(selectedMilestones),
    identifiedTurningPoints: [],
    chronologyGaps: []
  };
}

test("is referentially transparent and emits versioned stable provenance", () => {
  const value = input([milestone(1, 1, 1450), milestone(2, 2, 1455), milestone(3, 3, 1469)]);
  const before = structuredClone(value);
  const first = planEditorialComposition(value);
  const second = planEditorialComposition(value);
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(value, before);
  assert.equal(first.plannerVersion, EDITORIAL_COMPOSITION_PLANNER_VERSION);
  assert.equal(first.structureAlgorithmVersion, EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION);
  assert.match(first.plannerInputFingerprint, /^[a-f0-9]{64}$/);
});

test("places every EI-002 milestone exactly once without reordering", () => {
  const milestones = [
    milestone(1, 1, -509),
    milestone(2, 2, -450),
    milestone(3, 3, -264),
    milestone(4, 4, -44)
  ];
  const result = planEditorialComposition(input(milestones));
  const composed = result.phases.flatMap((phase) => phase.milestoneIds);
  assert.deepEqual(composed, milestones.map((item) => item.milestoneId));
  assert.equal(new Set(composed).size, milestones.length);
  assert.deepEqual(result.historicalArcs[0]!.milestoneIds, composed);
  assert.deepEqual(result.continuity, milestones.slice(1).map((item, index) => ({
    fromMilestoneId: milestones[index]!.milestoneId,
    toMilestoneId: item.milestoneId,
    basis: "chronological_adjacency"
  })));
});

test("creates introduction and conclusion structural boundaries without prose", () => {
  const milestones = [milestone(1, 1, 1868), milestone(2, 2, 1889)];
  const result = planEditorialComposition(input(milestones));
  assert.deepEqual(result.introduction, {
    anchorMilestoneIds: [milestones[0]!.milestoneId],
    purpose: "establish_initial_conditions"
  });
  assert.deepEqual(result.conclusion, {
    anchorMilestoneIds: [milestones[1]!.milestoneId],
    purpose: "establish_historical_outcome"
  });
  const serialized = JSON.stringify(result);
  for (const forbidden of ["title", "summary", "description", "prose", "seo", "causalGroupings"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false);
  }
});

test("uses only EI-001 evidence metadata to identify turning points and phase boundaries", () => {
  const milestones = [milestone(1, 1, 1965), milestone(2, 2, 1983), milestone(3, 3, 1989)];
  const value = input(milestones);
  const result = planEditorialComposition({
    ...value,
    identifiedTurningPoints: [
      { evidenceRecordId: milestones[1]!.evidenceLineage[0]!.evidenceRecordId, year: 1983, score: 95 },
      { evidenceRecordId: uuid(777), year: 2000, score: 100 }
    ]
  });
  assert.deepEqual(result.phases.map((phase) => ({
    basis: phase.basis,
    milestoneIds: phase.milestoneIds
  })), [
    { basis: "timeline_opening", milestoneIds: [milestones[0]!.milestoneId] },
    { basis: "turning_point_boundary", milestoneIds: [milestones[1]!.milestoneId, milestones[2]!.milestoneId] }
  ]);
  assert.deepEqual(result.turningPoints, [{
    milestoneId: milestones[1]!.milestoneId,
    evidenceRecordIds: [milestones[1]!.evidenceLineage[0]!.evidenceRecordId],
    phaseBeforeId: "phase-001",
    phaseAfterId: "phase-002",
    source: "ei_001_identified_turning_point"
  }]);
  assert.deepEqual(result.transitions, [{
    fromPhaseId: "phase-001",
    toPhaseId: "phase-002",
    boundaryMilestoneId: milestones[1]!.milestoneId,
    transitionType: "turning_point_transition"
  }]);
});

test("uses exact EI-001 chronology gaps as lower-priority structural boundaries", () => {
  const milestones = [milestone(1, 1, 1324), milestone(2, 2, 1500), milestone(3, 3, 1501)];
  const value = input(milestones);
  const result = planEditorialComposition({
    ...value,
    chronologyGaps: [{ afterYear: 1324, beforeYear: 1500, spanYears: 176 }]
  });
  assert.deepEqual(result.phases.map((phase) => phase.basis), [
    "timeline_opening",
    "chronology_gap_boundary"
  ]);
  assert.equal(result.transitions[0]!.transitionType, "chronology_gap_transition");
});

test("preserves EI-002 exclusions and never places them in composition structure", () => {
  const milestones = [milestone(1, 1, 1789), milestone(2, 2, 1791)];
  const excludedId = uuid(3);
  const value = input(milestones);
  const result = planEditorialComposition({
    ...value,
    timelineCandidate: {
      ...value.timelineCandidate,
      excludedMilestones: [{
        milestoneId: excludedId,
        canonicalMilestoneId: milestones[0]!.milestoneId,
        exclusionReason: "duplicate_of_canonical_milestone"
      }]
    }
  });
  assert.deepEqual(result.excludedMilestoneIds, [excludedId]);
  assert.equal(JSON.stringify({
    phases: result.phases,
    turningPoints: result.turningPoints,
    transitions: result.transitions,
    continuity: result.continuity,
    historicalArcs: result.historicalArcs,
    introduction: result.introduction,
    conclusion: result.conclusion
  }).includes(excludedId), false);
});

test("fails closed for duplicate, removed, reordered, invalid, and unbounded inputs", () => {
  const first = milestone(1, 1, 1900);
  const second = milestone(2, 2, 1910);
  assert.throws(
    () => planEditorialComposition(input([first, { ...first, sequence: 2 }])),
    /only once/
  );
  assert.throws(
    () => planEditorialComposition(input([first, { ...second, sequence: 3 }])),
    /contiguous/
  );
  assert.throws(
    () => planEditorialComposition(input([{ ...first, chronology: { ...first.chronology, sortYear: 1920 } }, second])),
    /chronology/
  );
  assert.throws(
    () => planEditorialComposition({
      ...input([first]),
      timelineCandidate: {
        ...input([first]).timelineCandidate,
        excludedMilestones: [{
          milestoneId: first.milestoneId,
          canonicalMilestoneId: first.milestoneId,
          exclusionReason: "duplicate_of_canonical_milestone"
        }]
      }
    }),
    /Excluded milestones/
  );
  assert.throws(
    () => planEditorialComposition(input(Array.from({ length: 201 }, (_, index) =>
      milestone(index + 1, index + 1, 1000 + index)
    ))),
    /between 1 and 200/
  );
});

test("single-milestone and same-year timelines remain valid and deterministic", () => {
  const single = milestone(1, 1, 1796);
  const singleResult = planEditorialComposition(input([single]));
  assert.equal(singleResult.phases.length, 1);
  assert.deepEqual(singleResult.introduction.anchorMilestoneIds, [single.milestoneId]);
  assert.deepEqual(singleResult.conclusion.anchorMilestoneIds, [single.milestoneId]);
  assert.deepEqual(singleResult.transitions, []);
  assert.deepEqual(singleResult.continuity, []);

  const sameYear = [milestone(2, 1, 1868), milestone(3, 2, 1868)];
  assert.deepEqual(
    planEditorialComposition(input(sameYear)).phases[0]!.milestoneIds,
    sameYear.map((item) => item.milestoneId)
  );
});

test("output contains no causal claims or reader-facing content", () => {
  const result = planEditorialComposition(input([
    milestone(1, 1, 1914),
    milestone(2, 2, 1918)
  ]));
  assert.deepEqual(result.compositionMetadata, {
    authorityDecision: false,
    publicationReadinessDecision: false,
    generatedText: false,
    sourceMilestoneCount: 2
  });
  for (const forbidden of [
    "cause",
    "causal",
    "because",
    "resulted",
    "title",
    "summary",
    "description",
    "narrative"
  ]) {
    assert.equal(JSON.stringify(result).toLowerCase().includes(forbidden), false);
  }
});
