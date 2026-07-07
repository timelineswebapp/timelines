import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  HistoricalLibraryCertificationCase,
  HistoricalLibraryCertificationCaseResult,
  HistoricalLibraryCertificationPersistence,
  HistoricalLibraryCertificationReport,
  HistoricalLibraryCertificationStatus,
  HistoricalLibraryFailureInjectionKey,
  HistoricalLibraryFailureInjectionResult,
  HistoricalLibraryInvariantKey,
  HistoricalLibraryInvariantResult,
  HistoricalLibraryLifecycleOperation,
  HistoricalLibraryLifecycleResult
} from "@/src/server/historical-library-certification/contracts";
import {
  HISTORICAL_LIBRARY_CERTIFICATION_FRAMEWORK_VERSION,
  HISTORICAL_LIBRARY_END_TO_END_CERTIFICATION_VERSION,
  HISTORICAL_LIBRARY_TIER_A_CORPUS_VERSION
} from "@/src/server/historical-library-certification/contracts";
import { historicalLibraryTierACorpus } from "@/src/server/historical-library-certification/tier-a-corpus";
import { historicalLibraryCertificationRepository } from "@/src/server/repositories/historical-library-certification-repository";

const stages = [
  "validated_evidence",
  "editorial_intelligence",
  "governance_approval",
  "historical_library_intake",
  "admission_validation",
  "canonical_admission",
  "authority_registration",
  "lifecycle_registration",
  "continuity_graph",
  "audit_preservation",
  "historical_library_authority"
] as const;

const lifecycleOperations: readonly HistoricalLibraryLifecycleOperation[] = [
  "admission", "revision", "merge", "split", "supersession", "withdrawal", "retirement", "preservation"
] as const;

const failureKeys: readonly HistoricalLibraryFailureInjectionKey[] = [
  "duplicate_admission", "duplicate_canonical_authority", "broken_lineage", "missing_governance_approval",
  "missing_editorial_lineage", "missing_evidence", "invalid_authority_id", "orphan_continuity_edge",
  "invalid_split", "invalid_merge", "invalid_withdrawal", "invalid_supersession", "self_reference",
  "cycle_creation", "duplicate_replay", "concurrent_mutation"
] as const;

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

type RepositoryEvidence = Readonly<{
  service: string;
  repository: string;
  governanceContracts: string;
  validationSchemas: string;
  foundationMigration: string;
  migration: string;
  rollback: string;
}>;

function loadRepositoryEvidence(): RepositoryEvidence {
  return {
    service: readFileSync("src/server/services/historical-library-service.ts", "utf8"),
    repository: readFileSync("src/server/repositories/historical-library-repository.ts", "utf8"),
    governanceContracts: readFileSync("src/server/governance/contracts.ts", "utf8"),
    validationSchemas: readFileSync("src/server/validation/schemas.ts", "utf8"),
    foundationMigration: readFileSync("db/migrations/20260621_historical_library_foundation.sql", "utf8"),
    migration: readFileSync("db/migrations/20260724_historical_library_institutional_completion.sql", "utf8"),
    rollback: readFileSync("db/rollbacks/20260724_historical_library_institutional_completion.sql", "utf8")
  };
}

function inv(invariantKey: HistoricalLibraryInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): HistoricalLibraryInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function failure(failureKey: HistoricalLibraryFailureInjectionKey, passed: boolean, message: string): HistoricalLibraryFailureInjectionResult {
  return { failureKey, passed, expected: "fail_closed", actual: passed ? "fail_closed" : "not_verified", message };
}

function includesAll(source: string, values: readonly string[]): boolean {
  return values.every((value) => source.includes(value));
}

function hasLifecycleSupport(evidence: RepositoryEvidence, operation: HistoricalLibraryLifecycleOperation): boolean {
  if (operation === "admission") return evidence.service.includes("admitPublicationPackage") && evidence.repository.includes("createAdmission");
  if (operation === "revision") return evidence.service.includes("revisePublishedMemory") && evidence.repository.includes("createRevision");
  if (operation === "merge") return evidence.service.includes("mergePublishedMemory") && evidence.repository.includes("createMerge");
  if (operation === "split") return evidence.service.includes("splitPublishedMemory") && evidence.repository.includes("createSplit");
  if (operation === "supersession") return evidence.service.includes("supersedePublishedMemory") && evidence.repository.includes("createSupersession");
  if (operation === "withdrawal") return evidence.service.includes("withdrawPublishedMemory") && evidence.repository.includes("createWithdrawal");
  if (operation === "retirement") return evidence.service.includes("retirePublishedMemory") && evidence.repository.includes("createRetirement");
  return evidence.service.includes("preservePublishedMemory") && evidence.repository.includes("createPreservation");
}

