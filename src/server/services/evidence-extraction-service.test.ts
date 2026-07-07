import assert from "node:assert/strict";
import test from "node:test";
import { corpusRepository } from "@/src/server/repositories/corpus-repository";
import { evidenceRepository } from "@/src/server/repositories/evidence-repository";
import { evidenceExtractionService } from "@/src/server/services/evidence-extraction-service";
import type { CorpusDocument, EvidenceRecord } from "@/src/server/research-corpus/contracts";

test("extracts concise structured historical evidence spans", async () => {
  const originalRequireDocument = corpusRepository.requireDocument;
  const originalCreateRecords = evidenceRepository.createRecords;
  const created: EvidenceRecord[] = [];
  const corpusDocument: CorpusDocument = {
    corpusDocumentId: "corpus-world-war-ii",
    sourceSnapshotId: "snapshot-world-war-ii",
    sourceRecordId: "source-world-war-ii",
    provider: "wikidata",
    title: "World War II",
    contentType: "application/json",
    normalizedText: "Label: World War II. Description: 1939-1945 global conflict. World War II start time: 1939-09-01. World War II end time: 1945-09-02.",
    contentHash: "hash",
    sourceLineage: {
      sourceSnapshotId: "snapshot-world-war-ii",
      sourceRecordId: "source-world-war-ii",
      provider: "wikidata",
      retrievalTimestamp: "2026-07-07T18:52:49.621Z",
      snapshotVersion: 1,
      retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q362.json",
      retrievalProvenance: {
        provider: "wikidata",
        sourceRecordId: "source-world-war-ii",
        retrievalUrl: "https://www.wikidata.org/wiki/Special:EntityData/Q362.json",
        retrievedAt: "2026-07-07T18:52:49.621Z",
        httpStatus: 200,
        contentType: "application/json",
        contentLength: 239252
      }
    },
    createdBy: "test",
    createdAt: "2026-07-07T18:52:49.675Z"
  };

  try {
    corpusRepository.requireDocument = async () => corpusDocument;
    evidenceRepository.createRecords = async (inputs) => {
      created.push(...inputs.map((input, index) => ({
        evidenceRecordId: `evidence-${index + 1}`,
        corpusDocumentId: input.corpusDocument.corpusDocumentId,
        sourceSnapshotId: input.corpusDocument.sourceSnapshotId,
        sourceRecordId: input.corpusDocument.sourceRecordId,
        provider: input.corpusDocument.provider,
        retrievalTimestamp: input.corpusDocument.sourceLineage.retrievalTimestamp,
        spanStart: input.spanStart,
        spanEnd: input.spanEnd,
        quoteText: input.quoteText,
        normalizedClaim: input.normalizedClaim,
        provenance: {
          corpusDocumentId: input.corpusDocument.corpusDocumentId,
          sourceSnapshotId: input.corpusDocument.sourceSnapshotId,
          sourceRecordId: input.corpusDocument.sourceRecordId,
          provider: input.corpusDocument.provider,
          retrievalTimestamp: input.corpusDocument.sourceLineage.retrievalTimestamp,
          retrievalProvenance: input.retrievalProvenance
        },
        createdBy: input.actor,
        createdAt: "2026-07-07T18:52:49.700Z"
      })));
      return created;
    };

    const extracted = await evidenceExtractionService.extractFromCorpusDocument({
      corpusDocumentId: corpusDocument.corpusDocumentId,
      actor: "test",
      maxEvidenceRecords: 5
    });

    assert.ok(extracted.length >= 2);
    assert.ok(extracted.some((record) => record.normalizedClaim === "World War II start time: 1939-09-01."));
    assert.ok(extracted.some((record) => record.normalizedClaim === "World War II end time: 1945-09-02."));
  } finally {
    corpusRepository.requireDocument = originalRequireDocument;
    evidenceRepository.createRecords = originalCreateRecords;
  }
});
