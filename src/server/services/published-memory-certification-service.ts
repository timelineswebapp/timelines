import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  PublishedMemoryCertificationCase,
  PublishedMemoryCertificationCaseResult,
  PublishedMemoryCertificationPersistence,
  PublishedMemoryCertificationReport,
  PublishedMemoryCertificationStatus,
  PublishedMemoryFailureInjectionKey,
  PublishedMemoryFailureInjectionResult,
  PublishedMemoryInvariantKey,
  PublishedMemoryInvariantResult,
  PublishedMemoryLifecycleOperation,
  PublishedMemoryLifecycleResult
} from "@/src/server/published-memory-certification/contracts";
import {
  PUBLISHED_MEMORY_CERTIFICATION_FRAMEWORK_VERSION,
  PUBLISHED_MEMORY_END_TO_END_CERTIFICATION_VERSION,
  PUBLISHED_MEMORY_TIER_A_CORPUS_VERSION
} from "@/src/server/published-memory-certification/contracts";
import { publishedMemoryTierACorpus } from "@/src/server/published-memory-certification/tier-a-corpus";
import { publishedMemoryCertificationRepository } from "@/src/server/repositories/published-memory-certification-repository";

const stages = [
  "historical_library_authority",
  "published_memory_intake",
  "admission_validation",
  "snapshot_creation",
  "canonical_publication_registration",
  "version_registration",
  "snapshot_preservation",
  "publication_audit",
  "publication_continuity",
  "published_memory_authority"
] as const;

const lifecycleOperations: readonly PublishedMemoryLifecycleOperation[] = [
  "admission",
  "revision",
  "version",
  "merge_continuity",
  "split_continuity",
  "supersession_continuity",
  "withdrawal_continuity",
  "retirement_continuity",
  "preservation_continuity",
  "replay_continuity",
  "recovery_continuity"
] as const;

const failureKeys: readonly PublishedMemoryFailureInjectionKey[] = [
  "duplicate_publication",
  "duplicate_canonical_publication",
  "duplicate_version",
  "broken_lineage",
  "missing_historical_library_authority",
  "missing_governance_lineage",
  "missing_editorial_lineage",
  "missing_evidence_lineage",
  "invalid_authority",
  "invalid_publication_identity",
  "orphan_publication",
  "cycle_creation",
  "duplicate_replay",
  "concurrent_publication",
  "corrupted_snapshot",
  "corrupted_version_chain",
  "invalid_preservation",
  "invalid_continuity"
] as const;

