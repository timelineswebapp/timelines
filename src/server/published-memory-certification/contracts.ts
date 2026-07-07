export const PUBLISHED_MEMORY_CERTIFICATION_FRAMEWORK_VERSION = "published-memory-certification-v1" as const;
export const PUBLISHED_MEMORY_END_TO_END_CERTIFICATION_VERSION = "published-memory-end-to-end-v1" as const;
export const PUBLISHED_MEMORY_TIER_A_CORPUS_VERSION = "published-memory-tier-a-v1" as const;

export type PublishedMemoryCertificationStatus = "passed" | "failed";

export type PublishedMemoryLifecycleOperation =
  | "admission"
  | "revision"
  | "version"
  | "merge_continuity"
  | "split_continuity"
  | "supersession_continuity"
  | "withdrawal_continuity"
  | "retirement_continuity"
  | "preservation_continuity"
  | "replay_continuity"
  | "recovery_continuity";

export type PublishedMemoryFailureInjectionKey =
  | "duplicate_publication"
  | "duplicate_canonical_publication"
  | "duplicate_version"
  | "broken_lineage"
  | "missing_historical_library_authority"
  | "missing_governance_lineage"
  | "missing_editorial_lineage"
  | "missing_evidence_lineage"
  | "invalid_authority"
  | "invalid_publication_identity"
  | "orphan_publication"
  | "cycle_creation"
  | "duplicate_replay"
  | "concurrent_publication"
  | "corrupted_snapshot"
  | "corrupted_version_chain"
  | "invalid_preservation"
  | "invalid_continuity";

export type PublishedMemoryInvariantKey =
  | "historical_library_required"
  | "editorial_lineage_preserved"
  | "evidence_lineage_preserved"
  | "governance_lineage_preserved"
  | "publication_identity_immutable"
  | "snapshot_immutable"
  | "version_immutable"
  | "audit_immutable"
  | "canonical_uniqueness"
  | "replay_deterministic"
  | "concurrency_protected"
  | "duplicate_rejection"
  | "historical_continuity_preserved"
  | "institutional_preservation_guaranteed"
  | "recovery_deterministic"
  | "publication_authority_deterministic"
  | "admission_validation"
  | "snapshot_lineage"
  | "canonical_publication_registration"
  | "version_registration"
  | "publication_audit_trail"
  | "failure_injection"
  | "scope_boundary"
  | "certification_persistence";

export type PublishedMemoryCertificationCase = Readonly<{
  caseId: string;
  subject: string;
  historicalLibraryAuthorityId: string;
  governanceDecisionId: string;
  governancePackageId: string;
  editorialLineageId: string;
  evidenceLineageIds: readonly string[];
  publicationIdentity: string;
  snapshotIds: readonly string[];
  versionIds: readonly string[];
  lifecycleOperations: readonly PublishedMemoryLifecycleOperation[];
  continuityRelationships: readonly string[];
  failureInjections: readonly PublishedMemoryFailureInjectionKey[];
}>;

export type PublishedMemoryInvariantResult = Readonly<{
  invariantKey: PublishedMemoryInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type PublishedMemoryFailureInjectionResult = Readonly<{
  failureKey: PublishedMemoryFailureInjectionKey;
  passed: boolean;
  expected: "fail_closed";
  actual: "fail_closed" | "not_verified";
  message: string;
}>;

export type PublishedMemoryLifecycleResult = Readonly<{
  operation: PublishedMemoryLifecycleOperation;
  passed: boolean;
  lineageVerified: boolean;
  auditVerified: boolean;
}>;

export type PublishedMemoryCertificationCaseResult = Readonly<{
  caseId: string;
  subject: string;
  status: PublishedMemoryCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: PublishedMemoryCertificationCase;
  stageResults: readonly Readonly<{ stage: string; status: PublishedMemoryCertificationStatus }>[];
  lifecycleResults: readonly PublishedMemoryLifecycleResult[];
  failureInjectionResults: readonly PublishedMemoryFailureInjectionResult[];
  invariants: readonly PublishedMemoryInvariantResult[];
}>;

export type PublishedMemoryCertificationReport = Readonly<{
  certificationRunId?: string;
  kind: "published_memory_end_to_end";
  scope: "end-to-end";
  frameworkVersion: typeof PUBLISHED_MEMORY_CERTIFICATION_FRAMEWORK_VERSION;
  certificationVersion: typeof PUBLISHED_MEMORY_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof PUBLISHED_MEMORY_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: PublishedMemoryCertificationStatus;
  boundary: Readonly<{
    beginsAfter: "historical_library_authority";
    endsAt: "published_memory_authority";
    excludes: readonly ["projection_engine", "search", "timeline_generation", "public_rendering", "apis", "ui", "platform"];
  }>;
  subjects: readonly string[];
  stageResults: readonly Readonly<{ stage: string; status: PublishedMemoryCertificationStatus }>[];
  caseResults: readonly PublishedMemoryCertificationCaseResult[];
  lifecycleStatistics: Readonly<Record<PublishedMemoryLifecycleOperation, number>>;
  publicationStatistics: Readonly<{ attempted: number; admitted: number; duplicateRejected: number }>;
  failureStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  determinismResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  regressionResults: readonly Readonly<{ subsystem: string; status: PublishedMemoryCertificationStatus }>[];
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

export type PublishedMemoryCertificationPersistence = Readonly<{
  createReport(report: PublishedMemoryCertificationReport, actor: string): Promise<PublishedMemoryCertificationReport>;
}>;
