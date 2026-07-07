import type { SearchCertificationArea, SearchCertificationCase, SearchFailureInjectionKey } from "@/src/server/search-certification/contracts";

const areas: readonly SearchCertificationArea[] = [
  "projection_ingestion",
  "index_creation",
  "index_normalization",
  "entity_indexing",
  "timeline_indexing",
  "milestone_indexing",
  "chronology_indexing",
  "relationship_indexing",
  "canonical_indexing",
  "incremental_indexing",
  "full_rebuild",
  "replay",
  "recovery",
  "determinism",
  "completeness",
  "authority_continuity"
] as const;

const failures: readonly SearchFailureInjectionKey[] = [
  "missing_projection",
  "missing_published_memory_lineage",
  "missing_historical_library_lineage",
  "missing_governance_lineage",
  "missing_editorial_lineage",
  "missing_evidence_lineage",
  "duplicate_index",
  "duplicate_canonical_identity",
  "orphan_index",
  "broken_lineage",
  "invalid_authority_reference",
  "invalid_chronology",
  "invalid_entity",
  "invalid_relationship",
  "invalid_projection_reference",
  "corrupted_index",
  "truncated_index",
  "checksum_mismatch",
  "fingerprint_mismatch",
  "rebuild_mismatch",
  "incremental_rebuild_mismatch",
  "concurrent_indexing",
  "duplicate_replay",
  "cycle_creation",
  "invalid_preservation"
] as const;

function id(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(2, "0")}`;
}

function certificationCase(index: number, subject: string): SearchCertificationCase {
  return {
    caseId: id("sr-tier-a", index),
    subject,
    projectionId: id(`sr-${index}-search-projection`, 1),
    publishedSnapshotId: id(`sr-${index}-published-snapshot`, 1),
    historicalLibraryAuthorityId: id(`sr-${index}-library-authority`, 1),
    governanceDecisionId: id(`sr-${index}-governance-decision`, 1),
    editorialLineageId: id(`sr-${index}-editorial-lineage`, 1),
    evidenceLineageIds: [id(`sr-${index}-validated-evidence`, 1), id(`sr-${index}-validated-evidence`, 2)],
    searchAreas: areas,
    failureInjections: failures
  };
}

export const searchTierACorpus: readonly SearchCertificationCase[] = [
  certificationCase(1, "Roman Republic"),
  certificationCase(2, "Printing Press"),
  certificationCase(3, "Meiji Restoration"),
  certificationCase(4, "Internet")
] as const;
