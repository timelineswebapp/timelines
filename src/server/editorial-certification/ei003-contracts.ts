import type { EditorialComposition, EditorialCompositionPlannerInput } from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import type { EditorialCertificationStatus } from "@/src/server/editorial-certification/contracts";

export const EI003_TIER_A_CORPUS_VERSION = "ei-003-tier-a-v1" as const;

export type Ei003CertificationInvariantKey =
  | "planner_execution" | "deterministic_output" | "fingerprint_stability"
  | "chronology_preservation" | "membership_equality" | "exclusion_preservation"
  | "phase_ordering" | "phase_membership" | "turning_point_lineage"
  | "continuity_integrity" | "transition_integrity" | "arc_integrity"
  | "structural_boundaries" | "generated_content_absence"
  | "persistence_equality" | "resume_fingerprint_reuse"
  | "compiler_artifact_dependency" | "composition_artifact_dependency"
  | "artifact_ownership" | "predecessor_lineage"
  | "factory_ownership" | "governance_exclusion";

export type Ei003CertificationInvariantResult = Readonly<{
  invariantKey: Ei003CertificationInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type Ei003CertificationCase = Readonly<{
  caseId: string;
  topic: string;
  plannerInput: EditorialCompositionPlannerInput;
  expectedPlannerInputFingerprint: string;
  expectedOutputFingerprint: string;
  observedPersistence: Readonly<{
    compositionId: string;
    factoryObjectId: string;
    plannerInputFingerprint: string;
    output: EditorialComposition;
  }>;
  observedArtifacts: Readonly<{
    compilerArtifactId: string;
    compositionArtifactId: string;
    compositionFactoryObjectId: string;
    editorialTimelineCandidateId: string;
  }>;
  observedPackage: Readonly<{
    artifactRefs: readonly string[];
    milestoneAuthorityRefs: readonly string[];
  }>;
  observedGovernanceAuthorityRefs: readonly string[];
}>;

export type Ei003CertificationCaseResult = Readonly<{
  caseId: string;
  topic: string;
  status: EditorialCertificationStatus;
  plannerVersion: string;
  structureAlgorithmVersion: string;
  expectedFingerprint: string;
  actualFingerprint: string;
  expectedOutputFingerprint: string;
  actualOutputFingerprint: string;
  exactInput: Ei003CertificationCase;
  actualCompositionOutput: EditorialComposition | null;
  invariants: readonly Ei003CertificationInvariantResult[];
}>;

export type Ei003CertificationReport = Readonly<{
  certificationRunId?: string;
  epic: "EI-003";
  frameworkVersion: "editorial-certification-v1";
  corpusVersion: typeof EI003_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: EditorialCertificationStatus;
  authorityDecision: false;
  publicationReadinessDecision: false;
  caseResults: readonly Ei003CertificationCaseResult[];
  summary: Readonly<{
    caseCount: number; passedCaseCount: number; failedCaseCount: number;
    invariantCount: number; passedInvariantCount: number; failedInvariantCount: number;
  }>;
}>;
