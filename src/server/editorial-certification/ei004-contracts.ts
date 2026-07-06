import type { EditorialCertificationStatus } from "@/src/server/editorial-certification/contracts";
import type { EditorialNarrative } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";

export const EI004_TIER_A_CORPUS_VERSION = "ei-004-tier-a-v1" as const;

export type Ei004CertificationInvariantKey =
  | "writer_input_determinism" | "prompt_execution_lineage" | "policy_lineage" | "provider_lineage"
  | "composition_preservation" | "milestone_coverage" | "additional_milestone_absence"
  | "excluded_milestone_absence" | "phase_ordering" | "paragraph_ordering" | "sentence_ordering"
  | "sentence_claim_lineage" | "evidence_set_lineage" | "validation_lineage"
  | "citation_snapshot_lineage" | "quotation_grounding" | "number_grounding"
  | "chronology_grounding" | "causality_grounding" | "output_fingerprint"
  | "execution_key_identity" | "generation_unit_reuse" | "narrative_resume_reuse"
  | "revision_identity" | "package_lineage" | "artifact_ownership"
  | "factory_ownership" | "governance_exclusion";

export type Ei004CertificationInvariantResult = Readonly<{
  invariantKey: Ei004CertificationInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type Ei004CertificationCase = Readonly<{
  caseId: string;
  topic: string;
  writerVersion: string;
  generationAlgorithmVersion: string;
  executionKey: string;
  promptFingerprints: readonly string[];
  policyFingerprint: string;
  providerFingerprint: string;
  writerInputFingerprint: string;
  narrativeOutputFingerprint: string;
  narrative: EditorialNarrative & Readonly<{ revision: { revision: number; supersedesNarrativeId: string | null } }>;
  selectedMilestoneIds: readonly string[];
  excludedMilestoneIds: readonly string[];
  validatedEvidenceIds: readonly string[];
  sourceSnapshotIds: readonly string[];
  observedGenerationCallsOnResume: number;
  observedReusedUnitCount: number;
  observedRevision: Readonly<{ priorNarrativeId: string | null; revision: number }>;
  observedArtifact: Readonly<{ artifactId: string; factoryObjectId: string; outputFingerprint: string }>;
  observedPackage: Readonly<{ artifactRefs: readonly string[]; narrativeArtifactId: string }>;
  observedGovernanceAuthorityRefs: readonly string[];
  adversarialRejections: Readonly<Record<string, boolean>>;
}>;

export type Ei004CertificationCaseResult = Readonly<{
  caseId: string;
  topic: string;
  status: EditorialCertificationStatus;
  writerVersion: string;
  generationAlgorithmVersion: string;
  expectedFingerprint: string;
  actualFingerprint: string;
  expectedOutputFingerprint: string;
  actualOutputFingerprint: string;
  exactInput: Ei004CertificationCase;
  actualNarrativeOutput: EditorialNarrative | null;
  invariants: readonly Ei004CertificationInvariantResult[];
}>;

export type Ei004CertificationReport = Readonly<{
  certificationRunId?: string;
  epic: "EI-004";
  frameworkVersion: "editorial-certification-v1";
  corpusVersion: typeof EI004_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: EditorialCertificationStatus;
  authorityDecision: false;
  publicationReadinessDecision: false;
  caseResults: readonly Ei004CertificationCaseResult[];
  summary: Readonly<{
    caseCount: number; passedCaseCount: number; failedCaseCount: number;
    invariantCount: number; passedInvariantCount: number; failedInvariantCount: number;
  }>;
}>;
