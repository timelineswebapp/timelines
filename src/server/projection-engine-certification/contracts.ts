export const PROJECTION_ENGINE_CERTIFICATION_FRAMEWORK_VERSION = "projection-engine-certification-v1" as const;
export const PROJECTION_ENGINE_END_TO_END_CERTIFICATION_VERSION = "projection-engine-end-to-end-v1" as const;
export const PROJECTION_ENGINE_TIER_A_CORPUS_VERSION = "projection-engine-tier-a-v1" as const;

export type ProjectionEngineCertificationStatus = "passed" | "failed";

export type ProjectionEngineArea =
  | "projection_creation"
  | "projection_rebuild"
  | "projection_replay"
  | "projection_replacement"
  | "projection_preservation"
  | "projection_recovery"
  | "projection_determinism"
  | "projection_idempotency"
  | "projection_completeness"
  | "projection_authority_continuity";

export type ProjectionEngineFailureInjectionKey =
  | "missing_published_memory_authority"
  | "broken_lineage"
  | "missing_historical_library_lineage"
  | "missing_governance_lineage"
  | "missing_editorial_lineage"
  | "missing_evidence_lineage"
  | "duplicate_projection"
  | "duplicate_canonical_projection"
  | "projection_corruption"
  | "projection_truncation"
  | "invalid_chronology"
  | "invalid_ordering"
  | "missing_required_fields"
  | "invalid_authority_reference"
  | "orphan_projection"
  | "projection_cycle"
  | "projection_replay_conflict"
  | "concurrent_projection_generation"
  | "projection_rebuild_mismatch"
  | "projection_checksum_mismatch"
  | "projection_fingerprint_mismatch";

export type ProjectionEngineInvariantKey =
  | "published_memory_required"
  | "historical_library_lineage_preserved"
  | "governance_lineage_preserved"
  | "editorial_lineage_preserved"
  | "evidence_lineage_preserved"
  | "projection_authority_immutable"
  | "projection_deterministic"
  | "projection_replay_deterministic"
  | "projection_idempotent"
  | "canonical_uniqueness"
  | "duplicate_rejection"
  | "concurrency_protected"
  | "historical_continuity_preserved"
  | "authority_continuity_preserved"
  | "projection_completeness_guaranteed"
  | "projection_rebuild_deterministic"
  | "projection_recovery_deterministic"
  | "audit_immutable"
  | "institutional_preservation_guaranteed"
  | "scope_boundary"
  | "certification_persistence"
  | "failure_injection";

export type ProjectionEngineCertificationCase = Readonly<{
  caseId: string;
  subject: string;
  publishedSnapshotId: string;
  admissionId: string;
  governanceDecisionId: string;
  editorialLineageId: string;
  evidenceLineageIds: readonly string[];
  projectionTypes: readonly ["timeline", "milestone", "historical_object", "relationship", "search", "sitemap"];
  projectionAreas: readonly ProjectionEngineArea[];
  failureInjections: readonly ProjectionEngineFailureInjectionKey[];
}>;

export type ProjectionEngineInvariantResult = Readonly<{
  invariantKey: ProjectionEngineInvariantKey;
  passed: boolean;
  expected: unknown;
  actual: unknown;
  message: string;
}>;

export type ProjectionEngineFailureInjectionResult = Readonly<{
  failureKey: ProjectionEngineFailureInjectionKey;
  passed: boolean;
  expected: "fail_closed";
  actual: "fail_closed" | "not_verified";
  message: string;
}>;

export type ProjectionEngineAreaResult = Readonly<{
  area: ProjectionEngineArea;
  passed: boolean;
  lineageVerified: boolean;
  auditVerified: boolean;
}>;

export type ProjectionEngineCertificationCaseResult = Readonly<{
  caseId: string;
  subject: string;
  status: ProjectionEngineCertificationStatus;
  expectedFingerprint: string;
  actualFingerprint: string;
  exactInput: ProjectionEngineCertificationCase;
  stageResults: readonly Readonly<{ stage: string; status: ProjectionEngineCertificationStatus }>[];
  projectionResults: readonly ProjectionEngineAreaResult[];
  failureInjectionResults: readonly ProjectionEngineFailureInjectionResult[];
  invariants: readonly ProjectionEngineInvariantResult[];
}>;

export type ProjectionEngineCertificationReport = Readonly<{
  certificationRunId?: string;
  kind: "projection_engine_end_to_end";
  scope: "end-to-end";
  frameworkVersion: typeof PROJECTION_ENGINE_CERTIFICATION_FRAMEWORK_VERSION;
  certificationVersion: typeof PROJECTION_ENGINE_END_TO_END_CERTIFICATION_VERSION;
  corpusVersion: typeof PROJECTION_ENGINE_TIER_A_CORPUS_VERSION;
  corpusFingerprint: string;
  status: ProjectionEngineCertificationStatus;
  boundary: Readonly<{
    beginsAfter: "published_memory_authority";
    endsAt: "projection_engine_authority";
    excludes: readonly ["search", "timeline_generation", "public_apis", "ui", "rendering", "platform"];
  }>;
  subjects: readonly string[];
  stageResults: readonly Readonly<{ stage: string; status: ProjectionEngineCertificationStatus }>[];
  caseResults: readonly ProjectionEngineCertificationCaseResult[];
  projectionStatistics: Readonly<Record<ProjectionEngineArea, number>>;
  failureStatistics: Readonly<{ tested: number; passed: number; failed: number }>;
  determinismResults: readonly Readonly<{ caseId: string; passed: boolean; fingerprint: string }>[];
  regressionResults: readonly Readonly<{ subsystem: string; status: ProjectionEngineCertificationStatus }>[];
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

export type ProjectionEngineCertificationPersistence = Readonly<{
  createReport(report: ProjectionEngineCertificationReport, actor: string): Promise<ProjectionEngineCertificationReport>;
}>;
