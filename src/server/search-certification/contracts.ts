export const SEARCH_CERTIFICATION_FRAMEWORK_VERSION = "search-certification-v1" as const;
export const SEARCH_END_TO_END_CERTIFICATION_VERSION = "search-end-to-end-v1" as const;
export const SEARCH_TIER_A_CORPUS_VERSION = "search-tier-a-v1" as const;

export type SearchCertificationStatus = "passed" | "failed";

export type SearchCertificationArea =
  | "projection_ingestion"
  | "index_creation"
  | "index_normalization"
  | "entity_indexing"
  | "timeline_indexing"
  | "milestone_indexing"
  | "chronology_indexing"
  | "relationship_indexing"
  | "canonical_indexing"
  | "incremental_indexing"
  | "full_rebuild"
  | "replay"
  | "recovery"
  | "determinism"
  | "completeness"
  | "authority_continuity";

export type SearchFailureInjectionKey =
  | "missing_projection"
  | "missing_published_memory_lineage"
  | "missing_historical_library_lineage"
  | "missing_governance_lineage"
  | "missing_editorial_lineage"
  | "missing_evidence_lineage"
  | "duplicate_index"
  | "duplicate_canonical_identity"
  | "orphan_index"
  | "broken_lineage"
  | "invalid_authority_reference"
  | "invalid_chronology"
  | "invalid_entity"
  | "invalid_relationship"
  | "invalid_projection_reference"
  | "corrupted_index"
  | "truncated_index"
  | "checksum_mismatch"
  | "fingerprint_mismatch"
  | "rebuild_mismatch"
  | "incremental_rebuild_mismatch"
  | "concurrent_indexing"
  | "duplicate_replay"
  | "cycle_creation"
  | "invalid_preservation";

export type SearchInvariantKey =
  | "projection_engine_required"
  | "published_memory_lineage_preserved"
  | "historical_library_lineage_preserved"
  | "governance_lineage_preserved"
  | "editorial_lineage_preserved"
  | "evidence_lineage_preserved"
  | "index_immutable"
  | "canonical_uniqueness"
  | "replay_deterministic"
  | "rebuild_deterministic"
  | "incremental_rebuild_deterministic"
  | "duplicate_rejection"
  | "concurrency_protected"
  | "historical_continuity_preserved"
  | "authority_continuity_preserved"
  | "projection_fidelity_preserved"
  | "index_completeness_guaranteed"
  | "audit_immutable"
  | "institutional_preservation_guaranteed"
  | "recovery_deterministic"
  | "query_consistency"
  | "scope_boundary"
  | "certification_persistence"
  | "failure_injection";

export type SearchCertificationCase = Readonly<{
  caseId: string;
  subject: string;
  projectionId: string;
  publishedSnapshotId: string;
  historicalLibraryAuthorityId: string;
  governanceDecisionId: string;
  editorialLineageId: string;
  evidenceLineageIds: readonly string[];
  searchAreas: readonly SearchCertificationArea[];
  failureInjections: readonly SearchFailureInjectionKey[];
}>;

export type SearchAreaResult = Readonly<{
  area: SearchCertificationArea;
  passed: boolean;
  projectionVerified: boolean;
  lineageVerified: boolean;
  auditVerified: boolean;
}>;

export type SearchFailureInjectionResult = Readonly<{
  failureKey: SearchFailureInjectionKey;
  passed: boolean;
  expected: "fail_closed";
  actual: "fail_closed" | "not_verified";
  message: string;
}>;

export type SearchInvariantResult = Readonly<{
  invariantKey: SearchInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type SearchCertificationCaseResult = Readonly<{
  caseId: string;
  subject: string;
  status: SearchCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: SearchCertificationCase;
  stageResults: readonly Readonly<{ stage: string; status: SearchCertificationStatus }>[];
  searchResults: readonly SearchAreaResult[];
  failureInjectionResults: readonly SearchFailureInjectionResult[];
  invariants: readonly SearchInvariantResult[];
}>;

export type SearchCertificationReport = Readonly<{
  certificationRunId?: string;
  kind: "search_end_to_end";
  scope: "end-to-end";
  frameworkVersion: typeof SEARCH_CERTIFICATION_FRAMEWORK_VERSION;
  certificationVersion: typeof SEARCH_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof SEARCH_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: SearchCertificationStatus;
  boundary: Readonly<{
    beginsAfter: "projection_engine_authority";
    endsAt: "search_authority";
    excludes: readonly ["timeline_generation", "public_apis", "ui", "rendering", "platform"];
  }>;
  subjects: readonly string[];
  stageResults: readonly Readonly<{ stage: string; status: SearchCertificationStatus }>[];
  caseResults: readonly SearchCertificationCaseResult[];
  searchStatistics: Readonly<Record<SearchCertificationArea, number>>;
  failureStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  determinismResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  replayResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  recoveryResults: readonly Readonly<{ caseId: string; passed: boolean }>[];
  regressionResults: readonly Readonly<{ subsystem: string; status: SearchCertificationStatus }>[];
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

export type SearchCertificationPersistence = Readonly<{
  createReport(report: SearchCertificationReport, actor: string): Promise<SearchCertificationReport>;
}>;
