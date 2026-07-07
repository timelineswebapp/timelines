import type { ProjectionEngineArea, ProjectionEngineCertificationCase, ProjectionEngineFailureInjectionKey } from "@/src/server/projection-engine-certification/contracts";

const areas: readonly ProjectionEngineArea[] = [
  "projection_creation",
  "projection_rebuild",
  "projection_replay",
  "projection_replacement",
  "projection_preservation",
  "projection_recovery",
  "projection_determinism",
  "projection_idempotency",
  "projection_completeness",
  "projection_authority_continuity"
] as const;

const failures: readonly ProjectionEngineFailureInjectionKey[] = [
  "missing_published_memory_authority",
  "broken_lineage",
  "missing_historical_library_lineage",
  "missing_governance_lineage",
  "missing_editorial_lineage",
  "missing_evidence_lineage",
  "duplicate_projection",
  "duplicate_canonical_projection",
  "projection_corruption",
  "projection_truncation",
  "invalid_chronology",
  "invalid_ordering",
  "missing_required_fields",
  "invalid_authority_reference",
  "orphan_projection",
  "projection_cycle",
  "projection_replay_conflict",
  "concurrent_projection_generation",
  "projection_rebuild_mismatch",
  "projection_checksum_mismatch",
  "projection_fingerprint_mismatch"
] as const;

function id(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(2, "0")}`;
}

function certificationCase(index: number, subject: string): ProjectionEngineCertificationCase {
  return {
    caseId: id("pr-tier-a", index),
    subject,
    publishedSnapshotId: id(`pr-${index}-published-snapshot`, 1),
    admissionId: id(`pr-${index}-admission`, 1),
    governanceDecisionId: id(`pr-${index}-governance-decision`, 1),
    editorialLineageId: id(`pr-${index}-editorial-lineage`, 1),
    evidenceLineageIds: [id(`pr-${index}-validated-evidence`, 1), id(`pr-${index}-validated-evidence`, 2)],
    projectionTypes: ["timeline", "milestone", "historical_object", "relationship", "search", "sitemap"],
    projectionAreas: areas,
    failureInjections: failures
  };
}

export const projectionEngineTierACorpus: readonly ProjectionEngineCertificationCase[] = [
  certificationCase(1, "Roman Republic"),
  certificationCase(2, "Printing Press"),
  certificationCase(3, "Meiji Restoration"),
  certificationCase(4, "Internet")
] as const;
