import type { PlatformCertificationCase, PlatformFailureInjectionKey } from "@/src/server/platform-certification/contracts";

export const platformFailureInjectionKeys: readonly PlatformFailureInjectionKey[] = [
  "missing_authority", "broken_lineage", "missing_projections", "invalid_platform_read_model",
  "broken_routing", "missing_slug", "duplicate_slug", "duplicate_canonical_url",
  "invalid_metadata", "invalid_schema_org", "broken_api_serialization", "projection_corruption",
  "authority_mismatch", "orphan_projection", "orphan_search_entry", "broken_rendering",
  "stale_projection", "cache_inconsistency", "missing_timeline", "missing_milestone",
  "missing_event", "cross_authority_contamination", "canonical_mismatch", "invalid_replay",
  "invalid_rebuild", "concurrent_publication", "duplicate_publication", "duplicate_rendering",
  "invalid_recovery", "partial_rebuild", "projection_checksum_mismatch", "platform_replay_mismatch"
] as const;

function id(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(2, "0")}`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function certificationCase(index: number, subject: string): PlatformCertificationCase {
  const timelineSlug = slug(subject);
  return {
    caseId: id("pl-tier-a", index),
    subject,
    evidenceLineageId: id(`pl-${index}-validated-evidence`, 1),
    editorialLineageId: id(`pl-${index}-editorial-lineage`, 1),
    governanceDecisionId: id(`pl-${index}-governance-decision`, 1),
    historicalLibraryAuthorityId: id(`pl-${index}-library-authority`, 1),
    publishedMemorySnapshotId: id(`pl-${index}-published-snapshot`, 1),
    projectionId: id(`pl-${index}-timeline-projection`, 1),
    searchProjectionId: id(`pl-${index}-search-projection`, 1),
    timelineSlug,
    canonicalUrl: `/timeline/${timelineSlug}`,
    failureInjections: platformFailureInjectionKeys
  };
}

export const platformTierACorpus: readonly PlatformCertificationCase[] = [
  certificationCase(1, "Roman Republic"),
  certificationCase(2, "Printing Press"),
  certificationCase(3, "Meiji Restoration"),
  certificationCase(4, "Internet")
] as const;