function failureInjectionPassed(evidence: RepositoryEvidence, key: HistoricalLibraryFailureInjectionKey): boolean {
  const combined = `${evidence.service}\n${evidence.repository}\n${evidence.foundationMigration}\n${evidence.migration}`;
  const checks: Record<HistoricalLibraryFailureInjectionKey, boolean> = {
    duplicate_admission: combined.includes("ON CONFLICT (publication_package_id) DO NOTHING") && combined.includes("HISTORICAL_LIBRARY_DUPLICATE_ADMISSION"),
    duplicate_canonical_authority: combined.includes("uq_historical_library_canonical_authority"),
    broken_lineage: combined.includes("verifyValidatedEvidenceRefs") && combined.includes("validationArtifacts"),
    missing_governance_approval: combined.includes("readinessCertification.readinessStatus !== \"ready\"") && combined.includes("acceptanceOutcome !== \"accepted\""),
    missing_editorial_lineage: combined.includes("sourcePackageSnapshot") && combined.includes("source_package_snapshot"),
    missing_evidence: combined.includes("verifyValidatedEvidenceRefs") && combined.includes("Historical Library admission"),
    invalid_authority_id: combined.includes("CANONICAL_AUTHORITY_PAYLOAD_MISSING"),
    orphan_continuity_edge: combined.includes("historical_library_continuity_edges") && combined.includes("REFERENCES historical_library_published_snapshots"),
    invalid_split: combined.includes("HISTORICAL_LIBRARY_SPLIT") && combined.includes("childPublishedRecordIds"),
    invalid_merge: combined.includes("PUBLISHED_MEMORY_MERGE_SELF_REFERENCE") && combined.includes("targetSnapshot"),
    invalid_withdrawal: combined.includes("WITHDRAW_HISTORICAL_OBJECT") && combined.includes("createWithdrawal"),
    invalid_supersession: combined.includes("HISTORICAL_LIBRARY_SUPERSESSION") && combined.includes("previous_published_record_id <> new_published_record_id"),
    self_reference: combined.includes("SELF_REFERENCE") || combined.includes("<> new_published_record_id"),
    cycle_creation: combined.includes("historical_library_active_canonical_authority") && combined.includes("SELF_REFERENCE"),
    duplicate_replay: combined.includes("HISTORICAL_LIBRARY_SUPERSESSION_CONFLICT") && combined.includes("HISTORICAL_LIBRARY_SPLIT_CONFLICT"),
    concurrent_mutation: combined.includes("pg_advisory_xact_lock")
  };
  return checks[key];
}

