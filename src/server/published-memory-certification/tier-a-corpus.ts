import type { PublishedMemoryCertificationCase, PublishedMemoryFailureInjectionKey, PublishedMemoryLifecycleOperation } from "@/src/server/published-memory-certification/contracts";

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

const failureInjections: readonly PublishedMemoryFailureInjectionKey[] = [
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

function id(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(2, "0")}`;
}

function certificationCase(index: number, subject: string): PublishedMemoryCertificationCase {
  return {
    caseId: id("pm-tier-a", index),
    subject,
    historicalLibraryAuthorityId: id(`pm-${index}-library-authority`, 1),
    governanceDecisionId: id(`pm-${index}-governance-decision`, 1),
    governancePackageId: id(`pm-${index}-governance-package`, 1),
    editorialLineageId: id(`pm-${index}-editorial-lineage`, 1),
    evidenceLineageIds: [id(`pm-${index}-validated-evidence`, 1), id(`pm-${index}-validated-evidence`, 2)],
    publicationIdentity: id(`pm-${index}-publication-identity`, 1),
    snapshotIds: [id(`pm-${index}-snapshot`, 1), id(`pm-${index}-snapshot`, 2), id(`pm-${index}-snapshot`, 3)],
    versionIds: [id(`pm-${index}-version`, 1), id(`pm-${index}-version`, 2)],
    lifecycleOperations,
    continuityRelationships: [
      "revised_as",
      "merged_into",
      "split_into",
      "superseded_by",
      "withdrawn",
      "retired",
      "preserved"
    ],
    failureInjections
  };
}

export const publishedMemoryTierACorpus: readonly PublishedMemoryCertificationCase[] = [
  certificationCase(1, "Roman Republic"),
  certificationCase(2, "Printing Press"),
  certificationCase(3, "Meiji Restoration"),
  certificationCase(4, "Internet")
] as const;