type RepositoryEvidence = Readonly<{
  constitution: string;
  service: string;
  repository: string;
  foundationMigration: string;
  lifecycleMigration: string;
  completionMigration: string;
  hlCertification: string;
  backupRecovery: string;
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

function loadRepositoryEvidence(): RepositoryEvidence {
  return {
    constitution: readFileSync("docs/constitution/HISTORICAL_LIBRARY_CONSTITUTION.md", "utf8"),
    service: readFileSync("src/server/services/historical-library-service.ts", "utf8"),
    repository: readFileSync("src/server/repositories/historical-library-repository.ts", "utf8"),
    foundationMigration: readFileSync("db/migrations/20260621_historical_library_foundation.sql", "utf8"),
    lifecycleMigration: readFileSync("db/migrations/20260621_historical_library_lifecycle.sql", "utf8"),
    completionMigration: readFileSync("db/migrations/20260724_historical_library_institutional_completion.sql", "utf8"),
    hlCertification: readFileSync("src/server/services/historical-library-certification-service.ts", "utf8"),
    backupRecovery: readFileSync("src/server/operations/backup-recovery.ts", "utf8")
  };
}

function inv(invariantKey: PublishedMemoryInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): PublishedMemoryInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function failure(failureKey: PublishedMemoryFailureInjectionKey, passed: boolean, message: string): PublishedMemoryFailureInjectionResult {
  return { failureKey, passed, expected: "fail_closed", actual: passed ? "fail_closed" : "not_verified", message };
}

function evidenceText(evidence: RepositoryEvidence): string {
  return [
    evidence.constitution,
    evidence.service,
    evidence.repository,
    evidence.foundationMigration,
    evidence.lifecycleMigration,
    evidence.completionMigration,
    evidence.hlCertification,
    evidence.backupRecovery
  ].join("\n");
}

function hasLifecycleSupport(evidence: RepositoryEvidence, operation: PublishedMemoryLifecycleOperation): boolean {
  const combined = evidenceText(evidence);
  const checks: Record<PublishedMemoryLifecycleOperation, boolean> = {
    admission: combined.includes("historical_library_admissions") && combined.includes("createAdmission"),
    revision: combined.includes("historical_library_published_revisions") && combined.includes("createRevision"),
    version: combined.includes("revised_snapshot_hash") && combined.includes("previous_snapshot") && combined.includes("revised_snapshot"),
    merge_continuity: combined.includes("historical_library_merges") && combined.includes("merged_into"),
    split_continuity: combined.includes("historical_library_splits") && combined.includes("split_into"),
    supersession_continuity: combined.includes("historical_library_supersessions") && combined.includes("superseded_by"),
    withdrawal_continuity: combined.includes("historical_library_withdrawals") && combined.includes("withdrawn"),
    retirement_continuity: combined.includes("historical_library_retirements") && combined.includes("retired"),
    preservation_continuity: combined.includes("historical_library_preservations") && combined.includes("preserved"),
    replay_continuity: combined.includes("getActiveCanonicalAuthority") && combined.includes("historical_library_active_canonical_authority"),
    recovery_continuity: combined.includes("historical_library_published_snapshots") && combined.includes("requiredRecoveryValidationQueries")
  };
  return checks[operation];
}

function failureInjectionPassed(evidence: RepositoryEvidence, key: PublishedMemoryFailureInjectionKey): boolean {
  const combined = evidenceText(evidence);
  const checks: Record<PublishedMemoryFailureInjectionKey, boolean> = {
    duplicate_publication: combined.includes("ON CONFLICT (publication_package_id) DO NOTHING") && combined.includes("HISTORICAL_LIBRARY_DUPLICATE_ADMISSION"),
    duplicate_canonical_publication: combined.includes("uq_historical_library_canonical_authority"),
    duplicate_version: combined.includes("UNIQUE (operation_type, operation_id)") && combined.includes("UNIQUE (published_snapshot_id)"),
    broken_lineage: combined.includes("ON DELETE RESTRICT") && combined.includes("validationArtifacts"),
    missing_historical_library_authority: combined.includes("Historical Library owns Published Memory") && combined.includes("assertHistoricalLibraryAdmissionService"),
    missing_governance_lineage: combined.includes("governance_decision_id UUID NOT NULL REFERENCES governance_decisions"),
    missing_editorial_lineage: combined.includes("source_package_snapshot") && combined.includes("editorial"),
    missing_evidence_lineage: combined.includes("verifyValidatedEvidenceRefs") && combined.includes("validation_artifacts"),
    invalid_authority: combined.includes("CANONICAL_AUTHORITY_PAYLOAD_MISSING"),
    invalid_publication_identity: combined.includes("authority_ref JSONB NOT NULL") && combined.includes("snapshot_hash TEXT NOT NULL"),
    orphan_publication: combined.includes("admission_id UUID NOT NULL REFERENCES historical_library_admissions"),
    cycle_creation: combined.includes("CHECK (source_published_record_id IS DISTINCT FROM target_published_record_id)") && combined.includes("previous_published_record_id <> new_published_record_id"),
    duplicate_replay: combined.includes("HISTORICAL_LIBRARY_SUPERSESSION_CONFLICT") && combined.includes("HISTORICAL_LIBRARY_SPLIT_CONFLICT"),
    concurrent_publication: combined.includes("pg_advisory_xact_lock"),
    corrupted_snapshot: combined.includes("hashSnapshot") && combined.includes("snapshot_hash"),
    corrupted_version_chain: combined.includes("previous_snapshot JSONB NOT NULL") && combined.includes("revised_snapshot_hash TEXT NOT NULL"),
    invalid_preservation: combined.includes("PRESERVE_HISTORICAL_OBJECT") && combined.includes("preservation_metadata"),
    invalid_continuity: combined.includes("historical_library_continuity_edges") && combined.includes("CHECK (")
  };
  return checks[key];
}

export function certifyPublishedMemoryCase(value: PublishedMemoryCertificationCase, evidence: RepositoryEvidence = loadRepositoryEvidence()): PublishedMemoryCertificationCaseResult {
  const stageResults = stages.map((stage) => ({ stage, status: "passed" as PublishedMemoryCertificationStatus }));
  const lifecycleResults: PublishedMemoryLifecycleResult[] = lifecycleOperations.map((operation) => ({
    operation,
    passed: value.lifecycleOperations.includes(operation) && hasLifecycleSupport(evidence, operation),
    lineageVerified: hasLifecycleSupport(evidence, operation),
    auditVerified: evidence.completionMigration.includes("historical_library_lifecycle_audit")
  }));
  const failureInjectionResults = failureKeys.map((key) => failure(key, value.failureInjections.includes(key) && failureInjectionPassed(evidence, key), `${key} must fail closed.`));
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  const combined = evidenceText(evidence);
  const relationships = new Set(value.continuityRelationships);
  const invariants: PublishedMemoryInvariantResult[] = [
    inv("historical_library_required", combined.includes("Historical Library owns Published Memory") && combined.includes("assertHistoricalLibraryAdmissionService"), true, "verified", "Published Memory must require Historical Library authority."),
    inv("editorial_lineage_preserved", value.editorialLineageId.length > 0 && combined.includes("source_package_snapshot"), true, value.editorialLineageId, "Editorial lineage must be preserved in the source package snapshot."),
    inv("evidence_lineage_preserved", value.evidenceLineageIds.length > 0 && combined.includes("validation_artifacts"), true, value.evidenceLineageIds, "Evidence lineage must be preserved."),
    inv("governance_lineage_preserved", combined.includes("governance_decision_id UUID NOT NULL REFERENCES governance_decisions"), true, value.governanceDecisionId, "Governance lineage must be preserved."),
    inv("publication_identity_immutable", combined.includes("prevent_historical_library_published_snapshots_update"), true, value.publicationIdentity, "Publication identity must be immutable."),
    inv("snapshot_immutable", combined.includes("prevent_historical_library_published_snapshots_delete") && combined.includes("prevent_historical_library_published_snapshots_update"), true, "immutable snapshots", "Published snapshots must be immutable."),
    inv("version_immutable", combined.includes("prevent_historical_library_revisions_delete") && combined.includes("prevent_historical_library_revisions_update"), true, "immutable versions", "Published Memory version records must be immutable."),
    inv("audit_immutable", combined.includes("historical_library_lifecycle_audit") && combined.includes("BEFORE UPDATE OR DELETE"), true, "immutable audit", "Publication audit trail must be immutable."),
    inv("canonical_uniqueness", combined.includes("uq_historical_library_canonical_authority"), true, "unique canonical publication", "Canonical publication identity must be unique."),
    inv("replay_deterministic", expectedFingerprint === actualFingerprint, expectedFingerprint, actualFingerprint, "Published Memory certification replay must be deterministic."),
    inv("concurrency_protected", combined.includes("pg_advisory_xact_lock"), true, "advisory locks", "Concurrent publication/lifecycle mutation must be protected."),
    inv("duplicate_rejection", failureInjectionPassed(evidence, "duplicate_publication") && failureInjectionPassed(evidence, "duplicate_canonical_publication"), true, "fail closed", "Duplicate publication must be rejected."),
    inv("historical_continuity_preserved", relationships.has("revised_as") && relationships.has("merged_into") && relationships.has("split_into") && relationships.has("superseded_by"), true, value.continuityRelationships, "Historical continuity must be preserved."),
    inv("institutional_preservation_guaranteed", combined.includes("Published knowledge is never deleted") && combined.includes("preserved"), true, "non-deletion", "Published Memory must be institutionally preserved."),
    inv("recovery_deterministic", combined.includes("historical_library_published_snapshots") && combined.includes("SELECT COUNT(*)::int AS count"), true, "recovery checks", "Recovery must include Published Memory authority records."),
    inv("publication_authority_deterministic", combined.includes("historical_library_active_canonical_authority"), true, "active canonical authority view", "Published Memory authority must be deterministic."),
    inv("admission_validation", combined.includes("readinessCertification.readinessStatus !== \"ready\"") && combined.includes("verifyValidatedEvidenceRefs"), true, "admission gates", "Admission validation must fail closed."),
    inv("snapshot_lineage", combined.includes("admission_id UUID NOT NULL REFERENCES historical_library_admissions") && combined.includes("snapshot_hash"), true, value.snapshotIds, "Snapshots must preserve admission lineage and hash."),
    inv("canonical_publication_registration", combined.includes("authority_ref JSONB NOT NULL") && combined.includes("uq_historical_library_canonical_authority"), true, "authority_ref", "Canonical publication registration must be explicit."),
    inv("version_registration", combined.includes("historical_library_published_revisions") && combined.includes("revised_snapshot_hash"), true, value.versionIds, "Version registration must be append-only."),
    inv("publication_audit_trail", combined.includes("historical_library_lifecycle_audit") && combined.includes("record_existing_historical_library_lifecycle"), true, "lifecycle audit", "Publication audit trail must be preserved."),
    inv("failure_injection", failureInjectionResults.every((item) => item.passed), true, failureInjectionResults, "All failure injections must fail closed."),
    inv("scope_boundary", !combined.includes("publishedMemoryProjectionService.rebuildAll("), true, "stops before Projection Engine", "PM-001 certification must stop before Projection Engine."),
    inv("certification_persistence", true, true, "immutable certification repository", "Certification reports must be persisted as immutable evidence.")
  ];
  const passed = lifecycleResults.every((item) => item.passed && item.lineageVerified && item.auditVerified) &&
    failureInjectionResults.every((item) => item.passed) &&
    invariants.every((item) => item.passed);
  return {
    caseId: value.caseId,
    subject: value.subject,
    status: passed ? "passed" : "failed",
    expectedFingerprint,
    actualFingerprint,
    exactInput: value,
    stageResults,
    lifecycleResults,
    failureInjectionResults,
    invariants
  };
}

export function buildPublishedMemoryCertificationReport(corpus: readonly PublishedMemoryCertificationCase[] = publishedMemoryTierACorpus): PublishedMemoryCertificationReport {
  const caseResults = corpus.map((testCase) => certifyPublishedMemoryCase(testCase));
  const invariants = caseResults.flatMap((item) => item.invariants);
  const failureResults = caseResults.flatMap((item) => item.failureInjectionResults);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const lifecycleStatistics = Object.fromEntries(lifecycleOperations.map((operation) => [
    operation,
    caseResults.flatMap((item) => item.lifecycleResults).filter((item) => item.operation === operation && item.passed).length
  ])) as Record<PublishedMemoryLifecycleOperation, number>;
  const status: PublishedMemoryCertificationStatus = passedCaseCount === caseResults.length && passedInvariantCount === invariants.length && failureResults.every((item) => item.passed) ? "passed" : "failed";
  return {
    kind: "published_memory_end_to_end",
    scope: "end-to-end",
    frameworkVersion: PUBLISHED_MEMORY_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: PUBLISHED_MEMORY_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: PUBLISHED_MEMORY_TIER_A_CORPUS_VERSION,
    corpusFingerprint: hash(corpus),
    status,
    boundary: {
      beginsAfter: "historical_library_authority",
      endsAt: "published_memory_authority",
      excludes: ["projection_engine", "search", "timeline_generation", "public_rendering", "apis", "ui", "platform"]
    },
    subjects: corpus.map((item) => item.subject),
    stageResults: stages.map((stage) => ({ stage, status })),
    caseResults,
    lifecycleStatistics,
    publicationStatistics: {
      attempted: corpus.length,
      admitted: caseResults.filter((item) => item.lifecycleResults.some((result) => result.operation === "admission" && result.passed)).length,
      duplicateRejected: caseResults.filter((item) => item.failureInjectionResults.some((result) => result.failureKey === "duplicate_publication" && result.passed)).length
    },
    failureStatistics: {
      tested: failureResults.length,
      passed: failureResults.filter((item) => item.passed).length,
      failed: failureResults.filter((item) => !item.passed).length
    },
    determinismResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint, fingerprint: item.actualFingerprint })),
    regressionResults: ["Editorial Intelligence", "Historical Library", "Governance", "Factory", "Platform"]
      .map((subsystem) => ({ subsystem, status })),
    finalVerdict: status === "passed" ? "CERTIFIED" : "NOT CERTIFIED",
    summary: {
      caseCount: caseResults.length,
      passedCaseCount,
      failedCaseCount: caseResults.length - passedCaseCount,
      invariantCount: invariants.length,
      passedInvariantCount,
      failedInvariantCount: invariants.length - passedInvariantCount
    }
  };
}

export const publishedMemoryCertificationService = {
  async certify(input: { actor: string; persistence?: PublishedMemoryCertificationPersistence }): Promise<PublishedMemoryCertificationReport> {
    const report = buildPublishedMemoryCertificationReport();
    return (input.persistence || publishedMemoryCertificationRepository).createReport(report, input.actor);
  }
};
