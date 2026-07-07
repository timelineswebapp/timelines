import type { EditorialCertificationStatus } from "@/src/server/editorial-certification/contracts";

export const EDITORIAL_END_TO_END_CERTIFICATION_VERSION = "editorial-end-to-end-v1" as const;
export const EDITORIAL_END_TO_END_CORPUS_VERSION = "editorial-end-to-end-tier-a-v1" as const;

export type EditorialEndToEndInvariantKey =
  | "stage_execution_order" | "ei002_certified" | "ei003_certified" | "ei004_certified"
  | "deterministic_execution" | "writer_determinism" | "prompt_lineage" | "policy_lineage"
  | "provider_lineage" | "evidence_lineage" | "claim_lineage" | "citation_lineage"
  | "source_snapshot_lineage" | "package_lineage" | "artifact_ownership"
  | "governance_ready_package_integrity" | "fingerprint_stability" | "revision_identity"
  | "resume_determinism" | "chronology_integrity" | "composition_integrity"
  | "milestone_preservation" | "compiler_invariants" | "governance_exclusion"
  | "factory_ownership_boundaries";

export type EditorialEndToEndInvariantResult = Readonly<{
  invariantKey: EditorialEndToEndInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type EditorialEndToEndCase = Readonly<{
  caseId: string;
  topic: string;
  ei002CaseId: string;
  ei003CaseId: string;
  ei004CaseId: string;
}>;

export type EditorialEndToEndCaseResult = Readonly<{
  caseId: string;
  topic: string;
  status: EditorialCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: EditorialEndToEndCase;
  actualOutput: Readonly<{
    stageOrder: readonly ["EI-001", "EI-002", "EI-003", "EI-004", "factory_narrative_package", "governance_ready"];
    executionLineage: Readonly<Record<string, string>>;
    deterministicFingerprints: readonly string[];
  }>;
  invariants: readonly EditorialEndToEndInvariantResult[];
}>;

export type EditorialEndToEndCertificationReport = Readonly<{
  certificationRunId?: string;
  epic: "EI-END-TO-END";
  certificationScope: "end-to-end";
  certificationKind: "end_to_end_editorial_intelligence";
  frameworkVersion: "editorial-certification-v1";
  certificationVersion: typeof EDITORIAL_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof EDITORIAL_END_TO_END_CORPUS_VERSION;
  corpusFingerprint: string;
  status: EditorialCertificationStatus;
  authorityDecision: false;
  publicationReadinessDecision: false;
  stageResults: readonly Readonly<{ stage: string; status: EditorialCertificationStatus }>[];
  caseResults: readonly EditorialEndToEndCaseResult[];
  failures: readonly Readonly<{ caseId: string; invariantKey: string; message: string }>[];
  finalInstitutionalDecision: "certified" | "not_certified";
  summary: Readonly<{
    caseCount: number; passedCaseCount: number; failedCaseCount: number;
    invariantCount: number; passedInvariantCount: number; failedInvariantCount: number;
  }>;
}>;
