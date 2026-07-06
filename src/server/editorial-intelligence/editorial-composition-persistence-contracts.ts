import type {
  EditorialComposition,
  EditorialCompositionArc,
  EditorialCompositionBoundary,
  EditorialCompositionContinuity,
  EditorialCompositionPhase,
  EditorialCompositionTransition,
  EditorialCompositionTurningPoint
} from "@/src/server/editorial-intelligence/editorial-composition-contracts";

export type PersistEditorialCompositionInput = Readonly<{
  composition: EditorialComposition;
  actor: string;
}>;

export type PersistedEditorialComposition = Readonly<{
  compositionId: string;
  factoryObjectId: string;
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  editorialTimelineCandidateId: string;
  editorialTimelineCandidateFingerprint: string;
  plannerVersion: string;
  structureAlgorithmVersion: string;
  plannerInputFingerprint: string;
  introduction: EditorialCompositionBoundary;
  phases: readonly EditorialCompositionPhase[];
  turningPoints: readonly EditorialCompositionTurningPoint[];
  transitions: readonly EditorialCompositionTransition[];
  continuity: readonly EditorialCompositionContinuity[];
  historicalArcs: readonly EditorialCompositionArc[];
  excludedMilestoneIds: readonly string[];
  compositionMetadata: EditorialComposition["compositionMetadata"];
  conclusion: EditorialCompositionBoundary;
  createdBy: string;
  createdAt?: string;
}>;

export type EditorialCompositionPersistence = Readonly<{
  create(input: PersistEditorialCompositionInput): Promise<PersistedEditorialComposition>;
  getById(compositionId: string): Promise<PersistedEditorialComposition | null>;
  getByFingerprint(
    editorialTimelineCandidateId: string,
    plannerInputFingerprint: string
  ): Promise<PersistedEditorialComposition | null>;
}>;
