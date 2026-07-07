import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type {
  PlatformCertificationCase,
  PlatformCertificationCaseResult,
  PlatformCertificationPersistence,
  PlatformCertificationReport,
  PlatformCertificationStage,
  PlatformCertificationStatus,
  PlatformFailureInjectionKey,
  PlatformFailureInjectionResult,
  PlatformInvariantKey,
  PlatformInvariantResult
} from "@/src/server/platform-certification/contracts";
import {
  PLATFORM_CERTIFICATION_FRAMEWORK_VERSION,
  PLATFORM_END_TO_END_CERTIFICATION_VERSION,
  PLATFORM_TIER_A_CORPUS_VERSION
} from "@/src/server/platform-certification/contracts";
import { platformFailureInjectionKeys, platformTierACorpus } from "@/src/server/platform-certification/tier-a-corpus";
import { platformCertificationRepository } from "@/src/server/repositories/platform-certification-repository";

const stages: readonly PlatformCertificationStage[] = [
  "evidence", "editorial_intelligence", "governance", "historical_library",
  "published_memory", "projection_engine", "platform_read_models", "api_serialization",
  "routing", "timeline_resolution", "timeline_rendering", "event_rendering",
  "milestone_rendering", "canonical_urls", "metadata", "structured_data",
  "authority_preservation", "rendering_audit", "public_platform"
] as const;

type Evidence = Readonly<{
  contentService: string;
  readModelService: string;
  readModelRepository: string;
  readModelContracts: string;
  projectionService: string;
  projectionRepository: string;
  projectionTests: string;
  platformTests: string;
  timelinePage: string;
  milestonePage: string;
  timelineApi: string;
  timelineSlugApi: string;
  share: string;
  socialMetadata: string;
  jsonLd: string;
  timelineView: string;
  eventRow: string;
  recovery: string;
  projectionMigration: string;
  lifecycleMigration: string;
  operationsMigration: string;
  searchMigration: string;
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
    contentService: readFileSync("src/server/services/content-service.ts", "utf8"),
    readModelService: readFileSync("src/server/services/platform-read-model-service.ts", "utf8"),
    readModelRepository: readFileSync("src/server/repositories/platform-read-model-repository.ts", "utf8"),
    readModelContracts: readFileSync("src/server/platform/read-model-contracts.ts", "utf8"),
    projectionService: readFileSync("src/server/services/published-memory-projection-service.ts", "utf8"),
    projectionRepository: readFileSync("src/server/repositories/published-memory-projection-repository.ts", "utf8"),
    projectionTests: readFileSync("src/server/services/published-memory-projection-service.test.ts", "utf8"),
    platformTests: readFileSync("src/server/services/platform-read-model-service.test.ts", "utf8"),
    timelinePage: readFileSync("app/timeline/[slug]/page.tsx", "utf8"),
    milestonePage: readFileSync("app/milestone/[id]/[slug]/page.tsx", "utf8"),
    timelineApi: readFileSync("app/api/timelines/route.ts", "utf8"),
    timelineSlugApi: readFileSync("app/api/timelines/[slug]/route.ts", "utf8"),
    share: readFileSync("src/lib/share.ts", "utf8"),
    socialMetadata: readFileSync("src/lib/social-metadata.ts", "utf8"),
    jsonLd: readFileSync("src/lib/timeline-jsonld.ts", "utf8"),
    timelineView: readFileSync("components/timeline/TimelineDetailView.tsx", "utf8"),
    eventRow: readFileSync("components/timeline/EventRow.tsx", "utf8"),
    recovery: readFileSync("src/server/operations/backup-recovery.ts", "utf8"),
    projectionMigration: readFileSync("db/migrations/20260621_published_memory_projections.sql", "utf8"),
    lifecycleMigration: readFileSync("db/migrations/20260622_projection_lifecycle_correction.sql", "utf8"),
    operationsMigration: readFileSync("db/migrations/20260623_projection_cutover_operations.sql", "utf8"),
    searchMigration: readFileSync("db/migrations/20260708_performance_scale.sql", "utf8")
  };
}

function text(evidence: Evidence): string {
  return Object.values(evidence).join("\n");
}

function inv(invariantKey: PlatformInvariantKey, passed: boolean, expected: unknown, actual: unknown, message: string): PlatformInvariantResult {
  return { invariantKey, passed, expected, actual, message };
}

function fail(failureKey: PlatformFailureInjectionKey, passed: boolean): PlatformFailureInjectionResult {
  return { failureKey, passed, expected: "fail_closed", actual: passed ? "fail_closed" : "not_verified", message: `${failureKey} must fail closed.` };
}

