import { randomUUID } from "node:crypto";
import { retrieveSource } from "../../functions/src/factory-v2/acquisition/retrieval";
import { verifyPayloadHash } from "../../functions/src/factory-v2/hashing";
import { V2FirestoreRepository } from "../../functions/src/factory-v2/repositories/firestore";

async function main() {
  const topicId = process.argv[2];
  if (!topicId) throw new Error("Usage: verify-retrievals.ts <topicId>");
  const repository = new V2FirestoreRepository();
  const discoveries = await repository.boundedQuery("v2AcquisitionDiscoveries", [{ field: "topicId", op: "==", value: topicId }], 50);
  const urls = [...new Set(discoveries.flatMap((item) => Array.isArray(item.chunks) ? item.chunks.map((chunk: { url?: unknown }) => chunk.url).filter((url): url is string => typeof url === "string") : []))].slice(0, 60);
  const context = { corpusId: repository.activeCorpusId(), topicId: "retrieval-verification", runId: randomUUID(), generation: 1, createdAt: new Date().toISOString() };
  const results = new Array<{
    urlHash: string;
    status: string;
    snapshotHashValid?: boolean;
    evidenceHashesValid?: boolean;
    evidenceSegments?: number;
    error?: string;
  }>(urls.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(10, urls.length) }, async () => {
    while (cursor < urls.length) {
      const index = cursor++;
      const url = urls[index]!;
    try {
      const result = await retrieveSource({ context, url, titleHint: "Retrieval verification", publisherId: null, sourceClass: "OTHER", primarySecondaryRole: "UNKNOWN", languageHint: "en" }, { archive: { async save(path) { return { objectRef: `gs://verification-only/${path}#1`, generation: "1" }; } } });
      results[index] = { urlHash: (await import("../../functions/src/factory-v2/hashing")).sha256(url), status: result.snapshot.retrievalDisposition, snapshotHashValid: verifyPayloadHash(result.snapshot), evidenceHashesValid: result.evidenceSegments.every(verifyPayloadHash), evidenceSegments: result.evidenceSegments.length };
    } catch (error) {
      results[index] = { urlHash: (await import("../../functions/src/factory-v2/hashing")).sha256(url), status: "FAILED", error: error instanceof Error ? error.message : String(error) };
    }
    }
  });
  await Promise.all(workers);
  const failures = results.filter((result) => result.status === "FAILED");
  const invalidHashes = results.filter((result) => result.status !== "FAILED" && (!result.snapshotHashValid || !result.evidenceHashesValid));
  const dispositionCounts = results.reduce<Record<string, number>>((counts, result) => {
    counts[result.status] = (counts[result.status] || 0) + 1;
    return counts;
  }, {});
  console.log(JSON.stringify({
    topicId,
    attempted: urls.length,
    dispositionCounts,
    invalidHashes,
    failureCounts: failures.reduce<Record<string, number>>((counts, result) => {
      const message = "error" in result && typeof result.error === "string" ? result.error : "UNKNOWN";
      counts[message] = (counts[message] || 0) + 1;
      return counts;
    }, {}),
    sampleFailures: failures.slice(0, 5),
  }, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
