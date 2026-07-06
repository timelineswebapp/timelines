import { createHash } from "node:crypto";
import {
  EDITORIAL_COMPOSITION_PLANNER_VERSION,
  EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION,
  type EditorialComposition,
  type EditorialCompositionChronologyGapInput,
  type EditorialCompositionMilestoneView,
  type EditorialCompositionPhaseBasis,
  type EditorialCompositionPlannerInput
} from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import type { EditorialTimelineChronology } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MILESTONES = 200;

function chronologyOrder(left: EditorialTimelineChronology, right: EditorialTimelineChronology): number {
  return left.sortYear - right.sortYear ||
    (left.sortMonth ?? 0) - (right.sortMonth ?? 0) ||
    (left.sortDay ?? 0) - (right.sortDay ?? 0);
}

function canonicalMilestones(input: EditorialCompositionPlannerInput): EditorialCompositionMilestoneView[] {
  return input.timelineCandidate.selectedMilestones.map((milestone) => ({
    milestoneId: milestone.milestoneId,
    sequence: milestone.sequence,
    chronology: { ...milestone.chronology },
    evidenceRecordIds: [...milestone.evidenceLineage]
      .map((lineage) => lineage.evidenceRecordId)
      .sort()
  }));
}

function assertInput(input: EditorialCompositionPlannerInput): void {
  if (!UUID_PATTERN.test(input.editorialTimelineCandidateId)) {
    throw new Error("editorialTimelineCandidateId must be a UUID.");
  }
  if (!input.timelineCandidate.canonicalSubject.trim()) {
    throw new Error("canonicalSubject must be non-empty.");
  }
  if (!UUID_PATTERN.test(input.timelineCandidate.editorialEvidenceSetId)) {
    throw new Error("editorialEvidenceSetId must be a UUID.");
  }
  if (!FINGERPRINT_PATTERN.test(input.timelineCandidate.compilerInputFingerprint)) {
    throw new Error("editorialTimelineCandidateFingerprint must be a SHA-256 fingerprint.");
  }
  const selected = input.timelineCandidate.selectedMilestones;
  if (selected.length === 0 || selected.length > MAX_MILESTONES) {
    throw new Error(`Editorial composition requires between 1 and ${MAX_MILESTONES} selected milestones.`);
  }
  const selectedIds = new Set<string>();
  for (const [index, milestone] of selected.entries()) {
    if (!UUID_PATTERN.test(milestone.milestoneId)) throw new Error("Selected milestone IDs must be UUIDs.");
    if (selectedIds.has(milestone.milestoneId)) throw new Error("A selected milestone may appear only once.");
    selectedIds.add(milestone.milestoneId);
    if (milestone.sequence !== index + 1) throw new Error("Selected milestone sequence must be contiguous from 1.");
    if (milestone.evidenceLineage.length === 0) throw new Error("Every selected milestone requires evidence lineage.");
    if (index > 0 && chronologyOrder(selected[index - 1]!.chronology, milestone.chronology) > 0) {
      throw new Error("EI-002 milestone chronology must be preserved.");
    }
  }
  const excludedIds = new Set<string>();
  for (const excluded of input.timelineCandidate.excludedMilestones) {
    if (!UUID_PATTERN.test(excluded.milestoneId) || !UUID_PATTERN.test(excluded.canonicalMilestoneId)) {
      throw new Error("Excluded milestone IDs must be UUIDs.");
    }
    if (excludedIds.has(excluded.milestoneId)) throw new Error("An excluded milestone may appear only once.");
    if (selectedIds.has(excluded.milestoneId)) throw new Error("Excluded milestones must not appear in selected milestones.");
    if (!selectedIds.has(excluded.canonicalMilestoneId)) {
      throw new Error("Every exclusion must reference a selected canonical milestone.");
    }
    excludedIds.add(excluded.milestoneId);
  }
  const turningPointIds = new Set<string>();
  for (const turningPoint of input.identifiedTurningPoints) {
    if (!UUID_PATTERN.test(turningPoint.evidenceRecordId)) throw new Error("Turning-point evidence IDs must be UUIDs.");
    if (turningPointIds.has(turningPoint.evidenceRecordId)) throw new Error("Turning-point evidence must be unique.");
    if (!Number.isFinite(turningPoint.score) || turningPoint.score < 0 || turningPoint.score > 100) {
      throw new Error("Turning-point scores must be between 0 and 100.");
    }
    if (turningPoint.year !== null && (!Number.isInteger(turningPoint.year) || turningPoint.year === 0)) {
      throw new Error("Turning-point years must be non-zero integers.");
    }
    turningPointIds.add(turningPoint.evidenceRecordId);
  }
  for (const gap of input.chronologyGaps) {
    if (!Number.isInteger(gap.afterYear) || !Number.isInteger(gap.beforeYear) ||
        !Number.isInteger(gap.spanYears) || gap.beforeYear - gap.afterYear !== gap.spanYears ||
        gap.spanYears <= 1) {
      throw new Error("Chronology gaps must contain a valid positive year span.");
    }
  }
}

