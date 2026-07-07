import type { HistoricalLibraryCertificationCase, HistoricalLibraryFailureInjectionKey, HistoricalLibraryLifecycleOperation } from "@/src/server/historical-library-certification/contracts";

const failures: readonly HistoricalLibraryFailureInjectionKey[] = [
  "duplicate_admission",
  "duplicate_canonical_authority",
  "broken_lineage",
  "missing_governance_approval",
  "missing_editorial_lineage",
  "missing_evidence",
  "invalid_authority_id",
  "orphan_continuity_edge",
  "invalid_split",
  "invalid_merge",
  "invalid_withdrawal",
  "invalid_supersession",
  "self_reference",
  "cycle_creation",
  "duplicate_replay",
  "concurrent_mutation"
] as const;

const lifecycle: readonly HistoricalLibraryLifecycleOperation[] = [
  "admission",
  "revision",
  "merge",
  "split",
  "supersession",
  "withdrawal",
  "retirement",
  "preservation"
] as const;

function id(prefix: string, index: number): string {
  return `${prefix}-${index.toString().padStart(2, "0")}`;
}

function certificationCase(index: number, subject: string): HistoricalLibraryCertificationCase {
  const root = id(`hl-${index}-authority`, 1);
  const revised = id(`hl-${index}-authority`, 2);
  const merged = id(`hl-${index}-authority`, 3);
  const splitA = id(`hl-${index}-authority`, 4);
  const splitB = id(`hl-${index}-authority`, 5);
  const superseded = id(`hl-${index}-authority`, 6);
  return {
    caseId: id("hl-tier-a", index),
    subject,
    governancePackageId: id(`hl-${index}-governance-package`, 1),
    governanceDecisionId: id(`hl-${index}-governance-decision`, 1),
    editorialLineageId: id(`hl-${index}-editorial-lineage`, 1),
    evidenceLineageIds: [id(`hl-${index}-validated-evidence`, 1), id(`hl-${index}-validated-evidence`, 2)],
    authorityIds: [root, revised, merged, splitA, splitB, superseded],
    lifecycleOperations: lifecycle,
    continuityEdges: [
      { operation: "revision", sourceAuthorityId: root, targetAuthorityIds: [revised], relationship: "revised_as" },
      { operation: "merge", sourceAuthorityId: revised, targetAuthorityIds: [merged], relationship: "merged_into" },
      { operation: "split", sourceAuthorityId: merged, targetAuthorityIds: [splitA, splitB], relationship: "split_into" },
      { operation: "supersession", sourceAuthorityId: splitA, targetAuthorityIds: [superseded], relationship: "superseded_by" },
      { operation: "withdrawal", sourceAuthorityId: splitB, targetAuthorityIds: [], relationship: "withdrawn" },
      { operation: "retirement", sourceAuthorityId: superseded, targetAuthorityIds: [], relationship: "retired" },
      { operation: "preservation", sourceAuthorityId: root, targetAuthorityIds: [], relationship: "preserved" }
    ],
    failureInjections: failures
  };
}

export const historicalLibraryTierACorpus: readonly HistoricalLibraryCertificationCase[] = [
  certificationCase(1, "Roman Republic"),
  certificationCase(2, "Printing Press"),
  certificationCase(3, "Meiji Restoration"),
  certificationCase(4, "Internet")
] as const;
