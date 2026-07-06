import { ApiError } from "@/src/server/api/responses";
import { planEditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-planner";
import type { EditorialTimelineCandidate } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import { editorialCompositionRepository } from "@/src/server/repositories/editorial-composition-repository";
import { editorialEvidenceRepository } from "@/src/server/repositories/editorial-evidence-repository";
import { editorialTimelineCandidateRepository } from "@/src/server/repositories/editorial-timeline-candidate-repository";
import type { EditorialEvidenceSet } from "@/src/server/editorial-intelligence/contracts";
import type { PersistedEditorialTimelineCandidate } from "@/src/server/editorial-intelligence/timeline-candidate-persistence-contracts";

export function buildEditorialCompositionFromExactLineage(input: {
  persistedCandidate: PersistedEditorialTimelineCandidate;
  editorialEvidenceSet: EditorialEvidenceSet;
  expectedTimelineCandidate: EditorialTimelineCandidate;
}) {
  const { persistedCandidate, editorialEvidenceSet } = input;
  if (!editorialEvidenceSet.editorialEvidenceSetId) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_EVIDENCE_SET_ID_REQUIRED", "Composition requires a persisted Editorial Evidence Set.");
  }
  if (persistedCandidate.editorialEvidenceSetId !== editorialEvidenceSet.editorialEvidenceSetId ||
      input.expectedTimelineCandidate.editorialEvidenceSetId !== editorialEvidenceSet.editorialEvidenceSetId) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_EVIDENCE_LINEAGE_MISMATCH", "Composition inputs do not share the exact Editorial Evidence Set lineage.");
  }
  if (persistedCandidate.compilerInputFingerprint !== input.expectedTimelineCandidate.compilerInputFingerprint) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_CANDIDATE_FINGERPRINT_MISMATCH", "Persisted candidate fingerprint does not match the pinned compiler output.");
  }
  const persistedMilestoneIds = persistedCandidate.selectedMilestones.map((item) => item.milestoneId);
  const expectedMilestoneIds = input.expectedTimelineCandidate.selectedMilestones.map((item) => item.milestoneId);
  if (persistedMilestoneIds.length !== expectedMilestoneIds.length ||
      persistedMilestoneIds.some((id, index) => id !== expectedMilestoneIds[index])) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_CANDIDATE_MEMBERSHIP_MISMATCH", "Persisted candidate membership does not match the pinned compiler output.");
  }
  return planEditorialComposition({
    editorialTimelineCandidateId: persistedCandidate.candidateId,
    timelineCandidate: input.expectedTimelineCandidate,
    identifiedTurningPoints: editorialEvidenceSet.identifiedTurningPoints,
    chronologyGaps: editorialEvidenceSet.timelineCoverage.gaps
  });
}

export async function prepareAndPersistEditorialComposition(input: {
  editorialTimelineCandidateId: string;
  editorialEvidenceSetId: string;
  expectedTimelineCandidate: EditorialTimelineCandidate;
  actor: string;
}) {
  const [persistedCandidate, editorialEvidenceSet] = await Promise.all([
    editorialTimelineCandidateRepository.getById(input.editorialTimelineCandidateId),
    editorialEvidenceRepository.getById(input.editorialEvidenceSetId)
  ]);
  if (!persistedCandidate) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_CANDIDATE_NOT_FOUND", "Pinned EditorialTimelineCandidate could not be loaded by exact ID.");
  }
  if (!editorialEvidenceSet) {
    throw new ApiError(409, "EDITORIAL_COMPOSITION_EVIDENCE_SET_NOT_FOUND", "Pinned Editorial Evidence Set could not be loaded by exact ID.");
  }
  const composition = buildEditorialCompositionFromExactLineage({
    persistedCandidate,
    editorialEvidenceSet,
    expectedTimelineCandidate: input.expectedTimelineCandidate
  });
  return editorialCompositionRepository.create({ composition, actor: input.actor });
}
