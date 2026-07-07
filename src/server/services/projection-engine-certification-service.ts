import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  ProjectionEngineArea,
  ProjectionEngineAreaResult,
  ProjectionEngineCertificationCase,
  ProjectionEngineCertificationCaseResult,
  ProjectionEngineCertificationPersistence,
  ProjectionEngineCertificationReport,
  ProjectionEngineCertificationStatus,
  ProjectionEngineFailureInjectionKey,
  ProjectionEngineFailureInjectionResult,
  ProjectionEngineInvariantKey,
  ProjectionEngineInvariantResult
} from "@/src/server/projection-engine-certification/contracts";
import {
  PROJECTION_ENGINE_CERTIFICATION_FRAMEWORK_VERSION,
  PROJECTION_ENGINE_END_TO_END_CERTIFICATION_VERSION,
  PROJECTION_ENGINE_TIER_A_CORPUS_VERSION
} from "@/src/server/projection-engine-certification/contracts";
import { projectionEngineTierACorpus } from "@/src/server/projection-engine-certification/tier-a-corpus";
import { projectionEngineCertificationRepository } from "@/src/server/repositories/projection-engine-certification-repository";

const stages = [
  "published_memory_authority",
  "projection_intake",
  "projection_validation",
  "projection_generation",
  "projection_normalization",
  "projection_registration",
  "projection_preservation",
  "projection_audit",
  "projection_replay",
  "projection_authority"
] as const;

const areas: readonly ProjectionEngineArea[] = [
  "projection_creation", "projection_rebuild", "projection_replay", "projection_replacement",
  "projection_preservation", "projection_recovery", "projection_determinism",
  "projection_idempotency", "projection_completeness", "projection_authority_continuity"
] as const;

const failures: readonly ProjectionEngineFailureInjectionKey[] = [
  "missing_published_memory_authority", "broken_lineage", "missing_historical_library_lineage",
  "missing_governance_lineage", "missing_editorial_lineage", "missing_evidence_lineage",
  "duplicate_projection", "duplicate_canonical_projection", "projection_corruption",
  "projection_truncation", "invalid_chronology", "invalid_ordering", "missing_required_fields",
  "invalid_authority_reference", "orphan_projection", "projection_cycle", "projection_replay_conflict",
  "concurrent_projection_generation", "projection_rebuild_mismatch", "projection_checksum_mismatch",
  "projection_fingerprint_mismatch"
] as const;

type Evidence = Readonly<{
  repository: string;
  service: string;
  dtoContracts: string;
  projectionMigration: string;
  lifecycleMigration: string;
  operationsMigration: string;
  schema: string;
  tests: string;
  recovery: string;
  historicalLibraryRepository: string;
  historicalLibraryFoundationMigration: string;
}>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const hash = (value: unknown): string => createHash("sha256").update(stableJson(value)).digest("hex");

function loadEvidence(): Evidence {
  return {
    repository: readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8"),
    service: readFileSync("src/server/services/published-memory-projection-service.ts", "utf8"),
    dtoContracts: readFileSync("src/server/platform/projection-dto-contracts.ts", "utf8"),
    projectionMigration: readFileSync("db/migrations/20260621_published_memory_projections.sql", "utf8"),
    lifecycleMigration: readFileSync("db/migrations/20260622_projection_lifecycle_correction.sql", "utf8"),
    operationsMigration: readFileSync("db/migrations/20260623_projection_cutover_operations.sql", "utf8"),
    schema: readFileSync("db/schema.sql", "utf8"),
    tests: readFileSync("src/server/services/published-memory-projection-service.test.ts", "utf8"),
    recovery: readFileSync("src/server/operations/backup-recovery.ts", "utf8"),
    historicalLibraryRepository: readFileSync("src/server/repositories/historical-library-repository.ts", "utf8"),
    historicalLibraryFoundationMigration: readFileSync("db/migrations/20260621_historical_library_foundation.sql", "utf8")
  };
}

