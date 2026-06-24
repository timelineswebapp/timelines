import { ApiError } from "@/src/server/api/responses";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import type { SourceRetrievalInput } from "@/src/server/source-authority/contracts";
import { resilientFetch } from "@/src/server/source-authority/resilience";

const MAX_SNAPSHOT_CHARS = 500_000;
const MIN_RETRIEVAL_CHARS = 20;

function normalizeContentType(value: string | null): string {
  return value?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream";
}

function normalizeRetrievalUrl(provider: string, canonicalUrl: string): string {
  if (provider === "wikidata") {
    const id = canonicalUrl.match(/(?:EntityData\/|wiki\/)(Q\d+)/i)?.[1];
    if (id) return `https://www.wikidata.org/wiki/Special:EntityData/${id}.json`;
  }
  if (provider === "dbpedia") {
    const resource = canonicalUrl.match(/\/resource\/([^/?#]+)/)?.[1];
    if (resource) return `https://dbpedia.org/data/${resource}.json`;
  }
  if (provider === "library_of_congress") {
    try {
      const parsed = new URL(canonicalUrl);
      const hostname = parsed.hostname.toLowerCase();
      if ((hostname === "www.loc.gov" || hostname === "loc.gov") && parsed.protocol === "http:") {
        parsed.protocol = "https:";
        return parsed.toString();
      }
    } catch {
      return canonicalUrl;
    }
  }
  return canonicalUrl;
}

function validateRetrievedContent(input: {
  provider: string;
  contentType: string;
  contentText: string;
  retrievalUrl: string;
}): void {
  const trimmed = input.contentText.trim();
  if (!trimmed) {
    throw new ApiError(502, "SOURCE_RETRIEVAL_EMPTY", "Source retrieval returned empty content.");
  }
  if (trimmed.length < MIN_RETRIEVAL_CHARS) {
    throw new ApiError(502, "SOURCE_RETRIEVAL_INCOMPLETE", "Source retrieval returned incomplete content.");
  }
  if (input.contentType.includes("html") || /^\s*<!doctype html/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) {
    throw new ApiError(502, "SOURCE_RETRIEVAL_HTML_RESPONSE", `${input.provider} retrieval returned HTML for ${input.retrievalUrl}.`);
  }
  if ((input.provider === "wikidata" || input.provider === "dbpedia") && !input.contentType.includes("json") && !/^\s*[\[{]/.test(trimmed)) {
    throw new ApiError(502, "SOURCE_RETRIEVAL_FORMAT_INVALID", `${input.provider} retrieval returned ${input.contentType}; expected JSON.`);
  }
}

export const sourceRetrievalService = {
  async retrieve(input: SourceRetrievalInput) {
    const sourceRecord = await sourceAuthorityRepository.requireSourceRecord(input.sourceRecordId);
    const retrievalUrl = normalizeRetrievalUrl(sourceRecord.provider, sourceRecord.canonicalUrl);
    try {
      const response = await resilientFetch(retrievalUrl, {
        provider: sourceRecord.provider,
        accept: "application/json, text/plain, text/html;q=0.8, */*;q=0.5",
        userAgent: "TiMELiNES-SourceAuthority/1.0"
      });

      const contentType = normalizeContentType(response.headers.get("content-type"));
      const contentText = (await response.text()).slice(0, MAX_SNAPSHOT_CHARS);
      validateRetrievedContent({ provider: sourceRecord.provider, contentType, contentText, retrievalUrl });

      const retrievedAt = new Date().toISOString();
      const provenance = {
        provider: sourceRecord.provider,
        sourceRecordId: sourceRecord.sourceRecordId,
        retrievalUrl,
        retrievedAt,
        httpStatus: response.status,
        contentType,
        contentLength: contentText.length
      };

      const snapshot = await sourceAuthorityRepository.createSnapshot({
        sourceRecord,
        retrievalUrl,
        contentType,
        contentText,
        rawMetadata: {
          headers: {
            etag: response.headers.get("etag"),
            lastModified: response.headers.get("last-modified")
          },
          truncated: contentText.length === MAX_SNAPSHOT_CHARS
        },
        provenance,
        actor: input.actor
      });

      return { sourceRecord, snapshot };
    } catch (error) {
      const latestSnapshot = await sourceAuthorityRepository.getLatestSnapshot(sourceRecord.sourceRecordId);
      if (!latestSnapshot) {
        throw new ApiError(
          502,
          "SOURCE_RETRIEVAL_FAILED",
          `Source retrieval failed and no reusable snapshot exists: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      const retrievedAt = new Date().toISOString();
      const snapshot = await sourceAuthorityRepository.createSnapshot({
        sourceRecord,
        retrievalUrl: latestSnapshot.retrievalUrl,
        contentType: latestSnapshot.contentType,
        contentText: latestSnapshot.contentText,
        rawMetadata: {
          ...latestSnapshot.rawMetadata,
          staleSourceReuse: true,
          reusedSnapshotId: latestSnapshot.snapshotId,
          liveRetrievalFailure: error instanceof Error ? error.message : String(error)
        },
        provenance: {
        provider: sourceRecord.provider,
        sourceRecordId: sourceRecord.sourceRecordId,
          retrievalUrl: latestSnapshot.retrievalUrl,
          retrievedAt,
          httpStatus: 0,
          contentType: latestSnapshot.contentType,
          contentLength: latestSnapshot.contentText.length,
          staleSource: true,
          reusedSnapshotId: latestSnapshot.snapshotId,
          liveRetrievalFailure: error instanceof Error ? error.message : String(error)
        },
        actor: input.actor
      });
      return { sourceRecord, snapshot };
    }
  }
};