function gapAtBoundary(
  gaps: readonly EditorialCompositionChronologyGapInput[],
  priorYear: number,
  currentYear: number
): boolean {
  return gaps.some((gap) => gap.afterYear === priorYear && gap.beforeYear === currentYear);
}

function fingerprintInput(input: EditorialCompositionPlannerInput, milestones: readonly EditorialCompositionMilestoneView[]) {
  return {
    plannerVersion: EDITORIAL_COMPOSITION_PLANNER_VERSION,
    structureAlgorithmVersion: EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION,
    editorialTimelineCandidateId: input.editorialTimelineCandidateId,
    canonicalSubject: input.timelineCandidate.canonicalSubject,
    editorialEvidenceSetId: input.timelineCandidate.editorialEvidenceSetId,
    editorialTimelineCandidateFingerprint: input.timelineCandidate.compilerInputFingerprint,
    milestones,
    excludedMilestones: [...input.timelineCandidate.excludedMilestones]
      .map((item) => ({
        milestoneId: item.milestoneId,
        canonicalMilestoneId: item.canonicalMilestoneId,
        exclusionReason: item.exclusionReason
      }))
      .sort((left, right) => left.milestoneId.localeCompare(right.milestoneId)),
    identifiedTurningPoints: [...input.identifiedTurningPoints]
      .map((item) => ({ ...item }))
      .sort((left, right) => left.evidenceRecordId.localeCompare(right.evidenceRecordId)),
    chronologyGaps: [...input.chronologyGaps]
      .map((item) => ({ ...item }))
      .sort((left, right) => left.afterYear - right.afterYear || left.beforeYear - right.beforeYear)
  };
}