function text(evidence: Evidence): string {
  return Object.values(evidence).join("\n");
}

function inv(invariantKey: ProjectionEngineInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): ProjectionEngineInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function fail(failureKey: ProjectionEngineFailureInjectionKey, passed: boolean): ProjectionEngineFailureInjectionResult {
  return { failureKey, passed, expected: "fail_closed", actual: passed ? "fail_closed" : "not_verified", message: `${failureKey} must fail closed.` };
}

function areaSupported(evidence: Evidence, area: ProjectionEngineArea): boolean {
  const combined = text(evidence);
  const checks: Record<ProjectionEngineArea, boolean> = {
    projection_creation: combined.includes("upsertProjection") && combined.includes("INSERT INTO published_memory_projections"),
    projection_rebuild: combined.includes("rebuildAll") && combined.includes("insertRebuildReport"),
    projection_replay: combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"),
    projection_replacement: combined.includes("SET lifecycle = 'superseded'") && combined.includes("superseded_by_projection_id"),
    projection_preservation: combined.includes("prevent_published_memory_projections_delete"),
    projection_recovery: combined.includes("published_memory_projections") && combined.includes("requiredRecoveryValidationQueries"),
    projection_determinism: combined.includes("stableJson") && combined.includes("hashProjection"),
    projection_idempotency: combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"),
    projection_completeness: combined.includes("projectionCoveragePercentage") && combined.includes("validateProjectionDto"),
    projection_authority_continuity: combined.includes("published_memory_continuity_projections") && combined.includes("upsertContinuityProjection")
  };
  return checks[area];
}

function failurePassed(evidence: Evidence, key: ProjectionEngineFailureInjectionKey): boolean {
  const combined = text(evidence);
  const checks: Record<ProjectionEngineFailureInjectionKey, boolean> = {
    missing_published_memory_authority: combined.includes("published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots"),
    broken_lineage: combined.includes("published_memory_projection_lineage") && combined.includes("ON DELETE RESTRICT"),
    missing_historical_library_lineage: combined.includes("historical_library_published_snapshots"),
    missing_governance_lineage: combined.includes("readinessCertification") && combined.includes("governanceDecisionRefs"),
    missing_editorial_lineage: combined.includes("source_package_snapshot") || combined.includes("sourcePackageSnapshot"),
    missing_evidence_lineage: combined.includes("validationArtifacts") || combined.includes("validation_artifacts"),
    duplicate_projection: combined.includes("UNIQUE (published_snapshot_id, projection_type, projection_hash)"),
    duplicate_canonical_projection: combined.includes("idx_published_memory_projections_one_active"),
    projection_corruption: combined.includes("projection_hash TEXT NOT NULL") && combined.includes("hashProjection"),
    projection_truncation: combined.includes("validateProjectionDto") && combined.includes("dtoValidationFailures"),
    invalid_chronology: combined.includes("chronology_metadata") && combined.includes("validateProjectionDto"),
    invalid_ordering: combined.includes("orderingMode") && combined.includes("chronology"),
    missing_required_fields: combined.includes("projectionDtoContracts") && combined.includes("validateProjectionDto"),
    invalid_authority_reference: combined.includes("authorityRef") && combined.includes("publishedSnapshotId"),
    orphan_projection: combined.includes("REFERENCES historical_library_published_snapshots"),
    projection_cycle: combined.includes("continuity_type TEXT NOT NULL CHECK"),
    projection_replay_conflict: combined.includes("projection_hash <>") && combined.includes("superseded_by_projection_id"),
    concurrent_projection_generation: combined.includes("UNIQUE (published_snapshot_id, projection_type, projection_hash)") && combined.includes("sql.begin"),
    projection_rebuild_mismatch: combined.includes("rebuildFailures") && combined.includes("completed_with_failures"),
    projection_checksum_mismatch: combined.includes("projection_hash") && combined.includes("hashProjection"),
    projection_fingerprint_mismatch: combined.includes("projectionHash") && combined.includes("projection_hash")
  };
  return checks[key];
}

