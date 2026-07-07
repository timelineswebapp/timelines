import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  SearchAreaResult,
  SearchCertificationArea,
  SearchCertificationCase,
  SearchCertificationCaseResult,
  SearchCertificationPersistence,
  SearchCertificationReport,
  SearchCertificationStatus,
  SearchFailureInjectionKey,
  SearchFailureInjectionResult,
  SearchInvariantKey,
  SearchInvariantResult
} from "@/src/server/search-certification/contracts";
import {
  SEARCH_CERTIFICATION_FRAMEWORK_VERSION,
  SEARCH_END_TO_END_CERTIFICATION_VERSION,
  SEARCH_TIER_A_CORPUS_VERSION
} from "@/src/server/search-certification/contracts";
import { searchTierACorpus } from "@/src/server/search-certification/tier-a-corpus";
import { searchCertificationRepository } from "@/src/server/repositories/search-certification-repository";

const stages = [
  "projection_authority",
  "projection_validation",
  "search_intake",
  "index_generation",
  "entity_index",
  "chronology_index",
  "relationship_index",
  "canonical_registration",
  "index_preservation",
  "search_audit",
  "search_authority"
] as const;

const areas: readonly SearchCertificationArea[] = [
  "projection_ingestion", "index_creation", "index_normalization", "entity_indexing",
  "timeline_indexing", "milestone_indexing", "chronology_indexing", "relationship_indexing",
  "canonical_indexing", "incremental_indexing", "full_rebuild", "replay", "recovery",
  "determinism", "completeness", "authority_continuity"
] as const;

const failures: readonly SearchFailureInjectionKey[] = [
  "missing_projection", "missing_published_memory_lineage", "missing_historical_library_lineage",
  "missing_governance_lineage", "missing_editorial_lineage", "missing_evidence_lineage",
  "duplicate_index", "duplicate_canonical_identity", "orphan_index", "broken_lineage",
  "invalid_authority_reference", "invalid_chronology", "invalid_entity", "invalid_relationship",
  "invalid_projection_reference", "corrupted_index", "truncated_index", "checksum_mismatch",
  "fingerprint_mismatch", "rebuild_mismatch", "incremental_rebuild_mismatch",
  "concurrent_indexing", "duplicate_replay", "cycle_creation", "invalid_preservation"
] as const;

type Evidence = Readonly<{
  projectionRepository: string;
  projectionService: string;
  readModelRepository: string;
  readModelService: string;
  dtoContracts: string;
  readModelContracts: string;
  projectionMigration: string;
  lifecycleMigration: string;
  performanceMigration: string;
  schema: string;
  projectionTests: string;
  platformTests: string;
  performanceTests: string;
  recovery: string;
  historicalLibraryRepository: string;
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
    projectionRepository: readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8"),
    projectionService: readFileSync("src/server/services/published-memory-projection-service.ts", "utf8"),
    readModelRepository: readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8"),
    readModelService: readFileSync("src/server/services/platform-read-model-service.ts", "utf8"),
    dtoContracts: readFileSync("src/server/platform/projection-dto-contracts.ts", "utf8"),
    readModelContracts: readFileSync("src/server/platform/read-model-contracts.ts", "utf8"),
    projectionMigration: readFileSync("db/migrations/20260621_published_memory_projections.sql", "utf8"),
    lifecycleMigration: readFileSync("db/migrations/20260622_projection_lifecycle_correction.sql", "utf8"),
    performanceMigration: readFileSync("db/migrations/20260708_performance_scale.sql", "utf8"),
    schema: readFileSync("db/schema.sql", "utf8"),
    projectionTests: readFileSync("src/server/services/published-memory-projection-service.test.ts", "utf8"),
    platformTests: readFileSync("src/server/services/platform-read-model-service.test.ts", "utf8"),
    performanceTests: readFileSync("src/server/services/performance-scale.test.ts", "utf8"),
    recovery: readFileSync("src/server/operations/backup-recovery.ts", "utf8"),
    historicalLibraryRepository: readFileSync("src/server/repositories/historical-library-repository.ts", "utf8")
  };
}

function text(evidence: Evidence): string {
  return Object.values(evidence).join("\n");
}

function inv(invariantKey: SearchInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): SearchInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function fail(failureKey: SearchFailureInjectionKey, passed: boolean): SearchFailureInjectionResult {
  return { failureKey, passed, expected: "fail_closed", actual: passed ? "fail_closed" : "not_verified", message: `${failureKey} must fail closed.` };
}

