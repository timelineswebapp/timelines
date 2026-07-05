import type { EvidenceValidationProvenance } from "@/src/server/evidence-validation/contracts";
import type { EvidenceRecord } from "@/src/server/research-corpus/contracts";

export const EDITORIAL_FOUNDATION_ALGORITHM_VERSION = "ei-001-v1" as const;

export type EditorialEvidenceSubject = Readonly<{
  evidence: EvidenceRecord;
  validationRecordId: string;
  validation: EvidenceValidationProvenance;
  sourceTitle: string;
  sourceAuthorityScore: number;
}>;

export type EditorialScore = Readonly<{
  historicalSignificance: number;
  chronologicalImportance: number;
  narrativeContribution: number;
  coverageContribution: number;
  novelty: number;
  redundancy: number;
  sourceDiversity: number;
  evidenceStrength: number;
  subjectCentrality: number;
  total: number;
}>;

export type RankedEditorialEvidence = Readonly<{
  rank: number;
  evidenceRecordId: string;
  validationRecordId: string;
  duplicateOfEvidenceRecordId: string | null;
  chronologyYears: readonly number[];
  score: EditorialScore;
}>;

export type EditorialEvidenceSet = Readonly<{
  editorialEvidenceSetId?: string;
  topic: string;
  algorithmVersion: typeof EDITORIAL_FOUNDATION_ALGORITHM_VERSION;
  inputFingerprint: string;
  rankedEvidence: readonly RankedEditorialEvidence[];
  coverageAnalysis: {
    uniqueEvidenceCount: number;
    duplicateEvidenceCount: number;
    uniqueSourceCount: number;
    sourceDiversityScore: number;
    chronologyEvidenceRatio: number;
  };
  timelineCoverage: {
    earliestYear: number | null;
    latestYear: number | null;
    representedYears: readonly number[];
    gaps: readonly { afterYear: number; beforeYear: number; spanYears: number }[];
    balanceScore: number;
  };
  identifiedTurningPoints: readonly { evidenceRecordId: string; year: number | null; score: number }[];
  canonicalSubject: { label: string; confidence: number; supportingEvidenceRecordIds: readonly string[] };
  canonicalHistoricalObject: { label: string; supportingEvidenceRecordIds: readonly string[] };
  candidateMilestonesRanked: readonly {
    rank: number;
    evidenceRecordId: string;
    year: number | null;
    importanceScore: number;
  }[];
  editorialMetadata: {
    authorityDecision: false;
    publicationReadinessDecision: false;
    compilerOutput: false;
    evidenceRecordCount: number;
    scoringScale: "integer_0_100";
  };
}>;

