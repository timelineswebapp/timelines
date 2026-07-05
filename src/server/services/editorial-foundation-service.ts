import { ApiError } from "@/src/server/api/responses";
import { prepareEditorialEvidenceSet } from "@/src/server/editorial-intelligence/editorial-foundation";
import { editorialEvidenceRepository } from "@/src/server/repositories/editorial-evidence-repository";
import type { EditorialEvidenceSubject } from "@/src/server/editorial-intelligence/contracts";

type EditorialEvidencePersistence = typeof editorialEvidenceRepository.create;
let persistEditorialEvidenceSet: EditorialEvidencePersistence = editorialEvidenceRepository.create;

export function setEditorialEvidencePersistenceForTests(persistence: EditorialEvidencePersistence | null): void {
  persistEditorialEvidenceSet = persistence || editorialEvidenceRepository.create;
}

export const editorialFoundationService = {
  async prepareFromValidatedEvidence(input: {
    topic: string;
    actor: string;
    evidence: readonly EditorialEvidenceSubject[];
  }) {
    const topic = input.topic.trim();
    if (!topic) throw new ApiError(400, "EDITORIAL_TOPIC_REQUIRED", "Editorial preparation requires a topic.");
    if (!input.evidence.length) throw new ApiError(409, "EDITORIAL_VALIDATED_EVIDENCE_REQUIRED", "Editorial preparation requires passed validated evidence.");
    return persistEditorialEvidenceSet(prepareEditorialEvidenceSet(topic, input.evidence), input.actor);
  },

  async prepare(input: { topic: string; actor: string; limit?: number }) {
    const topic = input.topic.trim();
    if (!topic) throw new ApiError(400, "EDITORIAL_TOPIC_REQUIRED", "Editorial preparation requires a topic.");
    const evidence = await editorialEvidenceRepository.listValidatedEvidence(topic, input.limit ?? 500);
    if (!evidence.length) throw new ApiError(409, "EDITORIAL_VALIDATED_EVIDENCE_REQUIRED", "Editorial preparation requires passed validated evidence.");
    return editorialFoundationService.prepareFromValidatedEvidence({ topic, actor: input.actor, evidence });
  }
};