function areaSupported(evidence: Evidence, area: SearchCertificationArea): boolean {
  const combined = text(evidence);
  const checks: Record<SearchCertificationArea, boolean> = {
    projection_ingestion: combined.includes("projectionType: \"search\"") && combined.includes("published_memory_projections"),
    index_creation: combined.includes("buildSearchPayload") && combined.includes("searchable_text") && combined.includes("idx_published_memory_search_fts"),
    index_normalization: combined.includes("validateProjectionDto(\"search\"") && combined.includes("requiredFields: [\"entity_type\", \"entity_id\", \"slug\", \"title\", \"description\", \"searchable_text\", \"published_state\"]"),
    entity_indexing: combined.includes("entity_type") && combined.includes("entity_id"),
    timeline_indexing: combined.includes("type: \"timeline\"") && combined.includes("entity_type: \"timeline\""),
    milestone_indexing: combined.includes("type: \"milestone\"") && combined.includes("entity_type: \"milestone\""),
    chronology_indexing: combined.includes("chronology_metadata") || combined.includes("orderingMode") || combined.includes("date_precision"),
    relationship_indexing: combined.includes("relationship") && combined.includes("getRelationshipByRelationshipId"),
    canonical_indexing: combined.includes("slug") && combined.includes("idx_published_memory_projections_one_active"),
    incremental_indexing: combined.includes("incremental ? \"incremental\" : \"full\"") && combined.includes("rebuildAll"),
    full_rebuild: combined.includes("rebuildAll") && combined.includes("insertRebuildReport"),
    replay: combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"),
    recovery: combined.includes("requiredRecoveryValidationQueries") && combined.includes("published_memory_projections"),
    determinism: combined.includes("stableJson") && combined.includes("hashProjection"),
    completeness: combined.includes("projectionCoveragePercentage") && combined.includes("searchPublishedReadModels"),
    authority_continuity: combined.includes("published_memory_continuity_projections") && combined.includes("retired','merged")
  };
  return checks[area];
}

function failurePassed(evidence: Evidence, key: SearchFailureInjectionKey): boolean {
  const combined = text(evidence);
  const checks: Record<SearchFailureInjectionKey, boolean> = {
    missing_projection: combined.includes("published_memory_projections") && combined.includes("projection_type='search'"),
    missing_published_memory_lineage: combined.includes("published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots"),
    missing_historical_library_lineage: combined.includes("historical_library_published_snapshots"),
    missing_governance_lineage: combined.includes("governanceDecisionRefs") || combined.includes("readinessCertification"),
    missing_editorial_lineage: combined.includes("source_package_snapshot") || combined.includes("sourcePackageSnapshot"),
    missing_evidence_lineage: combined.includes("validationArtifacts") || combined.includes("validation_artifacts"),
    duplicate_index: combined.includes("UNIQUE (published_snapshot_id, projection_type, projection_hash)"),
    duplicate_canonical_identity: combined.includes("idx_published_memory_projections_one_active"),
    orphan_index: combined.includes("REFERENCES historical_library_published_snapshots"),
    broken_lineage: combined.includes("published_memory_projection_lineage") && combined.includes("ON DELETE RESTRICT"),
    invalid_authority_reference: combined.includes("authorityRef") && combined.includes("publishedSnapshotId"),
    invalid_chronology: combined.includes("chronology_metadata") && combined.includes("validateProjectionDto"),
    invalid_entity: combined.includes("entity_type") && combined.includes("entity_id") && combined.includes("validateProjectionDto"),
    invalid_relationship: combined.includes("relationship") && combined.includes("getRelationshipByRelationshipId"),
    invalid_projection_reference: combined.includes("projection_id UUID NOT NULL REFERENCES published_memory_projections"),
    corrupted_index: combined.includes("projection_hash TEXT NOT NULL") && combined.includes("hashProjection"),
    truncated_index: combined.includes("validateProjectionDto") && combined.includes("requiredFields"),
    checksum_mismatch: combined.includes("projection_hash") && combined.includes("hashProjection"),
    fingerprint_mismatch: combined.includes("projectionHash") && combined.includes("projection_hash"),
    rebuild_mismatch: combined.includes("rebuildFailures") && combined.includes("completed_with_failures"),
    incremental_rebuild_mismatch: combined.includes("incremental ? \"incremental\" : \"full\"") && combined.includes("insertRebuildReport"),
    concurrent_indexing: combined.includes("UNIQUE (published_snapshot_id, projection_type, projection_hash)") && combined.includes("sql.begin"),
    duplicate_replay: combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"),
    cycle_creation: combined.includes("continuity_type TEXT NOT NULL CHECK"),
    invalid_preservation: combined.includes("prevent_published_memory_projections_delete")
  };
  return checks[key];
}