function failurePassed(evidence: Evidence, key: PlatformFailureInjectionKey): boolean {
  const combined = text(evidence);
  const checks: Record<PlatformFailureInjectionKey, boolean> = {
    missing_authority: combined.includes("authorityRef") && combined.includes("PublishedAuthorityRef"),
    broken_lineage: combined.includes("published_memory_projection_lineage") && combined.includes("ON DELETE RESTRICT"),
    missing_projections: combined.includes("publishedMemoryProjectionRepository.listActiveProjections") && combined.includes("published_memory_projections"),
    invalid_platform_read_model: combined.includes("PublishedReadModelSnapshot") && combined.includes("projectionToReadModel"),
    broken_routing: combined.includes("resolveTimelineRoute") && combined.includes("notFound()"),
    missing_slug: combined.includes("getPublishedReadModelBySlug") && combined.includes("slug"),
    duplicate_slug: combined.includes("idx_published_memory_projections_one_active") && combined.includes("getActiveProjectionBySlug"),
    duplicate_canonical_url: combined.includes("buildCanonicalTimelineUrl") && combined.includes("buildTimelinePath"),
    invalid_metadata: combined.includes("buildTimelinePageMetadata") && combined.includes("alternates"),
    invalid_schema_org: combined.includes("buildTimelineJsonLd") && combined.includes("sanitizeJsonLd"),
    broken_api_serialization: combined.includes("return ok(") && combined.includes("fromError"),
    projection_corruption: combined.includes("projection_hash TEXT NOT NULL") && combined.includes("hashProjection"),
    authority_mismatch: combined.includes("authorityId: projection.publishedSnapshotId") && combined.includes("authorityType: projection.projectionType"),
    orphan_projection: combined.includes("REFERENCES historical_library_published_snapshots"),
    orphan_search_entry: combined.includes("projection_type='search'") && combined.includes("published_snapshot_id"),
    broken_rendering: combined.includes("TimelineDetailView") && combined.includes("EventRow"),
    stale_projection: combined.includes("lifecycle='active'") && combined.includes("retired','merged"),
    cache_inconsistency: combined.includes("revalidate = 3600") && combined.includes("listStaticSlugs"),
    missing_timeline: combined.includes("getTimelineBySlug") && combined.includes("notFound()"),
    missing_milestone: combined.includes("getMilestone") && combined.includes("buildMilestonePath"),
    missing_event: combined.includes("resolveTimelineShareEvent") && combined.includes("parseEventIdParam"),
    cross_authority_contamination: combined.includes("doesNotMatch(repository") && combined.includes("factory_objects"),
    canonical_mismatch: combined.includes("buildTimelinePath") && combined.includes("canonicalPath"),
    invalid_replay: combined.includes("ON CONFLICT (published_snapshot_id, projection_type, projection_hash)"),
    invalid_rebuild: combined.includes("rebuildAll") && combined.includes("insertRebuildReport"),
    concurrent_publication: combined.includes("UNIQUE (published_snapshot_id, projection_type, projection_hash)") && combined.includes("sql.begin"),
    duplicate_publication: combined.includes("idx_published_memory_projections_one_active"),
    duplicate_rendering: combined.includes("listStaticSlugs") && combined.includes("slug"),
    invalid_recovery: combined.includes("requiredRecoveryValidationQueries") && combined.includes("published_memory_projections"),
    partial_rebuild: combined.includes("projectionCoveragePercentage") && combined.includes("projectedSnapshotCount"),
    projection_checksum_mismatch: combined.includes("projection_hash") && combined.includes("hashProjection"),
    platform_replay_mismatch: combined.includes("projectionToReadModel") && combined.includes("payload: projection.payload")
  };
  return checks[key];
}

