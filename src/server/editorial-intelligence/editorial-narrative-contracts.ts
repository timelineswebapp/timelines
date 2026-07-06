import type { EditorialPromptReference } from "@/src/server/editorial-intelligence/editorial-prompt-contracts";
import type { EditorialProviderProvenance } from "@/src/server/editorial-intelligence/editorial-provider-provenance";
import type { EditorialWritingPolicy } from "@/src/server/editorial-intelligence/editorial-writing-policy-contracts";

export const EDITORIAL_NARRATIVE_CONTRACT_VERSION = "ei-004-narrative-v1" as const;

export type NarrativeSentence = Readonly<{
  sentenceId: string;
  sequence: number;
  text: string;
  milestoneIds: readonly string[];
  claimIds: readonly string[];
  chronologyRefs: readonly string[];
}>;

export type NarrativeParagraph = Readonly<{
  paragraphId: string;
  sequence: number;
  milestoneIds: readonly string[];
  sentences: readonly NarrativeSentence[];
}>;

export type NarrativeSection = Readonly<{
  sectionId: string;
  sequence: number;
  sectionType: "introduction" | "phase" | "conclusion";
  compositionRef: string;
  paragraphs: readonly NarrativeParagraph[];
}>;

export type NarrativeTransition = Readonly<{
  transitionId: string;
  sequence: number;
  compositionTransitionRef: string;
  paragraph: NarrativeParagraph;
}>;

export type NarrativeCitationReference = Readonly<{
  citationReferenceId: string;
  sentenceIds: readonly string[];
  evidenceRecordIds: readonly string[];
  sourceRecordId: string;
  sourceSnapshotId: string;
}>;

export type NarrativeClaimMapEntry = Readonly<{
  sentenceId: string;
  claimIds: readonly string[];
  evidenceRecordIds: readonly string[];
  milestoneIds: readonly string[];
}>;

export type NarrativeClaimMap = Readonly<{
  entries: readonly NarrativeClaimMapEntry[];
}>;

export type NarrativeGenerationMetrics = Readonly<{
  sectionCount: number;
  paragraphCount: number;
  sentenceCount: number;
  wordCount: number;
  coveredMilestoneCount: number;
  citedEvidenceCount: number;
}>;

export type NarrativeTextUnit = Readonly<{
  text: string;
  claimIds: readonly string[];
  milestoneIds: readonly string[];
}>;

export type EditorialNarrative = Readonly<{
  contractVersion: typeof EDITORIAL_NARRATIVE_CONTRACT_VERSION;
  narrativeId: string;
  factoryObjectId: string | null;
  canonicalSubject: string;
  locale: string;
  editorialCompositionId: string;
  editorialCompositionFingerprint: string;
  editorialTimelineCandidateId: string;
  editorialTimelineCandidateFingerprint: string;
  editorialEvidenceSetId: string;
  prompts: readonly EditorialPromptReference[];
  writingPolicy: EditorialWritingPolicy;
  providerProvenance: EditorialProviderProvenance;
  writerInputFingerprint: string;
  narrativeOutputFingerprint: string;
  title: NarrativeTextUnit;
  subtitle: NarrativeTextUnit | null;
  introduction: NarrativeSection;
  phases: readonly NarrativeSection[];
  transitions: readonly NarrativeTransition[];
  conclusion: NarrativeSection;
  sections: readonly NarrativeSection[];
  citations: readonly NarrativeCitationReference[];
  narrativeClaimMap: NarrativeClaimMap;
  generationMetrics: NarrativeGenerationMetrics;
  generationMetadata: Readonly<{
    factoryOwned: true;
    authorityDecision: false;
    publicationReadinessDecision: false;
    generatedText: true;
  }>;
}>;