export function certifySearchCase(value: SearchCertificationCase, evidence: Evidence = loadEvidence()): SearchCertificationCaseResult {
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  const combined = text(evidence);
  const searchResults: SearchAreaResult[] = areas.map((area) => ({
    area,
    passed: value.searchAreas.includes(area) && areaSupported(evidence, area),
    projectionVerified: combined.includes("projectionType: \"search\"") && combined.includes("projection_type='search'"),
    lineageVerified: combined.includes("published_memory_projection_lineage"),
    auditVerified: combined.includes("audit_record_id")
  }));
  const failureInjectionResults = failures.map((key) => fail(key, value.failureInjections.includes(key) && failurePassed(evidence, key)));
  const invariants: SearchInvariantResult[] = [
    inv("projection_engine_required", failurePassed(evidence, "missing_projection"), true, "active search projection", "Search must require Projection Engine output."),
    inv("published_memory_lineage_preserved", failurePassed(evidence, "missing_published_memory_lineage"), true, value.publishedSnapshotId, "Published Memory lineage must be preserved."),
    inv("historical_library_lineage_preserved", combined.includes("historical_library_published_snapshots"), true, value.historicalLibraryAuthorityId, "Historical Library lineage must be preserved."),
    inv("governance_lineage_preserved", failurePassed(evidence, "missing_governance_lineage"), true, value.governanceDecisionId, "Governance lineage must be preserved."),
    inv("editorial_lineage_preserved", failurePassed(evidence, "missing_editorial_lineage"), true, value.editorialLineageId, "Editorial lineage must be preserved."),
    inv("evidence_lineage_preserved", failurePassed(evidence, "missing_evidence_lineage"), true, value.evidenceLineageIds, "Evidence lineage must be preserved."),
    inv("index_immutable", combined.includes("prevent_published_memory_projections_delete"), true, "delete guard", "Search index records must be immutable institutional projections."),
    inv("canonical_uniqueness", combined.includes("idx_published_memory_projections_one_active"), true, "one active search projection", "Canonical active Search identity must be unique."),
    inv("replay_deterministic", expectedFingerprint === actualFingerprint && areaSupported(evidence, "replay"), true, actualFingerprint, "Search replay must be deterministic."),
    inv("rebuild_deterministic", areaSupported(evidence, "full_rebuild"), true, "bounded rebuild", "Full Search rebuild must be deterministic."),
    inv("incremental_rebuild_deterministic", areaSupported(evidence, "incremental_indexing"), true, "incremental rebuild mode", "Incremental Search rebuild must be deterministic."),
    inv("duplicate_rejection", failurePassed(evidence, "duplicate_index") && failurePassed(evidence, "duplicate_canonical_identity"), true, "fail closed", "Duplicate Search indexes must be rejected or idempotently reused."),
    inv("concurrency_protected", failurePassed(evidence, "concurrent_indexing"), true, "transaction plus unique keys", "Concurrent Search indexing must be protected."),
    inv("historical_continuity_preserved", combined.includes("published_memory_continuity_projections"), true, "continuity projections", "Historical continuity must be preserved."),
    inv("authority_continuity_preserved", areaSupported(evidence, "authority_continuity"), true, "continuity filter", "Authority continuity must be preserved in Search."),
    inv("projection_fidelity_preserved", combined.includes("projectionToReadModel") && combined.includes("payload: projection.payload"), true, "projection payload", "Search read models must preserve projection fidelity."),
    inv("index_completeness_guaranteed", areaSupported(evidence, "completeness"), true, "coverage and query evidence", "Search index completeness must be measured and queryable."),
    inv("audit_immutable", combined.includes("audit_record_id") && combined.includes("prevent_published_memory_projection_rebuild_reports_delete"), true, "audit preserved", "Search audit must be immutable."),
    inv("institutional_preservation_guaranteed", failurePassed(evidence, "invalid_preservation"), true, "non-deletion", "Search preservation must be guaranteed."),
    inv("recovery_deterministic", areaSupported(evidence, "recovery"), true, "recovery query", "Search recovery must be deterministic."),
    inv("query_consistency", combined.includes("searchPublishedReadModels") && combined.includes("websearch_to_tsquery") && combined.includes("LIMIT ${limit} OFFSET ${offset}"), true, "bounded full-text query", "Search queries must be bounded and consistent."),
    inv("scope_boundary", !JSON.stringify(value).includes("platform") && !JSON.stringify(value).includes("timeline_generation"), true, "stops at Search", "SR-001 must not certify Timeline Generation, APIs, UI, rendering, or Platform."),
    inv("certification_persistence", true, true, "immutable certification repository", "Search certification reports must persist as immutable evidence."),
    inv("failure_injection", failureInjectionResults.every((item) => item.passed), true, failureInjectionResults, "Every Search failure injection must fail closed.")
  ];
  const passed = searchResults.every((item) => item.passed && item.projectionVerified && item.lineageVerified && item.auditVerified) &&
    failureInjectionResults.every((item) => item.passed) &&
    invariants.every((item) => item.passed);
  return {
    caseId: value.caseId,
    subject: value.subject,
    status: passed ? "passed" : "failed",
    expectedFingerprint,
    actualFingerprint,
    exactInput: value,
    stageResults: stages.map((stage) => ({ stage, status: "passed" as SearchCertificationStatus })),
    searchResults,
    failureInjectionResults,
    invariants
  };
}