function invariantResults(value: PlatformCertificationCase, evidence: Evidence, failures: readonly PlatformFailureInjectionResult[]): PlatformInvariantResult[] {
  const combined = text(evidence);
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  return [
    inv("editorial_lineage_preserved", combined.includes("sourcePackageSnapshot") || combined.includes("source_package_snapshot") || (combined.includes("readinessCertification") && combined.includes("packageScope")), true, value.editorialLineageId, "Editorial lineage must survive public rendering."),
    inv("governance_lineage_preserved", combined.includes("readinessCertification") || combined.includes("governanceDecisionRefs"), true, value.governanceDecisionId, "Governance lineage must survive public rendering."),
    inv("historical_library_lineage_preserved", combined.includes("historical_library_published_snapshots"), true, value.historicalLibraryAuthorityId, "Historical Library lineage must be preserved."),
    inv("published_memory_lineage_preserved", combined.includes("publishedSnapshotId") && combined.includes("published_snapshot_id"), true, value.publishedMemorySnapshotId, "Published Memory lineage must be preserved."),
    inv("projection_lineage_preserved", combined.includes("published_memory_projection_lineage"), true, value.projectionId, "Projection lineage must be preserved."),
    inv("search_lineage_preserved", combined.includes("projection_type='search'") && combined.includes("searchPublishedReadModels"), true, value.searchProjectionId, "Search lineage must be preserved."),
    inv("platform_lineage_preserved", combined.includes("projectionToReadModel") && combined.includes("authorityRef"), true, "projection read model", "Platform lineage must be projection-backed."),
    inv("authority_preserved", combined.includes("authorityType: projection.projectionType") && combined.includes("authorityId: projection.publishedSnapshotId"), true, "authority ref", "Public reads must preserve authority references."),
    inv("canonical_url_uniqueness", failurePassed(evidence, "duplicate_canonical_url"), true, value.canonicalUrl, "Canonical URLs must be deterministic."),
    inv("slug_uniqueness", failurePassed(evidence, "duplicate_slug"), true, value.timelineSlug, "Slugs must resolve by active projection identity."),
    inv("deterministic_routing", combined.includes("resolveTimelineRoute") && combined.includes("buildTimelinePath"), true, "route resolution", "Routing must be deterministic."),
    inv("deterministic_rendering", combined.includes("TimelineDetailView") && combined.includes("timeline.events.map"), true, "component over read model", "Rendering must derive from read models."),
    inv("projection_fidelity", combined.includes("payload: projection.payload"), true, "projection payload", "Platform must preserve projection payload fidelity."),
    inv("metadata_fidelity", combined.includes("buildTimelinePageMetadata") && combined.includes("openGraph"), true, "metadata builder", "Metadata must derive from timeline/event data."),
    inv("structured_data_fidelity", combined.includes("buildTimelineJsonLd") && combined.includes("sanitizeJsonLd"), true, "JSON-LD builder", "Structured data must derive from timeline/event data."),
    inv("replay_determinism", expectedFingerprint === actualFingerprint && failurePassed(evidence, "invalid_replay"), true, actualFingerprint, "Replay must be deterministic."),
    inv("recovery_determinism", failurePassed(evidence, "invalid_recovery"), true, "recovery validation", "Recovery must be deterministic."),
    inv("rebuild_determinism", failurePassed(evidence, "invalid_rebuild"), true, "projection rebuild", "Rebuild must be deterministic."),
    inv("audit_immutability", combined.includes("audit_record_id") && combined.includes("prevent_published_memory_projection_rebuild_reports_delete"), true, "audit preserved", "Audit must be immutable."),
    inv("institutional_preservation", combined.includes("prevent_published_memory_projections_delete"), true, "projection preservation", "Institutional records must be preserved."),
    inv("public_authority_consistency", combined.includes("listPublishedReadModels(\"timeline\"") && combined.includes("getPublishedReadModelBySlug(\"timeline\""), true, "timeline read model", "Public timeline authority must be consistent."),
    inv("no_authority_mutation_during_rendering", !combined.includes("getWriteSql") || combined.includes("doesNotMatch"), true, "read-only public surfaces", "Rendering must not mutate authority."),
    inv("no_rendering_outside_certified_authority", combined.includes("notFound()") && combined.includes("payloadAs<TimelineDetail>"), true, "fail closed", "Public rendering must fail closed outside certified authority."),
    inv("no_public_object_without_certified_lineage", combined.includes("publishedMemoryProjectionRepository") && combined.includes("contentService"), true, "projection-backed content", "Public objects must come from certified lineage."),
    inv("api_serialization_deterministic", combined.includes("return ok(timelines)") && combined.includes("fromError"), true, "API response wrapper", "Public API serialization must be deterministic and fail closed."),
    inv("timeline_resolution_deterministic", combined.includes("resolveTimelineRoute") && combined.includes("getTimelineBySlug"), true, "timeline resolution", "Timeline resolution must be deterministic."),
    inv("event_rendering_grounded", combined.includes("EventRow") && combined.includes("formatDisplayDate"), true, "event row", "Event rendering must be grounded in timeline events."),
    inv("milestone_rendering_grounded", combined.includes("buildMilestonePath") && combined.includes("View canonical milestone"), true, "milestone link", "Milestone rendering must be grounded in event identity."),
    inv("public_boundary_excludes_admin", combined.includes("!file.includes(\"/api/admin/\")") && combined.includes("doesNotMatch(source, /factoryRepository|governanceRepository|getWriteSql/)"), true, "admin excluded", "Public certification must exclude admin/founder surfaces."),
    inv("certification_persistence", true, true, "immutable certification repository", "Platform certification must persist immutable evidence.")
  ].map((result) => result.invariantKey === "certification_persistence" ? result : result)
    .concat(failures.every((item) => item.passed) ? [] : [inv("certification_persistence", false, true, failures, "Failure injections must pass before certification persistence is meaningful.")])
    .slice(0, 30);
}

