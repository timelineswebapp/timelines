import type { EditorialTimelineCandidate, EditorialTimelineCompilerInput } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import type { Ei003CertificationReport } from "@/src/server/editorial-certification/ei003-contracts";
import type { Ei004CertificationReport } from "@/src/server/editorial-certification/ei004-contracts";
import type { EditorialEndToEndCertificationReport } from "@/src/server/editorial-certification/end-to-end-contracts";

export const EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION = "editorial-certification-v1" as const;
export const EI002_TIER_A_CORPUS_VERSION = "ei-002-tier-a-v1" as const;

export type EditorialCertificationStatus = "passed" | "failed";
export type Ei002CertificationInvariantKey =
  | "compiler_execution"
  | "deterministic_output"
  | "duplicate_suppression"
  | "chronology_ordering"
  | "fingerprint_stability"
  | "editorial_evidence_set_lineage"
  | "extraction_lineage"
  | "compiler_candidate_persistence"
  | "package_dependency"
  | "package_lineage_subset"
  | "compiler_artifact_ownership"
  | "compiler_exclusion_preservation"
  | "governance_candidate_exclusion";

export type EditorialCertificationInvariantResult = Readonly<{
  invariantKey: Ei002CertificationInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type Ei002CertificationCase = Readonly<{
  caseId: string;
  topic: string;
  compilerInput: EditorialTimelineCompilerInput;
  expectedCompilerFingerprint: string;
  expectedSelectedMilestoneIds: readonly string[];
  expectedExcludedMilestoneIds: readonly string[];
  extractionMilestoneIds: readonly string[];
  observedPersistence: Readonly<{
    candidateId: string;
    factoryObjectId: string;
    editorialEvidenceSetId: string;
    compilerInputFingerprint: string;
    selectedMilestoneIds: readonly string[];
    excludedMilestoneIds: readonly string[];
  }>;
  observedCompilerArtifact: Readonly<{
    artifactId: string;
    factoryObjectId: string;
    editorialTimelineCandidateId: string;
    compilerInputFingerprint: string;
  }>;
  observedPackage: Readonly<{
    artifactRefs: readonly string[];
    milestoneAuthorityRefs: readonly string[];
  }>;
  observedGovernanceAuthorityRefs: readonly string[];
}>;

export type EditorialCertificationCaseResult = Readonly<{
  caseId: string;
  topic: string;
  status: EditorialCertificationStatus;
  compilerVersion: string;
  selectionAlgorithmVersion: string;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: Ei002CertificationCase;
  actualCompilerOutput: EditorialTimelineCandidate | null;
  invariants: readonly EditorialCertificationInvariantResult[];
}>;

export type EditorialCertificationReport = Readonly<{
  certificationRunId?: string;
  epic: "EI-002";
  frameworkVersion: typeof EDITORIAL_CERTIFICATION_FRAMEWORK_VERSION;
  corpusVersion: typeof EI002_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: EditorialCertificationStatus;
  authorityDecision: false;
  publicationReadinessDecision: false;
  caseResults: readonly EditorialCertificationCaseResult[];
  summary: Readonly<{
    caseCount: number;
    passedCaseCount: number;
    failedCaseCount: number;
    invariantCount: number;
    passedInvariantCount: number;
    failedInvariantCount: number;
  }>;
}>;

export type EditorialCertificationPersistence = Readonly<{
  createReport<T extends EditorialCertificationReport | Ei003CertificationReport | Ei004CertificationReport | EditorialEndToEndCertificationReport>(
    report: T,
    actor: string
  ): Promise<T>;
}>;
