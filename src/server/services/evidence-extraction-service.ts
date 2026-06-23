import { ApiError } from "@/src/server/api/responses";
import { corpusRepository } from "@/src/server/repositories/corpus-repository";
import { evidenceRepository } from "@/src/server/repositories/evidence-repository";
import type { ExtractEvidenceInput, FactoryEvidenceReference } from "@/src/server/research-corpus/contracts";

const MIN_EVIDENCE_CHARS = 40;
const MAX_EVIDENCE_CHARS = 600;

function clampLimit(limit?: number): number {
  return Math.min(Math.max(limit || 25, 1), 100);
}

function normalizeClaim(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractSentenceSpans(text: string, limit: number) {
  const spans: Array<{ spanStart: number; spanEnd: number; quoteText: string; normalizedClaim: string }> = [];
  const pattern = /[^.!?]+[.!?]+|[^.!?]+$/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) && spans.length < limit) {
    const raw = match[0] || "";
    const quoteText = normalizeClaim(raw).slice(0, MAX_EVIDENCE_CHARS);
    if (quoteText.length < MIN_EVIDENCE_CHARS) {
      continue;
    }
    const leadingOffset = raw.search(/\S/);
    const spanStart = match.index + Math.max(leadingOffset, 0);
    const spanEnd = spanStart + quoteText.length;
    spans.push({
      spanStart,
      spanEnd,
      quoteText,
      normalizedClaim: quoteText
    });
  }
  return spans;
}

export const evidenceExtractionService = {
  async extractFromCorpusDocument(input: ExtractEvidenceInput) {
    const corpusDocument = await corpusRepository.requireDocument(input.corpusDocumentId);
    const spans = extractSentenceSpans(corpusDocument.normalizedText, clampLimit(input.maxEvidenceRecords));
    if (spans.length === 0) {
      throw new ApiError(409, "EVIDENCE_SPANS_NOT_FOUND", "Corpus document does not contain extractable evidence spans.");
    }

    return evidenceRepository.createRecords(
      spans.map((span) => ({
        corpusDocument,
        retrievalProvenance: corpusDocument.sourceLineage.retrievalProvenance,
        actor: input.actor,
        ...span
      }))
    );
  },

  toFactoryEvidenceReferences(records: Array<{
    evidenceRecordId: string;
    corpusDocumentId: string;
    sourceSnapshotId: string;
    sourceRecordId: string;
    provider: FactoryEvidenceReference["provider"];
    retrievalTimestamp: string;
  }>): FactoryEvidenceReference[] {
    return records.map((record) => ({
      evidenceRecordId: record.evidenceRecordId,
      corpusDocumentId: record.corpusDocumentId,
      sourceSnapshotId: record.sourceSnapshotId,
      sourceRecordId: record.sourceRecordId,
      provider: record.provider,
      retrievalTimestamp: record.retrievalTimestamp
    }));
  }
};