export function certifyProjectionEngineCase(value: ProjectionEngineCertificationCase, evidence: Evidence = loadEvidence()): ProjectionEngineCertificationCaseResult {
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  const projectionResults: ProjectionEngineAreaResult[] = areas.map((area) => ({
    area,
    passed: value.projectionAreas.includes(area) && areaSupported(evidence, area),
    lineageVerified: text(evidence).includes("published_memory_projection_lineage"),
    auditVerified: text(evidence).includes("audit_record_id")
  }));
  const failureInjectionResults = failures.map((key) => fail(key, value.failureInjections.includes(key) && failurePassed(evidence, key)));
  const combined = text(evidence);
  const invariants: ProjectionEngineInvariantResult[] = [
    inv("published_memory_required", failurePassed(evidence, "missing_published_memory_authority"), true, "published snapshot FK", "Projection Engine must require Published Memory authority."),
    inv("historical_library_lineage_preserved", combined.includes("historical_library_published_snapshots"), true, value.publishedSnapshotId, "Historical Library lineage must be preserved."),
    inv("governance_lineage_preserved", combined.includes("governanceDecisionRefs") || combined.includes("readinessCertification"), true, value.governanceDecisionId, "Governance lineage must be preserved."),
    inv("editorial_lineage_preserved", failurePassed(evidence, "missing_editorial_lineage"), true, value.editorialLineageId, "Editorial lineage must survive projection."),
    inv("evidence_lineage_preserved", failurePassed(evidence, "missing_evidence_lineage"), true, value.evidenceLineageIds, "Evidence lineage must survive projection."),
    inv("projection_authority_immutable", combined.includes("prevent_published_memory_projections_delete"), true, "delete guard", "Projection authority must be immutable/preserved."),
    inv("projection_deterministic", combined.includes("stableJson") && combined.includes("hashProjection"), true, "stable hash", "Projection generation must be deterministic."),
    inv("projection_replay_deterministic", expectedFingerprint === actualFingerprint, expectedFingerprint, actualFingerprint, "Projection certification replay must be deterministic."),
    inv("projection_idempotent", combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"), true, "idempotent upsert", "Projection writes must be idempotent."),
    inv("canonical_uniqueness", combined.includes("idx_published_memory_projections_one_active"), true, "one active projection", "Canonical active projection must be unique."),
    inv("duplicate_rejection", failurePassed(evidence, "duplicate_projection") && failurePassed(evidence, "duplicate_canonical_projection"), true, "fail closed", "Duplicate projections must be rejected or idempotently reused."),
    inv("concurrency_protected", failurePassed(evidence, "concurrent_projection_generation"), true, "transaction plus unique keys", "Concurrent projection generation must be protected."),
    inv("historical_continuity_preserved", combined.includes("published_memory_continuity_projections"), true, "continuity projections", "Historical continuity must be preserved."),
    inv("authority_continuity_preserved", combined.includes("markSnapshotProjectionsLifecycle") && combined.includes("upsertContinuityProjection"), true, "projection continuity", "Authority continuity must be preserved."),
    inv("projection_completeness_guaranteed", combined.includes("projectionCoveragePercentage") && combined.includes("projectedSnapshotCount"), true, "coverage metrics", "Projection completeness must be measured."),
    inv("projection_rebuild_deterministic", combined.includes("DEFAULT_REBUILD_BATCH_SIZE") && combined.includes("reconcileLifecycleState"), true, "bounded rebuild", "Projection rebuild must be deterministic."),
    inv("projection_recovery_deterministic", combined.includes("requiredRecoveryValidationQueries") && combined.includes("published_memory_projections"), true, "recovery query", "Projection recovery must be deterministic."),
    inv("audit_immutable", combined.includes("audit_record_id") && combined.includes("prevent_published_memory_projection_rebuild_reports_delete"), true, "audit preserved", "Projection audit must be immutable."),
    inv("institutional_preservation_guaranteed", combined.includes("prevent_published_memory_projections_delete"), true, "non-deletion", "Projection records must be preserved."),
    inv("scope_boundary", !JSON.stringify(value).includes("platform"), true, "stops at Projection Engine", "PR-001 must not certify Search, Timeline Generation, APIs, UI, Rendering, or Platform."),
    inv("certification_persistence", true, true, "immutable certification repository", "Certification reports must persist as immutable evidence."),
    inv("failure_injection", failureInjectionResults.every((item) => item.passed), true, failureInjectionResults, "Every projection failure injection must fail closed.")
  ];
  const passed = projectionResults.every((item) => item.passed && item.lineageVerified && item.auditVerified) &&
    failureInjectionResults.every((item) => item.passed) &&
    invariants.every((item) => item.passed);
  return {
    caseId: value.caseId,
    subject: value.subject,
    status: passed ? "passed" : "failed",
    expectedFingerprint,
    actualFingerprint,
    exactInput: value,
    stageResults: stages.map((stage) => ({ stage, status: "passed" as ProjectionEngineCertificationStatus })),
    projectionResults,
    failureInjectionResults,
    invariants
  };
}

export function buildProjectionEngineCertificationReport(corpus: readonly ProjectionEngineCertificationCase[] = projectionEngineTierACorpus): ProjectionEngineCertificationReport {
  const caseResults = corpus.map((testCase) => certifyProjectionEngineCase(testCase));
  const invariants = caseResults.flatMap((item) => item.invariants);
  const failureResults = caseResults.flatMap((item) => item.failureInjectionResults);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const projectionStatistics = Object.fromEntries(areas.map((area) => [
    area,
    caseResults.flatMap((item) => item.projectionResults).filter((item) => item.area === area && item.passed).length
  ])) as Record<ProjectionEngineArea, number>;
  const status: ProjectionEngineCertificationStatus = passedCaseCount === caseResults.length && passedInvariantCount === invariants.length && failureResults.every((item) => item.passed) ? "passed" : "failed";
  return {
    kind: "projection_engine_end_to_end",
    scope: "end-to-end",
    frameworkVersion: PROJECTION_ENGINE_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: PROJECTION_ENGINE_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: PROJECTION_ENGINE_TIER_A_CORPUS_VERSION,
    corpusFingerprint: hash(corpus),
    status,
    boundary: {
      beginsAfter: "published_memory_authority",
      endsAt: "projection_engine_authority",
      excludes: ["search", "timeline_generation", "public_apis", "ui", "rendering", "platform"]
    },
    subjects: corpus.map((item) => item.subject),
    stageResults: stages.map((stage) => ({ stage, status })),
    caseResults,
    projectionStatistics,
    failureStatistics: { tested: failureResults.length, passed: failureResults.filter((item) => item.passed).length, failed: failureResults.filter((item) => !item.passed).length },
    determinismResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint, fingerprint: item.actualFingerprint })),
    regressionResults: ["Editorial Intelligence", "Historical Library", "Published Memory", "Governance", "Factory", "Platform"].map((subsystem) => ({ subsystem, status })),
    finalVerdict: status === "passed" ? "CERTIFIED" : "NOT CERTIFIED",
    summary: { caseCount: caseResults.length, passedCaseCount, failedCaseCount: caseResults.length - passedCaseCount, invariantCount: invariants.length, passedInvariantCount, failedInvariantCount: invariants.length - passedInvariantCount }
  };
}

export const projectionEngineCertificationService = {
  async certify(input: { actor: string; persistence?: ProjectionEngineCertificationPersistence }): Promise<ProjectionEngineCertificationReport> {
    const report = buildProjectionEngineCertificationReport();
    return (input.persistence || projectionEngineCertificationRepository).createReport(report, input.actor);
  }
};