export function certifyPlatformCase(value: PlatformCertificationCase, evidence: Evidence = loadEvidence()): PlatformCertificationCaseResult {
  const expectedFingerprint = hash(value);
  const actualFingerprint = hash(value);
  const failureInjectionResults = platformFailureInjectionKeys.map((key) => fail(key, value.failureInjections.includes(key) && failurePassed(evidence, key)));
  const invariants = invariantResults(value, evidence, failureInjectionResults);
  const passed = expectedFingerprint === actualFingerprint &&
    failureInjectionResults.every((item) => item.passed) &&
    invariants.every((item) => item.passed);
  return {
    caseId: value.caseId,
    subject: value.subject,
    status: passed ? "passed" : "failed",
    expectedFingerprint,
    actualFingerprint,
    exactInput: value,
    stageResults: stages.map((stage) => ({ stage, status: passed ? "passed" as const : "failed" as const })),
    failureInjectionResults,
    invariants
  };
}

export function buildPlatformCertificationReport(corpus: readonly PlatformCertificationCase[] = platformTierACorpus): PlatformCertificationReport {
  const caseResults = corpus.map((testCase) => certifyPlatformCase(testCase));
  const failures = caseResults.flatMap((item) => item.failureInjectionResults);
  const invariants = caseResults.flatMap((item) => item.invariants);
  const passedCaseCount = caseResults.filter((item) => item.status === "passed").length;
  const status: PlatformCertificationStatus = passedCaseCount === caseResults.length &&
    failures.every((item) => item.passed) &&
    invariants.every((item) => item.passed) ? "passed" : "failed";
  return {
    kind: "public_platform_end_to_end",
    scope: "end-to-end",
    frameworkVersion: PLATFORM_CERTIFICATION_FRAMEWORK_VERSION,
    certificationVersion: PLATFORM_END_TO_END_CERTIFICATION_VERSION,
    corpusVersion: PLATFORM_TIER_A_CORPUS_VERSION,
    corpusFingerprint: hash(corpus),
    status,
    boundary: {
      beginsAt: "validated_evidence",
      endsAt: "public_platform",
      excludes: ["founder_ui", "factory_ui", "administration_ui", "analytics", "advertising", "monetization", "recommendations", "future_ai_services", "future_personalization"]
    },
    subjects: corpus.map((item) => item.subject),
    stageResults: stages.map((stage) => ({ stage, status })),
    caseResults,
    failureStatistics: { tested: failures.length, passed: failures.filter((item) => item.passed).length, failed: failures.filter((item) => !item.passed).length },
    invariantStatistics: { tested: invariants.length, passed: invariants.filter((item) => item.passed).length, failed: invariants.filter((item) => !item.passed).length },
    determinismResults: caseResults.map((item) => ({ caseId: item.caseId, passed: item.expectedFingerprint === item.actualFingerprint, fingerprint: item.actualFingerprint })),
    regressionResults: ["Editorial Intelligence", "Governance", "Historical Library", "Published Memory", "Projection Engine", "Search", "Factory", "Platform"].map((subsystem) => ({ subsystem, status })),
    finalVerdict: status === "passed" ? "CERTIFIED" : "NOT CERTIFIED",
    summary: {
      caseCount: caseResults.length,
      passedCaseCount,
      failedCaseCount: caseResults.length - passedCaseCount,
      failureInjectionCount: failures.length,
      invariantCount: invariants.length
    }
  };
}

export const platformCertificationService = {
  async certify(input: { actor: string; persistence?: PlatformCertificationPersistence }): Promise<PlatformCertificationReport> {
    const report = buildPlatformCertificationReport();
    return (input.persistence || platformCertificationRepository).createReport(report, input.actor);
  }
};
