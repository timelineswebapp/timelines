import { createHash } from "node:crypto";
import {
  EDITORIAL_TIMELINE_COMPILER_VERSION,
  EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION,
  type EditorialTimelineCandidate,
  type EditorialTimelineChronology,
  type EditorialTimelineCompilerInput,
  type EditorialTimelineEvidenceLineage,
  type EditorialTimelineSelectionReason,
  type GroundedMilestoneCandidate
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} must be non-empty.`);
}

function assertChronology(chronology: EditorialTimelineChronology, milestoneId: string): void {
  if (!Number.isInteger(chronology.sortYear) || chronology.sortYear === 0) {
    throw new Error(`Milestone ${milestoneId} requires a non-zero integer sortYear.`);
  }
  if (chronology.sortMonth !== null && (!Number.isInteger(chronology.sortMonth) || chronology.sortMonth < 1 || chronology.sortMonth > 12)) {
    throw new Error(`Milestone ${milestoneId} has an invalid sortMonth.`);
  }
  if (chronology.sortDay !== null && (!Number.isInteger(chronology.sortDay) || chronology.sortDay < 1 || chronology.sortDay > 31)) {
    throw new Error(`Milestone ${milestoneId} has an invalid sortDay.`);
  }
  if (chronology.sortDay !== null && chronology.sortMonth === null) {
    throw new Error(`Milestone ${milestoneId} cannot define sortDay without sortMonth.`);
  }
}

function assertScore(value: number, field: string, milestoneId: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error(`Milestone ${milestoneId} ${field} must be between 0 and 100.`);
  }
}

function canonicalLineage(lineage: readonly EditorialTimelineEvidenceLineage[]): EditorialTimelineEvidenceLineage[] {
  return [...lineage]
    .map((item) => ({ evidenceRecordId: item.evidenceRecordId, validationRecordId: item.validationRecordId }))
    .sort((left, right) =>
      left.evidenceRecordId.localeCompare(right.evidenceRecordId) ||
      left.validationRecordId.localeCompare(right.validationRecordId)
    );
}

function validateInput(input: EditorialTimelineCompilerInput): void {
  assertNonEmpty(input.canonicalSubject, "canonicalSubject");
  if (!UUID_PATTERN.test(input.editorialEvidenceSetId)) {
    throw new Error("editorialEvidenceSetId must be a UUID.");
  }
  if (input.milestones.length === 0) throw new Error("Timeline compilation requires at least one grounded milestone.");
  if (input.milestones.length > 200) throw new Error("Timeline compilation accepts at most 200 grounded milestones.");
  const ids = new Set<string>();
  for (const milestone of input.milestones) {
    if (!UUID_PATTERN.test(milestone.milestoneId)) throw new Error("milestoneId must be a UUID.");
    if (ids.has(milestone.milestoneId)) throw new Error(`Duplicate milestone input ${milestone.milestoneId} is forbidden.`);
    ids.add(milestone.milestoneId);
    assertNonEmpty(milestone.canonicalIdentity, `Milestone ${milestone.milestoneId} canonicalIdentity`);
    assertChronology(milestone.chronology, milestone.milestoneId);
    if (!Number.isInteger(milestone.editorialRank) || milestone.editorialRank < 1) {
      throw new Error(`Milestone ${milestone.milestoneId} editorialRank must be a positive integer.`);
    }
    assertScore(milestone.importanceScore, "importanceScore", milestone.milestoneId);
    assertScore(milestone.evidenceStrength, "evidenceStrength", milestone.milestoneId);
    if (milestone.evidenceLineage.length === 0) throw new Error(`Milestone ${milestone.milestoneId} requires evidence lineage.`);
    const lineageKeys = new Set<string>();
    for (const lineage of milestone.evidenceLineage) {
      if (!UUID_PATTERN.test(lineage.evidenceRecordId) || !UUID_PATTERN.test(lineage.validationRecordId)) {
        throw new Error(`Milestone ${milestone.milestoneId} contains invalid evidence lineage.`);
      }
      const key = `${lineage.evidenceRecordId}:${lineage.validationRecordId}`;
      if (lineageKeys.has(key)) throw new Error(`Milestone ${milestone.milestoneId} contains duplicate evidence lineage.`);
      lineageKeys.add(key);
    }
  }
}

function chronologyKey(value: EditorialTimelineChronology): string {
  return `${value.sortYear}:${value.sortMonth ?? "x"}:${value.sortDay ?? "x"}:${value.precision}`;
}

function duplicateKey(milestone: GroundedMilestoneCandidate): string {
  return `${milestone.canonicalIdentity.trim().toLocaleLowerCase("en-US")}|${chronologyKey(milestone.chronology)}`;
}

function selectionOrder(left: GroundedMilestoneCandidate, right: GroundedMilestoneCandidate): number {
  return right.importanceScore - left.importanceScore ||
    right.evidenceStrength - left.evidenceStrength ||
    left.editorialRank - right.editorialRank ||
    left.milestoneId.localeCompare(right.milestoneId);
}

function selectionReasons(group: readonly GroundedMilestoneCandidate[], winner: GroundedMilestoneCandidate): EditorialTimelineSelectionReason[] {
  if (group.length === 1) return ["unique_grounded_milestone"];
  const reasons: EditorialTimelineSelectionReason[] = ["highest_ranked_duplicate"];
  const alternatives = group.filter((item) => item.milestoneId !== winner.milestoneId);
  if (alternatives.some((item) => winner.importanceScore > item.importanceScore)) reasons.push("stronger_historical_importance");
  if (alternatives.some((item) => winner.importanceScore === item.importanceScore && winner.evidenceStrength > item.evidenceStrength)) {
    reasons.push("stronger_evidence");
  }
  if (alternatives.some((item) =>
    winner.importanceScore === item.importanceScore &&
    winner.evidenceStrength === item.evidenceStrength &&
    winner.editorialRank === item.editorialRank
  )) reasons.push("stable_identity_tiebreak");
  return reasons;
}

function chronologyOrder(left: GroundedMilestoneCandidate, right: GroundedMilestoneCandidate): number {
  return left.chronology.sortYear - right.chronology.sortYear ||
    (left.chronology.sortMonth ?? 0) - (right.chronology.sortMonth ?? 0) ||
    (left.chronology.sortDay ?? 0) - (right.chronology.sortDay ?? 0) ||
    left.milestoneId.localeCompare(right.milestoneId);
}

function canonicalFingerprintInput(input: EditorialTimelineCompilerInput) {
  return {
    selectionAlgorithmVersion: EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION,
    compilerVersion: EDITORIAL_TIMELINE_COMPILER_VERSION,
    canonicalSubject: input.canonicalSubject,
    editorialEvidenceSetId: input.editorialEvidenceSetId,
    milestones: [...input.milestones]
      .map((milestone) => ({
        milestoneId: milestone.milestoneId,
        canonicalIdentity: milestone.canonicalIdentity,
        chronology: milestone.chronology,
        evidenceLineage: canonicalLineage(milestone.evidenceLineage),
        editorialRank: milestone.editorialRank,
        importanceScore: milestone.importanceScore,
        evidenceStrength: milestone.evidenceStrength
      }))
      .sort((left, right) => left.milestoneId.localeCompare(right.milestoneId))
  };
}

export function compileEditorialTimeline(input: EditorialTimelineCompilerInput): EditorialTimelineCandidate {
  validateInput(input);
  const groups = new Map<string, GroundedMilestoneCandidate[]>();
  for (const milestone of input.milestones) {
    const key = duplicateKey(milestone);
    groups.set(key, [...(groups.get(key) || []), milestone]);
  }

  const winners: Array<{ milestone: GroundedMilestoneCandidate; reasons: EditorialTimelineSelectionReason[] }> = [];
  const exclusions: EditorialTimelineCandidate["excludedMilestones"][number][] = [];
  for (const key of [...groups.keys()].sort()) {
    const group = [...groups.get(key)!].sort(selectionOrder);
    const winner = group[0]!;
    winners.push({ milestone: winner, reasons: selectionReasons(group, winner) });
    for (const excluded of group.slice(1)) {
      exclusions.push({
        milestoneId: excluded.milestoneId,
        canonicalMilestoneId: winner.milestoneId,
        exclusionReason: "duplicate_of_canonical_milestone"
      });
    }
  }

  winners.sort((left, right) => chronologyOrder(left.milestone, right.milestone));
  exclusions.sort((left, right) => left.milestoneId.localeCompare(right.milestoneId));
  const selectedMilestones = winners.map(({ milestone, reasons }, index) => ({
    milestoneId: milestone.milestoneId,
    sequence: index + 1,
    chronology: { ...milestone.chronology },
    evidenceLineage: canonicalLineage(milestone.evidenceLineage),
    selectionReasons: reasons
  }));
  if (new Set(selectedMilestones.map((milestone) => milestone.milestoneId)).size !== selectedMilestones.length) {
    throw new Error("Compiler invariant violated: a milestone appears more than once.");
  }

  const compilerInputFingerprint = createHash("sha256")
    .update(JSON.stringify(canonicalFingerprintInput(input)))
    .digest("hex");
  return {
    canonicalSubject: input.canonicalSubject,
    editorialEvidenceSetId: input.editorialEvidenceSetId,
    compilerVersion: EDITORIAL_TIMELINE_COMPILER_VERSION,
    selectionAlgorithmVersion: EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION,
    compilerInputFingerprint,
    selectedMilestones,
    excludedMilestones: exclusions,
    compilerMetadata: {
      authorityDecision: false,
      publicationReadinessDecision: false,
      sourceMilestoneCount: input.milestones.length
    }
  };
}
