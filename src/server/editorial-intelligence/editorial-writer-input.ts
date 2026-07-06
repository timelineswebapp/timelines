import type { EditorialComposition } from "@/src/server/editorial-intelligence/editorial-composition-contracts";
import type { EditorialPromptReference } from "@/src/server/editorial-intelligence/editorial-prompt-contracts";
import type { EditorialProviderProvenance } from "@/src/server/editorial-intelligence/editorial-provider-provenance";
import type { EditorialTimelineCandidate, EditorialTimelineChronology } from "@/src/server/editorial-intelligence/timeline-compiler-contracts";
import type { EditorialEvidenceSet } from "@/src/server/editorial-intelligence/contracts";
import type { EditorialWritingPolicy } from "@/src/server/editorial-intelligence/editorial-writing-policy-contracts";
import type { EvidenceValidationRecord } from "@/src/server/evidence-validation/contracts";
import type { EvidenceRecord } from "@/src/server/research-corpus/contracts";
import type { SourceAuthoritySnapshot } from "@/src/server/source-authority/contracts";

export const EDITORIAL_WRITER_INPUT_VERSION = "ei-004-writer-input-v1" as const;

export type EditorialWriterMilestone = Readonly<{
  milestoneId: string;
  sequence: number;
  chronology: EditorialTimelineChronology;
  evidenceRecordIds: readonly string[];
}>;

export type EditorialWriterValidatedEvidence = Readonly<{
  evidence: EvidenceRecord;
  validation: EvidenceValidationRecord;
}>;

export type EditorialNarrativeWriterInput = Readonly<{
  version: typeof EDITORIAL_WRITER_INPUT_VERSION;
  locale: string;
  canonicalSubject: string;
  editorialCompositionId: string;
  composition: EditorialComposition;
  timelineCandidate: EditorialTimelineCandidate;
  editorialEvidenceSet: EditorialEvidenceSet;
  selectedMilestones: readonly EditorialWriterMilestone[];
  validatedEvidence: readonly EditorialWriterValidatedEvidence[];
  sourceSnapshots: readonly SourceAuthoritySnapshot[];
  prompts: readonly EditorialPromptReference[];
  writingPolicy: EditorialWritingPolicy;
  providerProvenance: EditorialProviderProvenance;
  writerInputFingerprint: string;
}>;

export type BuildEditorialNarrativeWriterInput = Readonly<{
  locale: string;
  editorialCompositionId: string;
  composition: EditorialComposition;
  timelineCandidate: EditorialTimelineCandidate;
  editorialEvidenceSet: EditorialEvidenceSet;
  validatedEvidence: readonly EditorialWriterValidatedEvidence[];
  sourceSnapshots: readonly SourceAuthoritySnapshot[];
  prompts: readonly EditorialPromptReference[];
  writingPolicy: EditorialWritingPolicy;
  providerProvenance: EditorialProviderProvenance;
}>;
