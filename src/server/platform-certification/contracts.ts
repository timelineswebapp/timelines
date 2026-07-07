export const PLATFORM_CERTIFICATION_FRAMEWORK_VERSION = "public-platform-certification-v1" as const;
export const PLATFORM_END_TO_END_CERTIFICATION_VERSION = "public-platform-end-to-end-v1" as const;
export const PLATFORM_TIER_A_CORPUS_VERSION = "platform-tier-a-v1" as const;

export type PlatformCertificationStatus = "passed" | "failed";

export type PlatformFailureInjectionKey =
  | "missing_authority"
  | "broken_lineage"
  | "missing_projections"
  | "invalid_platform_read_model"
  | "broken_routing"
  | "missing_slug"
  | "duplicate_slug"
  | "duplicate_canonical_url"
  | "invalid_metadata"
  | "invalid_schema_org"
  | "broken_api_serialization"
  | "projection_corruption"
  | "authority_mismatch"
  | "orphan_projection"
  | "orphan_search_entry"
  | "broken_rendering"
  | "stale_projection"
  | "cache_inconsistency"
  | "missing_timeline"
  | "missing_milestone"
  | "missing_event"
  | "cross_authority_contamination"
  | "canonical_mismatch"
  | "invalid_replay"
  | "invalid_rebuild"
  | "concurrent_publication"
  | "duplicate_publication"
  | "duplicate_rendering"
  | "invalid_recovery"
  | "partial_rebuild"
  | "projection_checksum_mismatch"
  | "platform_replay_mismatch";

export type PlatformInvariantKey =
  | "editorial_lineage_preserved"
  | "governance_lineage_preserved"
  | "historical_library_lineage_preserved"
  | "published_memory_lineage_preserved"
  | "projection_lineage_preserved"
  | "search_lineage_preserved"
  | "platform_lineage_preserved"
  | "authority_preserved"
  | "canonical_url_uniqueness"
  | "slug_uniqueness"
  | "deterministic_routing"
  | "deterministic_rendering"
  | "projection_fidelity"
  | "metadata_fidelity"
  | "structured_data_fidelity"
  | "replay_determinism"
  | "recovery_determinism"
  | "rebuild_determinism"
  | "audit_immutability"
  | "institutional_preservation"
  | "public_authority_consistency"
  | "no_authority_mutation_during_rendering"
  | "no_rendering_outside_certified_authority"
  | "no_public_object_without_certified_lineage"
  | "api_serialization_deterministic"
  | "timeline_resolution_deterministic"
  | "event_rendering_grounded"
  | "milestone_rendering_grounded"
  | "public_boundary_excludes_admin"
  | "certification_persistence";

export type PlatformCertificationStage =
  | "evidence"
  | "editorial_intelligence"
  | "governance"
  | "historical_library"
  | "published_memory"
  | "projection_engine"
  | "platform_read_models"
  | "api_serialization"
  | "routing"
  | "timeline_resolution"
  | "timeline_rendering"
  | "event_rendering"
  | "milestone_rendering"
  | "canonical_urls"
  | "metadata"
  | "structured_data"
  | "authority_preservation"
  | "rendering_audit"
  | "public_platform";

export type PlatformCertificationCase = Readonly<{
  caseId: string;
  subject: string;
  evidenceLineageId: string;
  editorialLineageId: string;
  governanceDecisionId: string;
  historicalLibraryAuthorityId: string;
  publishedMemorySnapshotId: string;
  projectionId: string;
  searchProjectionId: string;
  timelineSlug: string;
  canonicalUrl: string;
  failureInjections: readonly PlatformFailureInjectionKey[];
}>;

export type PlatformFailureInjectionResult = Readonly<{
  failureKey: PlatformFailureInjectionKey;
  passed: boolean;
  expected: "fail_closed";
  actual: "fail_closed" | "not_verified";
  message: string;
}>;

export type PlatformInvariantResult = Readonly<{
  invariantKey: PlatformInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type PlatformCertificationCaseResult = Readonly<{
  caseId: string;
  subject: string;
  status: PlatformCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: PlatformCertificationCase;
  stageResults: readonly Readonly<{ stage: PlatformCertificationStage; status: PlatformCertificationStatus }>[];
  failureInjectionResults: readonly PlatformFailureInjectionResult[];
  invariants: readonly PlatformInvariantResult[];
}>;

export type PlatformCertificationReport = Readonly<{
  certificationRunId?: string;
  kind: "public_platform_end_to_end";
  scope: "end-to-end";
  frameworkVersion: typeof PLATFORM_CERTIFICATION_FRAMEWORK_VERSION;
  certificationVersion: typeof PLATFORM_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof PLATFORM_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: PlatformCertificationStatus;
  boundary: Readonly<{
    beginsAt: "validated_evidence";
    endsAt: "public_platform";
    excludes: readonly ["founder_ui", "factory_ui", "administration_ui", "analytics", "advertising", "monetization", "recommendations", "future_ai_services", "future_personalization"];
  }>;
  subjects: readonly string[];
  stageResults: readonly Readonly<{ stage: PlatformCertificationStage; status: PlatformCertificationStatus }>[];
  caseResults: readonly PlatformCertificationCaseResult[];
  failureStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  invariantStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  determinismResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  regressionResults: readonly Readonly<{ subsystem: string; status: PlatformCertificationStatus }>[];
  finalVerdict: "CERTIFIED" | "NOT CERTIFIED";
  summary: Readonly<{
    caseCount: number;
    passedCaseCount: number;
    failedCaseCount: number;
    failureInjectionCount: number;
    invariantCount: number;
  }>;
}>;

export type PlatformCertificationPersistence = Readonly<{
  createReport(report: PlatformCertificationReport, actor: string): Promise<PlatformCertificationReport>;
}>;
