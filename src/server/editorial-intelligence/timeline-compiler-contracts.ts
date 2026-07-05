export const EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION = "ei-002-selection-v1" as const;

export type EditorialTimelineChronology = Readonly<{
  sortYear: number;
  sortMonth: number | null;
  sortDay: number | null;
  precision: "year" | "month" | "day" | "approximate";
}>;

export type EditorialTimelineEvidenceLineage = Readonly<{
  evidenceRecordId: string;
  validationRecordId: string;
}>;

export type GroundedMilestoneCandidate = Readonly<{
  milestoneId: string;
  canonicalIdentity: string;
  chronology: EditorialTimelineChronology;
  evidenceLineage: readonly EditorialTimelineEvidenceLineage[];
  editorialRank: number;
  importanceScore: number;
  evidenceStrength: number;
}>;

export type EditorialTimelineCompilerInput = Readonly<{
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  milestones: readonly GroundedMilestoneCandidate[];
}>;

export type EditorialTimelineSelectionReason =
  | "unique_grounded_milestone"
  | "highest_ranked_duplicate"
  | "stronger_historical_importance"
  | "stronger_evidence"
  | "stable_identity_tiebreak";

export type EditorialTimelineExclusionReason = "duplicate_of_canonical_milestone";

export type EditorialTimelineSelectedMilestone = Readonly<{
  milestoneId: string;
  sequence: number;
  chronology: EditorialTimelineChronology;
  evidenceLineage: readonly EditorialTimelineEvidenceLineage[];
  selectionReasons: readonly EditorialTimelineSelectionReason[];
}>;

export type EditorialTimelineExcludedMilestone = Readonly<{
  milestoneId: string;
  canonicalMilestoneId: string;
  exclusionReason: EditorialTimelineExclusionReason;
}>;

export type EditorialTimelineCandidate = Readonly<{
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  selectionAlgorithmVersion: typeof EDITORIAL_TIMELINE_SELECTION_ALGORITHM_VERSION;
  compilerInputFingerprint: string;
  selectedMilestones: readonly EditorialTimelineSelectedMilestone[];
  excludedMilestones: readonly EditorialTimelineExcludedMilestone[];
}>;

