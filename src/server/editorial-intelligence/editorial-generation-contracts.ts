import type { NarrativeParagraph, NarrativeSection, NarrativeTextUnit } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";

export type GenerationUnitKind = "title" | "subtitle" | "introduction" | "phase" | "conclusion";

export type GenerationUnit = Readonly<{
  unitId: string;
  kind: GenerationUnitKind;
  sequence: number;
  compositionRef: string;
  milestoneIds: readonly string[];
  claimIds: readonly string[];
}>;

export type GeneratedSentence = Readonly<{
  sequence: number;
  text: string;
  milestoneIds: readonly string[];
  claimIds: readonly string[];
}>;

export type GeneratedParagraph = Readonly<{
  sequence: number;
  milestoneIds: readonly string[];
  sentences: readonly GeneratedSentence[];
}>;

export type GeneratedSection = Readonly<{
  unit: GenerationUnit;
  text?: string;
  milestoneIds?: readonly string[];
  claimIds?: readonly string[];
  paragraphs?: readonly GeneratedParagraph[];
}>;

export type GroundingValidationIssue = Readonly<{
  code: string;
  message: string;
  unitId: string;
}>;

export type GroundingValidationReport = Readonly<{
  passed: boolean;
  issues: readonly GroundingValidationIssue[];
}>;

export type ValidatedSection = Readonly<{
  generated: GeneratedSection;
  validation: GroundingValidationReport;
}>;

export type ProviderUsage = Readonly<{
  inputTokens: number | null;
  outputTokens: number | null;
}>;

export type GenerationDiagnostics = Readonly<{
  unitId: string;
  provider: string;
  model: string;
  latencyMs: number;
  usage: ProviderUsage;
  retryCount: number;
  completionReason: string | null;
}>;

export type NarrativeAssembly = Readonly<{
  title: NarrativeTextUnit;
  subtitle: NarrativeTextUnit | null;
  introduction: NarrativeSection;
  phases: readonly NarrativeSection[];
  conclusion: NarrativeSection;
  sections: readonly NarrativeSection[];
  paragraphs: readonly NarrativeParagraph[];
}>;
