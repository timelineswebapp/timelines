import { createHash } from "node:crypto";
import type { EditorialNarrative } from "@/src/server/editorial-intelligence/editorial-narrative-contracts";
import type { EditorialNarrativeWriterInput } from "@/src/server/editorial-intelligence/editorial-writer-input";
import type { GenerationDiagnostics, ValidatedSection } from "@/src/server/editorial-intelligence/editorial-generation-contracts";
import { narrativeClaimId } from "@/src/server/editorial-intelligence/editorial-grounding-validator";

const normalize = (value: string) => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export function assembleEditorialNarrative(input: {
  writerInput: EditorialNarrativeWriterInput;
  sections: readonly ValidatedSection[];
  diagnostics: readonly GenerationDiagnostics[];
}): EditorialNarrative {
  const byKind = (kind: ValidatedSection["generated"]["unit"]["kind"]) =>
    input.sections.filter((item) => item.generated.unit.kind === kind);
  const textUnit = (section: ValidatedSection) => ({
    text: normalize(section.generated.text!),
    claimIds: [...section.generated.claimIds!],
    milestoneIds: [...section.generated.milestoneIds!]
  });
  const narrativeSection = (section: ValidatedSection, sequence: number) => ({
    sectionId: section.generated.unit.unitId,
    sequence,
    sectionType: section.generated.unit.kind as "introduction" | "phase" | "conclusion",
    compositionRef: section.generated.unit.compositionRef,
    paragraphs: section.generated.paragraphs!.map((paragraph, paragraphIndex) => ({
      paragraphId: `${section.generated.unit.unitId}:paragraph:${paragraphIndex + 1}`,
      sequence: paragraphIndex + 1,
      milestoneIds: [...paragraph.milestoneIds],
      sentences: paragraph.sentences.map((sentence, sentenceIndex) => ({
        sentenceId: `${section.generated.unit.unitId}:paragraph:${paragraphIndex + 1}:sentence:${sentenceIndex + 1}`,
        sequence: sentenceIndex + 1,
        text: normalize(sentence.text),
        milestoneIds: [...sentence.milestoneIds],
        claimIds: [...sentence.claimIds],
        chronologyRefs: sentence.milestoneIds.map((id) => {
          const chronology = input.writerInput.selectedMilestones.find((item) => item.milestoneId === id)!.chronology;
          return `${chronology.sortYear}:${chronology.sortMonth ?? "x"}:${chronology.sortDay ?? "x"}`;
        })
      }))
    }))
  });
  const title = textUnit(byKind("title")[0]!);
  const subtitle = textUnit(byKind("subtitle")[0]!);
  const introduction = narrativeSection(byKind("introduction")[0]!, 1);
  const phases = byKind("phase").map((section, index) => narrativeSection(section, index + 2));
  const conclusion = narrativeSection(byKind("conclusion")[0]!, phases.length + 2);
  const sections = [introduction, ...phases, conclusion];
  const sentences = sections.flatMap((section) => section.paragraphs.flatMap((paragraph) => paragraph.sentences));
  const claimToEvidence = new Map(input.writerInput.validatedEvidence.map((item) => [
    narrativeClaimId(item.evidence.evidenceRecordId), item.evidence
  ]));
  const claimMap = sentences.map((sentence) => ({
    sentenceId: sentence.sentenceId,
    claimIds: sentence.claimIds,
    evidenceRecordIds: sentence.claimIds.map((id) => claimToEvidence.get(id)!.evidenceRecordId),
    milestoneIds: sentence.milestoneIds
  }));
  const draft = {
    contractVersion: "ei-004-narrative-v1" as const,
    narrativeId: `runtime-${hash([input.writerInput.writerInputFingerprint, sections])}`,
    factoryObjectId: null,
    canonicalSubject: input.writerInput.canonicalSubject,
    locale: input.writerInput.locale,
    editorialCompositionId: input.writerInput.editorialCompositionId,
    editorialCompositionFingerprint: input.writerInput.composition.plannerInputFingerprint,
    editorialTimelineCandidateId: input.writerInput.composition.editorialTimelineCandidateId,
    editorialTimelineCandidateFingerprint: input.writerInput.timelineCandidate.compilerInputFingerprint,
    editorialEvidenceSetId: input.writerInput.editorialEvidenceSet.editorialEvidenceSetId!,
    prompts: input.writerInput.prompts,
    writingPolicy: input.writerInput.writingPolicy,
    providerProvenance: input.writerInput.providerProvenance,
    writerInputFingerprint: input.writerInput.writerInputFingerprint,
    title, subtitle, introduction, phases, transitions: [], conclusion, sections,
    citations: [],
    narrativeClaimMap: { entries: claimMap },
    generationMetrics: {
      sectionCount: sections.length,
      paragraphCount: sections.reduce((sum, item) => sum + item.paragraphs.length, 0),
      sentenceCount: sentences.length,
      wordCount: [title.text, subtitle.text, ...sentences.map((item) => item.text)].join(" ").split(/\s+/).filter(Boolean).length,
      coveredMilestoneCount: input.writerInput.selectedMilestones.length,
      citedEvidenceCount: new Set(claimMap.flatMap((item) => item.evidenceRecordIds)).size
    },
    generationMetadata: {
      factoryOwned: true as const, authorityDecision: false as const,
      publicationReadinessDecision: false as const, generatedText: true as const
    }
  };
  return { ...draft, narrativeOutputFingerprint: hash({ draft, diagnostics: input.diagnostics }) };
}
