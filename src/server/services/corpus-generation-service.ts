import { ApiError } from "@/src/server/api/responses";
import { corpusRepository } from "@/src/server/repositories/corpus-repository";
import type { GenerateCorpusDocumentInput } from "@/src/server/research-corpus/contracts";

const MAX_CORPUS_CHARS = 500_000;

function normalizeSnapshotText(content: string, contentType: string): string {
  const withoutMarkup = contentType.includes("html")
    ? content
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    : content;

  return withoutMarkup
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CORPUS_CHARS);
}

export const corpusGenerationService = {
  async generateFromSourceSnapshot(input: GenerateCorpusDocumentInput) {
    const snapshot = await corpusRepository.requireSourceSnapshot(input.sourceSnapshotId);
    const normalizedText = normalizeSnapshotText(snapshot.contentText, snapshot.contentType);
    if (!normalizedText) {
      throw new ApiError(409, "CORPUS_DOCUMENT_EMPTY", "Source snapshot does not contain corpus-ready text.");
    }

    return corpusRepository.createDocument({
      snapshot,
      normalizedText,
      actor: input.actor
    });
  }
};
