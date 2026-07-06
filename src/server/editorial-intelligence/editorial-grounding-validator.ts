import { createHash } from "node:crypto";
import type { EditorialNarrativeWriterInput } from "@/src/server/editorial-intelligence/editorial-writer-input";
import type {
  GeneratedSection,
  GroundingValidationIssue,
  GroundingValidationReport,
  ValidatedSection
} from "@/src/server/editorial-intelligence/editorial-generation-contracts";

const CAUSAL_PATTERN = /\b(because|caused|causing|led to|resulted in|therefore|consequently|enabled)\b/i;
const NUMBER_PATTERN = /(?<![\p{L}\p{N}])[-+]?\d+(?:[.,]\d+)?(?![\p{L}\p{N}])/gu;
const QUOTE_PATTERN = /["“”]([^"“”]+)["“”]/gu;

export function narrativeClaimId(evidenceRecordId: string): string {
  return `claim-${createHash("sha256").update(evidenceRecordId).digest("hex")}`;
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function validateGeneratedSection(
  generated: GeneratedSection,
  input: EditorialNarrativeWriterInput
): ValidatedSection {
  const issues: GroundingValidationIssue[] = [];
  const allowedMilestones = new Set(generated.unit.milestoneIds);
  const evidenceByClaim = new Map(input.validatedEvidence.map((item) => [
    narrativeClaimId(item.evidence.evidenceRecordId),
    item.evidence
  ]));
  const sentences = generated.paragraphs?.flatMap((paragraph) => paragraph.sentences) || (
    generated.text ? [{ text: generated.text, milestoneIds: generated.milestoneIds || [], claimIds: generated.claimIds || [] }] : []
  );
  const issue = (code: string, message: string) => issues.push({ code, message, unitId: generated.unit.unitId });
  if (sentences.length === 0) issue("EMPTY_GENERATION_UNIT", "Generation unit contains no text.");

  for (const sentence of sentences) {
    if (sentence.claimIds.length === 0 || sentence.milestoneIds.length === 0) {
      issue("SENTENCE_LINEAGE_REQUIRED", "Every generated sentence requires claim and milestone lineage.");
      continue;
    }
    if (sentence.claimIds.some((id) => !generated.unit.claimIds.includes(id) || !evidenceByClaim.has(id))) {
      issue("UNKNOWN_CLAIM", "Generated sentence references a claim outside WriterInput.");
    }
    if (sentence.milestoneIds.some((id) => !allowedMilestones.has(id))) {
      issue("UNKNOWN_MILESTONE", "Generated sentence references a milestone outside its composition unit.");
    }
    if (CAUSAL_PATTERN.test(sentence.text)) {
      issue("UNSUPPORTED_CAUSALITY", "Causal language requires explicit grounded relationship authority.");
    }
    const evidence = sentence.claimIds.map((id) => evidenceByClaim.get(id)).filter((item) => item !== undefined);
    const supportText = normalize(evidence.map((item) => `${item.normalizedClaim} ${item.quoteText}`).join(" "));
    const chronologyNumbers = sentence.milestoneIds.flatMap((id) => {
      const milestone = input.selectedMilestones.find((item) => item.milestoneId === id);
      return milestone ? [String(Math.abs(milestone.chronology.sortYear)), milestone.chronology.sortMonth, milestone.chronology.sortDay]
        .filter((item) => item !== null).map(String) : [];
    });
    for (const match of sentence.text.matchAll(NUMBER_PATTERN)) {
      const value = match[0].replace(/[,+-]/g, "");
      if (!supportText.includes(value) && !chronologyNumbers.includes(value)) {
        issue("UNSUPPORTED_NUMBER", `Generated number ${match[0]} is not grounded.`);
      }
    }
    for (const match of sentence.text.matchAll(QUOTE_PATTERN)) {
      const quote = normalize(match[1]!);
      if (!evidence.some((item) => normalize(item.quoteText).includes(quote))) {
        issue("UNSUPPORTED_QUOTATION", "Generated quotation is not present in cited evidence.");
      }
    }
  }
  for (const [index, paragraph] of (generated.paragraphs || []).entries()) {
    if (paragraph.sequence !== index + 1) issue("INVALID_PARAGRAPH_ORDER", "Paragraph ordering must be contiguous from 1.");
    if (paragraph.sentences.some((sentence, sentenceIndex) => sentence.sequence !== sentenceIndex + 1)) {
      issue("INVALID_SENTENCE_ORDER", "Sentence ordering must be contiguous from 1.");
    }
  }
  const report: GroundingValidationReport = { passed: issues.length === 0, issues };
  if (!report.passed) {
    const error = new Error(`Editorial generation failed grounding validation: ${issues.map((item) => item.code).join(", ")}.`);
    Object.assign(error, { validationReport: report });
    throw error;
  }
  return { generated, validation: report };
}

export function validateNarrativeCoverage(sections: readonly ValidatedSection[], input: EditorialNarrativeWriterInput): void {
  const phaseSections = sections.filter((item) => item.generated.unit.kind === "phase");
  const covered = phaseSections.flatMap((item) => item.generated.unit.milestoneIds);
  const expected = input.selectedMilestones.map((item) => item.milestoneId);
  if (covered.length !== new Set(covered).size) throw new Error("DUPLICATE_MILESTONE_COVERAGE");
  if (JSON.stringify(covered) !== JSON.stringify(expected)) throw new Error("MISSING_OR_REORDERED_MILESTONE_COVERAGE");
}
