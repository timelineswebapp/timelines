export const HISTORICAL_LIBRARY_CERTIFICATION_FRAMEWORK_VERSION = "historical-library-certification-v1" as const;
export const HISTORICAL_LIBRARY_END_TO_END_CERTIFICATION_VERSION = "historical-library-end-to-end-v1" as const;
export const HISTORICAL_LIBRARY_TIER_A_CORPUS_VERSION = "historical-library-tier-a-v1" as const;

export type HistoricalLibraryCertificationStatus = "passed" | "failed";

export type HistoricalLibraryLifecycleOperation =
  | "admission"
  | "revision"
  | "merge"
  | "split"
  | "supersession"
  | "withdrawal"
  | "retirement"
  | "preservation";

export type HistoricalLibraryInvariantKey =
  | "governance_approval_required"
  | "editorial_lineage_preserved"
  | "evidence_lineage_preserved"
  | "canonical_uniqueness"
  | "identity_immutability"
  | "admission_immutability"
  | "lifecycle_immutability"
  | "audit_immutability"
  | "authority_continuity"
  | "split_continuity"
  | "merge_continuity"
  | "supersession_continuity"
  | "withdrawal_continuity"
  | "revision_continuity"
  | "preservation_continuity"
  | "retirement_continuity"
  | "replay_determinism"
  | "concurrency_protection"
  | "duplicate_rejection"
  | "historical_continuity"
  | "bounded_traversal"
  | "cycle_prevention"
  | "failure_injection";

export type HistoricalLibraryFailureInjectionKey =
  | "duplicate_admission"
  | "duplicate_canonical_authority"
  | "broken_lineage"
  | "missing_governance_approval"
  | "missing_editorial_lineage"
  | "missing_evidence"
  | "invalid_authority_id"
  | "orphan_continuity_edge"
  | "invalid_split"
  | "invalid_merge"
  | "invalid_withdrawal"
  | "invalid_supersession"
  | "self_reference"
  | "cycle_creation"
  | "duplicate_replay"
  | "concurrent_mutation";

export type HistoricalLibraryCertificationCase = Readonly<{
  caseId: string;
  subject: string;
  governancePackageId: string;
  governanceDecisionId: string;
  editorialLineageId: string;
  evidenceLineageIds: readonly string[];
  authorityIds: readonly string[];
  lifecycleOperations: readonly HistoricalLibraryLifecycleOperation[];
  continuityEdges: readonly Readonly<{
    operation: HistoricalLibraryLifecycleOperation;
    sourceAuthorityId: string;
    targetAuthorityIds: readonly string[];
    relationship: string;
  }>[];
  failureInjections: readonly HistoricalLibraryFailureInjectionKey[];
}>;

export type HistoricalLibraryInvariantResult = Readonly<{
  invariantKey: HistoricalLibraryInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type HistoricalLibraryFailureInjectionResult = Readonly<{
  failureKey: HistoricalLibraryFailureInjectionKey;
  passed: boolean;
  expected: "fail_closed";
  actual: "fail_closed" | "not_verified";
  message: string;
}>;

export type HistoricalLibraryLifecycleResult = Readonly<{
  operation: HistoricalLibraryLifecycleOperation;
  passed: boolean;
  continuityVerified: boolean;
  auditVerified: boolean;
}>;

export type HistoricalLibraryCertificationCaseResult = Readonly<{
  caseId: string;
  subject: string;
  status: HistoricalLibraryCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: HistoricalLibraryCertificationCase;
  stageResults: readonly Readonly<{ stage: string; status: HistoricalLibraryCertificationStatus }>[];
  lifecycleResults: readonly HistoricalLibraryLifecycleResult[];
  failureInjectionResults: readonly HistoricalLibraryFailureInjectionResult[];
  invariants: readonly HistoricalLibraryInvariantResult[];
}>;

export type HistoricalLibraryCertificationReport = Readonly<{
  certificationRunId?: string;
  kind: "historical_library_end_to_end";
  scope: "end-to-end";
  frameworkVersion: typeof HISTORICAL_LIBRARY_CERTIFICATION_FRAMEWORK_VERSION;
  certificationVersion: typeof HISTORICAL_LIBRARY_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof HISTORICAL_LIBRARY_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: HistoricalLibraryCertificationStatus;
  boundary: Readonly<{
    beginsAfter: "governance_approval";
    endsAt: "historical_library_authority";
    excludes: readonly ["published_memory", "projection_engine", "search", "timeline_generation", "public_platform"];
  }>;
  subjects: readonly string[];
  stageResults: readonly Readonly<{ stage: string; status: HistoricalLibraryCertificationStatus }>[];
  caseResults: readonly HistoricalLibraryCertificationCaseResult[];
  lifecycleStatistics: Readonly<Record<HistoricalLibraryLifecycleOperation, number>>;
  admissionStatistics: Readonly<{ attempted: number; admitted: number; duplicateRejected: number }>;
  failureStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  determinismResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  regressionResults: readonly Readonly<{ subsystem: string; status: HistoricalLibraryCertificationStatus }>[];
  finalVerdict: "CERTIFIED" | "NOT CERTIFIED";
  summary: Readonly<{
    caseCount: number;
    passedCaseCount: number;
    failedCaseCount: number;
    invariantCount: number;
    passedInvariantCount: number;
    failedInvariantCount: number;
  }>;
}>;

export type HistoricalLibraryCertificationPersistence = Readonly<{
  createReport(report: HistoricalLibraryCertificationReport, actor: string): Promise<HistoricalLibraryCertificationReport>;
}>;