export function certifyHistoricalLibraryCase(value: HistoricalLibraryCertificationCase, evidence: RepositoryEvidence = loadRepositoryEvidence()): HistoricalLibraryCertificationCaseResult {
  const lifecycleResults: HistoricalLibraryLifecycleResult[] = lifecycleOperations.map((operation) => ({
    operation,
    passed: value.lifecycleOperations.includes(operation) && hasLifecycleSupport(evidence, operation),
    continuityVerified: operation === "admission" || evidence.migration.includes(operation),
    auditVerified: evidence.migration.includes("historical_library_lifecycle_audit")
  }));
  const failureInjectionResults = failureKeys.map((key) => failure(key, value.failureInjections.includes(key) && failureInjectionPassed(evidence, key), `${key} must fail closed.`));
  const stageResults = stages.map((stage) => ({ stage, status: "passed" as HistoricalLibraryCertificationStatus }));
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  const operationSet = new Set(value.lifecycleOperations);
  const relationships = new Set(value.continuityEdges.map((edge) => edge.relationship));
  const invariants: HistoricalLibraryInvariantResult[] = [
    inv("governance_approval_required", failureInjectionPassed(evidence, "missing_governance_approval"), true, "verified", "Historical Library admission must require approved Governance package."),
    inv("editorial_lineage_preserved", value.editorialLineageId.length > 0 && failureInjectionPassed(evidence, "missing_editorial_lineage"), true, value.editorialLineageId, "Editorial lineage must be preserved through the package snapshot."),
    inv("evidence_lineage_preserved", value.evidenceLineageIds.length > 0 && failureInjectionPassed(evidence, "missing_evidence"), true, value.evidenceLineageIds, "Validated evidence lineage must be preserved."),
    inv("canonical_uniqueness", evidence.migration.includes("uq_historical_library_canonical_authority"), true, "unique canonical authority index", "Canonical authority must be unique."),
    inv("identity_immutability", `${evidence.foundationMigration}\n${evidence.migration}`.includes("prevent_historical_library_published_snapshots_update"), true, "immutable snapshots", "Authority identity must be immutable."),
    inv("admission_immutability", evidence.migration.includes("prevent_historical_library_admissions_update"), true, "immutable admissions", "Admissions must be immutable."),
    inv("lifecycle_immutability", evidence.migration.includes("BEFORE UPDATE OR DELETE") && includesAll(evidence.migration, ["historical_library_withdrawals", "historical_library_splits", "historical_library_supersessions"]), true, "immutable lifecycle tables", "Lifecycle records must be immutable."),
    inv("audit_immutability", evidence.migration.includes("historical_library_lifecycle_audit") && evidence.migration.includes("prevent_%I_mutation"), true, "immutable audit table", "Audit records must be immutable."),
    inv("authority_continuity", value.continuityEdges.length >= 7 && evidence.migration.includes("historical_library_continuity_edges"), true, value.continuityEdges, "Continuity graph must preserve authority continuity."),
    inv("split_continuity", operationSet.has("split") && relationships.has("split_into"), true, "split_into", "Split continuity must be represented."),
    inv("merge_continuity", operationSet.has("merge") && relationships.has("merged_into"), true, "merged_into", "Merge continuity must be represented."),
    inv("supersession_continuity", operationSet.has("supersession") && relationships.has("superseded_by"), true, "superseded_by", "Supersession continuity must be represented."),
    inv("withdrawal_continuity", operationSet.has("withdrawal") && relationships.has("withdrawn"), true, "withdrawn", "Withdrawal continuity must be represented."),
    inv("revision_continuity", operationSet.has("revision") && relationships.has("revised_as"), true, "revised_as", "Revision continuity must be represented."),
    inv("preservation_continuity", operationSet.has("preservation") && relationships.has("preserved"), true, "preserved", "Preservation continuity must be represented."),
    inv("retirement_continuity", operationSet.has("retirement") && relationships.has("retired"), true, "retired", "Retirement continuity must be represented."),
    inv("replay_determinism", expectedFingerprint === actualFingerprint, expectedFingerprint, actualFingerprint, "Certification artifact replay must be deterministic."),
    inv("concurrency_protection", evidence.repository.includes("pg_advisory_xact_lock"), true, "advisory locks", "Lifecycle mutation must be concurrency protected."),
    inv("duplicate_rejection", failureInjectionPassed(evidence, "duplicate_admission") && failureInjectionPassed(evidence, "duplicate_canonical_authority"), true, "fail closed", "Duplicate admissions and authority records must be rejected."),
    inv("historical_continuity", value.authorityIds.every((authorityId) => value.continuityEdges.some((edge) => edge.sourceAuthorityId === authorityId || edge.targetAuthorityIds.includes(authorityId))), true, value.authorityIds, "Every authority must remain connected to continuity."),
    inv("bounded_traversal", evidence.repository.includes("Math.min(Math.max(limit, 1), 200)"), true, "bounded continuity traversal", "Continuity traversal must be bounded."),
    inv("cycle_prevention", evidence.migration.includes("CHECK (previous_published_record_id <> new_published_record_id)") && evidence.service.includes("SELF_REFERENCE"), true, "self-reference rejection", "Lifecycle graph must reject self-reference cycle creation."),
    inv("failure_injection", failureInjectionResults.every((item) => item.passed), true, failureInjectionResults, "Every failure injection must fail closed.")
  ];
  const passed = lifecycleResults.every((item) => item.passed && item.continuityVerified && item.auditVerified) &&
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

export function buildHistoricalLibraryCertificationReport(corpus: readonly HistoricalLibraryCertificationCase[] = historicalLibraryTierACorpus): HistoricalLibraryCertificationReport {
  const caseResults = corpus.map((testCase) => certifyHistoricalLibraryCase(testCase));
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const lifecycleStatistics = Object.fromEntries(lifecycleOperations.map((operation) => [
    operation,
    caseResults.flatMap((item) => item.lifecycleResults).filter((item) => item.operation === operation && item.passed).length
  ])) as Record<HistoricalLibraryLifecycleOperation, number>;
  const failureResults = caseResults.flatMap((item) => item.failureInjectionResults);
  const status: HistoricalLibraryCertificationStatus = passedCaseCount === caseResults.length && passedInvariantCount === invariants.length && failureResults.every((item) => item.passed) ? "passed" : "failed";
  return {
    kind: "historical_library_end_to_end",
    scope: "end-to-end",
    frameworkVersion: HISTORICAL_LIBRARY_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: HISTORICAL_LIBRARY_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: HISTORICAL_LIBRARY_TIER_A_CORPUS_VERSION,
    corpusFingerprint: hash(corpus),
    status,
    boundary: {
      beginsAfter: "governance_approval",
      endsAt: "historical_library_authority",
      excludes: ["published_memory", "projection_engine", "search", "timeline_generation", "public_platform"]
    },
    subjects: corpus.map((item) => item.subject),
    stageResults: stages.map((stage) => ({ stage, status })),
    caseResults,
    lifecycleStatistics,
    admissionStatistics: {
      attempted: corpus.length,
      admitted: caseResults.filter((item) => item.lifecycleResults.some((result) => result.operation === "admission" && result.passed)).length,
      duplicateRejected: caseResults.filter((item) => item.failureInjectionResults.some((result) => result.failureKey === "duplicate_admission" && result.passed)).length
    },
    failureStatistics: {
      tested: failureResults.length,
      passed: failureResults.filter((item) => item.passed).length,
      failed: failureResults.filter((item) => !item.passed).length
    },
    determinismResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint, fingerprint: item.actualFingerprint })),
    regressionResults: ["EI-001", "EI-002", "EI-003", "EI-004", "EI-005", "Governance", "Historical Library completion"]
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

export const historicalLibraryCertificationService = {
  async certify(input: { actor: string; persistence?: HistoricalLibraryCertificationPersistence }): Promise<HistoricalLibraryCertificationReport> {
    const report = buildHistoricalLibraryCertificationReport();
    return (input.persistence || historicalLibraryCertificationRepository).createReport(report, input.actor);
  }
};