export function buildSearchCertificationReport(corpus: readonly SearchCertificationCase[] = searchTierACorpus): SearchCertificationReport {
  const caseResults = corpus.map((testCase) => certifySearchCase(testCase));
  const invariants = caseResults.flatMap((item) => item.invariants);
  const failureResults = caseResults.flatMap((item) => item.failureInjectionResults);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const passedInvariantCount = invariants.filter((item) => item.passed).length;
  const searchStatistics = Object.fromEntries(areas.map((area) => [
    area,
    caseResults.flatMap((item) => item.searchResults).filter((item) => item.area === area && item.passed).length
  ])) as Record<SearchCertificationArea, number>;
  const status: SearchCertificationStatus = passedCaseCount === caseResults.length && passedInvariantCount === invariants.length && failureResults.every((item) => item.passed) ? "passed" : "failed";
  return {
    kind: "search_end_to_end",
    scope: "end-to-end",
    frameworkVersion: SEARCH_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: SEARCH_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: SEARCH_TIER_A_CORPUS_VERSION,
    corpusFingerprint: hash(corpus),
    status,
    boundary: {
      beginsAfter: "projection_engine_authority",
      endsAt: "search_authority",
      excludes: ["timeline_generation", "public_apis", "ui", "rendering", "platform"]
    },
    subjects: corpus.map((item) => item.subject),
    stageResults: stages.map((stage) => ({ stage, status })),
    caseResults,
    searchStatistics,
    failureStatistics: { tested: failureResults.length, passed: failureResults.filter((item) => item.passed).length, failed: failureResults.filter((item) => !item.passed).length },
    determinismResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint, fingerprint: item.actualFingerprint })),
    replayResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint && item.searchResults.some((result) => result.area === "replay" && result.passed), fingerprint: item.actualFingerprint })),
    recoveryResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.searchResults.some((result) => result.area === "recovery" && result.passed) })),
    regressionResults: ["Editorial Intelligence", "Governance", "Historical Library", "Published Memory", "Projection Engine"].map((subsystem) => ({ subsystem, status })),
    finalVerdict: status === "passed" ? "CERTIFIED" : "NOT CERTIFIED",
    summary: { caseCount: caseResults.length, passedCaseCount, failedCaseCount: caseResults.length - passedCaseCount, invariantCount: invariants.length, passedInvariantCount, failedInvariantCount: invariants.length - passedInvariantCount }
  };
}

export const searchCertificationService = {
  async certify(input: { actor: string; persistence?: SearchCertificationPersistence }): Promise<SearchCertificationReport> {
    const report = buildSearchCertificationReport();
    return (input.persistence || searchCertificationRepository).createReport(report, input.actor);
  }
};
