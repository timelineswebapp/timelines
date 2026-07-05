import type {
  EditorialTimelineCandidate,
  EditorialTimelineEvidenceLineage,
  EditorialTimelineExcludedMilestone,
  EditorialTimelineSelectionReason
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

export type PersistEditorialTimelineCandidateInput = Readonly<{
  candidate: EditorialTimelineCandidate;
  actor: string;
}>;

export type PersistedEditorialTimelineMilestone = Readonly<{
  milestoneId: string;
  sequence: number;
  evidenceLineage: readonly EditorialTimelineEvidenceLineage[];
  selectionReasons: readonly EditorialTimelineSelectionReason[];
}>;

export type PersistedEditorialTimelineCandidate = Readonly<{
  candidateId: string;
  factoryObjectId: string;
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  compilerVersion: string;
  selectionAlgorithmVersion: string;
  compilerInputFingerprint: string;
  selectedMilestones: readonly PersistedEditorialTimelineMilestone[];
  excludedMilestones: readonly EditorialTimelineExcludedMilestone[];
  compilerMetadata: Readonly<{
    authorityDecision: false;
    publicationReadinessDecision: false;
    sourceMilestoneCount: number;
  }>;
  createdBy: string;
  createdAt?: string;
}>;