export function planEditorialComposition(input: EditorialCompositionPlannerInput): EditorialComposition {
  assertInput(input);
  const milestones = canonicalMilestones(input);
  const turningPointEvidenceIds = new Set(input.identifiedTurningPoints.map((item) => item.evidenceRecordId));
  const turningPointEvidenceByMilestone = new Map<string, string[]>();
  for (const milestone of milestones) {
    const matched = milestone.evidenceRecordIds.filter((id) => turningPointEvidenceIds.has(id));
    if (matched.length > 0) turningPointEvidenceByMilestone.set(milestone.milestoneId, matched);
  }

  const phaseStarts = new Map<number, EditorialCompositionPhaseBasis>([[0, "timeline_opening"]]);
  for (let index = 1; index < milestones.length; index += 1) {
    const current = milestones[index]!;
    const prior = milestones[index - 1]!;
    if (turningPointEvidenceByMilestone.has(current.milestoneId)) {
      phaseStarts.set(index, "turning_point_boundary");
    } else if (gapAtBoundary(input.chronologyGaps, prior.chronology.sortYear, current.chronology.sortYear)) {
      phaseStarts.set(index, "chronology_gap_boundary");
    }
  }

  const starts = [...phaseStarts.keys()].sort((left, right) => left - right);
  const phases = starts.map((start, phaseIndex) => {
    const endExclusive = starts[phaseIndex + 1] ?? milestones.length;
    const members = milestones.slice(start, endExclusive);
    return {
      phaseId: `phase-${String(phaseIndex + 1).padStart(3, "0")}`,
      sequence: phaseIndex + 1,
      startMilestoneId: members[0]!.milestoneId,
      endMilestoneId: members.at(-1)!.milestoneId,
      milestoneIds: members.map((item) => item.milestoneId),
      basis: phaseStarts.get(start)!
    };
  });
  const phaseByMilestone = new Map(phases.flatMap((phase) =>
    phase.milestoneIds.map((milestoneId) => [milestoneId, phase.phaseId] as const)
  ));
  const turningPoints = milestones
    .filter((milestone) => turningPointEvidenceByMilestone.has(milestone.milestoneId))
    .map((milestone) => {
      const phaseIndex = phases.findIndex((phase) => phase.phaseId === phaseByMilestone.get(milestone.milestoneId));
      return {
        milestoneId: milestone.milestoneId,
        evidenceRecordIds: turningPointEvidenceByMilestone.get(milestone.milestoneId)!,
        phaseBeforeId: phaseIndex > 0 ? phases[phaseIndex - 1]!.phaseId : null,
        phaseAfterId: phases[phaseIndex]?.phaseId ?? null,
        source: "ei_001_identified_turning_point" as const
      };
    });
  const transitions = phases.slice(1).map((phase, index) => ({
    fromPhaseId: phases[index]!.phaseId,
    toPhaseId: phase.phaseId,
    boundaryMilestoneId: phase.startMilestoneId,
    transitionType: phase.basis === "turning_point_boundary"
      ? "turning_point_transition" as const
      : "chronology_gap_transition" as const
  }));
  const continuity = milestones.slice(1).map((milestone, index) => ({
    fromMilestoneId: milestones[index]!.milestoneId,
    toMilestoneId: milestone.milestoneId,
    basis: "chronological_adjacency" as const
  }));
  const milestoneIds = milestones.map((item) => item.milestoneId);
  const plannerInputFingerprint = createHash("sha256")
    .update(JSON.stringify(fingerprintInput(input, milestones)))
    .digest("hex");

  return {
    canonicalSubject: input.timelineCandidate.canonicalSubject,
    editorialEvidenceSetId: input.timelineCandidate.editorialEvidenceSetId,
    editorialTimelineCandidateId: input.editorialTimelineCandidateId,
    editorialTimelineCandidateFingerprint: input.timelineCandidate.compilerInputFingerprint,
    plannerVersion: EDITORIAL_COMPOSITION_PLANNER_VERSION,
    structureAlgorithmVersion: EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION,
    plannerInputFingerprint,
    introduction: {
      anchorMilestoneIds: [milestoneIds[0]!],
      purpose: "establish_initial_conditions"
    },
    phases,
    turningPoints,
    transitions,
    continuity,
    historicalArcs: [{
      arcId: "arc-001",
      sequence: 1,
      phaseIds: phases.map((phase) => phase.phaseId),
      milestoneIds,
      basis: "full_timeline_arc"
    }],
    excludedMilestoneIds: input.timelineCandidate.excludedMilestones
      .map((item) => item.milestoneId)
      .sort(),
    compositionMetadata: {
      authorityDecision: false,
      publicationReadinessDecision: false,
      generatedText: false,
      sourceMilestoneCount: milestones.length
    },
    conclusion: {
      anchorMilestoneIds: [milestoneIds.at(-1)!],
      purpose: "establish_historical_outcome"
    }
  };
}
