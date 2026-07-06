import type {
  EditorialTimelineCandidate,
  EditorialTimelineChronology
} from "@/src/server/editorial-intelligence/timeline-compiler-contracts";

export const EDITORIAL_COMPOSITION_PLANNER_VERSION = "ei-003-planner-v1" as const;
export const EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION = "ei-003-composition-v1" as const;

export type EditorialCompositionTurningPointInput = Readonly<{
  evidenceRecordId: string;
  year: number | null;
  score: number;
}>;

export type EditorialCompositionChronologyGapInput = Readonly<{
  afterYear: number;
  beforeYear: number;
  spanYears: number;
}>;

export type EditorialCompositionPlannerInput = Readonly<{
  editorialTimelineCandidateId: string;
  timelineCandidate: EditorialTimelineCandidate;
  identifiedTurningPoints: readonly EditorialCompositionTurningPointInput[];
  chronologyGaps: readonly EditorialCompositionChronologyGapInput[];
}>;

export type EditorialCompositionBoundary = Readonly<{
  anchorMilestoneIds: readonly string[];
  purpose:
    | "establish_initial_conditions"
    | "establish_historical_outcome";
}>;

export type EditorialCompositionPhaseBasis =
  | "timeline_opening"
  | "turning_point_boundary"
  | "chronology_gap_boundary";

export type EditorialCompositionPhase = Readonly<{
  phaseId: string;
  sequence: number;
  startMilestoneId: string;
  endMilestoneId: string;
  milestoneIds: readonly string[];
  basis: EditorialCompositionPhaseBasis;
}>;

export type EditorialCompositionTurningPoint = Readonly<{
  milestoneId: string;
  evidenceRecordIds: readonly string[];
  phaseBeforeId: string | null;
  phaseAfterId: string | null;
  source: "ei_001_identified_turning_point";
}>;

export type EditorialCompositionTransition = Readonly<{
  fromPhaseId: string;
  toPhaseId: string;
  boundaryMilestoneId: string;
  transitionType:
    | "turning_point_transition"
    | "chronology_gap_transition";
}>;

export type EditorialCompositionContinuity = Readonly<{
  fromMilestoneId: string;
  toMilestoneId: string;
  basis: "chronological_adjacency";
}>;

export type EditorialCompositionArc = Readonly<{
  arcId: string;
  sequence: number;
  phaseIds: readonly string[];
  milestoneIds: readonly string[];
  basis: "full_timeline_arc";
}>;

export type EditorialComposition = Readonly<{
  canonicalSubject: string;
  editorialEvidenceSetId: string;
  editorialTimelineCandidateId: string;
  editorialTimelineCandidateFingerprint: string;
  plannerVersion: typeof EDITORIAL_COMPOSITION_PLANNER_VERSION;
  structureAlgorithmVersion: typeof EDITORIAL_COMPOSITION_STRUCTURE_ALGORITHM_VERSION;
  plannerInputFingerprint: string;
  introduction: EditorialCompositionBoundary;
  phases: readonly EditorialCompositionPhase[];
  turningPoints: readonly EditorialCompositionTurningPoint[];
  transitions: readonly EditorialCompositionTransition[];
  continuity: readonly EditorialCompositionContinuity[];
  historicalArcs: readonly EditorialCompositionArc[];
  excludedMilestoneIds: readonly string[];
  compositionMetadata: Readonly<{
    authorityDecision: false;
    publicationReadinessDecision: false;
    generatedText: false;
    sourceMilestoneCount: number;
  }>;
  conclusion: EditorialCompositionBoundary;
}>;

export type EditorialCompositionMilestoneView = Readonly<{
  milestoneId: string;
  sequence: number;
  chronology: EditorialTimelineChronology;
  evidenceRecordIds: readonly string[];
}>;
