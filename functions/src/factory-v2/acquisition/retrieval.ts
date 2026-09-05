import { getStorage } from "firebase-admin/storage";
import { request as httpsRequest } from "node:https";
import { lookup as systemLookup } from "node:dns/promises";
import { PROJECT_ID } from "../../config";
import { buildEvidenceSegment, immutableEnvelope, parseSealedArtifact, type ArtifactContext } from "../contracts/builders";
import { sourceDocumentSchema, sourceSnapshotSchema, type EvidenceSegment, type SourceDocument, type SourceSnapshot } from "../contracts";
import { contentAddressedId, sha256 } from "../hashing";
import { assertPublicHttpsDestination, canonicalizeUrl, isForbiddenNetworkAddress, parseRobotsPolicy, type DnsLookup } from "./url";

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 25 * 1024 * 1024;
const MAX_ROBOTS_BYTES = 1024 * 1024;
const FIRESTORE_BODY_THRESHOLD = 256 * 1024;
const EXTRACTED_TEXT_LIMIT = 128 * 1024;
const ALLOWED_MEDIA_TYPES = new Set(["text/html", "text/plain", "application/xhtml+xml", "application/pdf", "application/json", "application/ld+json"]);

type HeadersLike = { get(name: string): string | null };
type ResponseLike = { status: number; headers: HeadersLike; body: AsyncIterable<Uint8Array> | null };
export type FetchLike = (url: string, init: { method: "GET"; redirect: "manual"; signal: AbortSignal; headers: Record<string, string> }) => Promise<ResponseLike>;

export type PrivateArchive = {
  save(path: string, body: Uint8Array, metadata: Record<string, string>): Promise<{ objectRef: string; generation: string | null }>;
};

export class CloudStoragePrivateArchive implements PrivateArchive {
  private readonly bucketName = process.env.STORAGE_BUCKET || `${PROJECT_ID}-institutional-archive`;

  async save(path: string, body: Uint8Array, metadata: Record<string, string>): Promise<{ objectRef: string; generation: string | null }> {
    const file = getStorage().bucket(this.bucketName).file(path);
    try {
      await file.save(Buffer.from(body), { resumable: body.byteLength > 5 * 1024 * 1024, validation: "crc32c", metadata: { cacheControl: "private, no-store", metadata }, preconditionOpts: { ifGenerationMatch: 0 } });
    } catch (error) {
      if ((error as { code?: number }).code !== 412) throw error;
    }
    const [fileMetadata] = await file.getMetadata();
    const generation = fileMetadata.generation === undefined || fileMetadata.generation === null ? null : String(fileMetadata.generation);
    return { objectRef: `gs://${this.bucketName}/${path}#${generation || ""}`, generation };
  }
}

export type SafePdfExtractor = (body: Uint8Array) => Promise<string>;

export type RetrievalDependencies = {
  fetch?: FetchLike;
  dnsLookup?: DnsLookup;
  archive?: PrivateArchive;
  pdfExtractor?: SafePdfExtractor;
  now?: () => Date;
};

function mediaType(headers: HeadersLike): string {
  return (headers.get("content-type") || "").split(";", 1)[0]!.trim().toLocaleLowerCase("en-US");
}

async function readBoundedBody(response: ResponseLike, maximumBytes: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error("SOURCE_RETRIEVAL_BODY_TOO_LARGE");
  if (!response.body) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for await (const chunk of response.body) {
    total += chunk.byteLength;
    if (total > maximumBytes) throw new Error("SOURCE_RETRIEVAL_DECOMPRESSED_BODY_TOO_LARGE");
    chunks.push(chunk);
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
  return result;
}

const HTML_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " " };

export function extractHtmlText(html: string): { text: string; title: string | null; canonicalUrl: string | null; language: string | null; accessLimited: boolean } {
  const withoutActive = html
    .replace(/<!--[^]*?-->/gu, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[^>]*>[^]*?<\/\1\s*>/giu, " ");
  const title = withoutActive.match(/<title\b[^>]*>([^]*?)<\/title\s*>/iu)?.[1]?.replace(/<[^>]+>/gu, " ").trim() || null;
  const canonicalUrl = withoutActive.match(/<link\b(?=[^>]*\brel\s*=\s*["']?canonical["']?)(?=[^>]*\bhref\s*=\s*["']([^"']+)["'])[^>]*>/iu)?.[1] || null;
  const language = withoutActive.match(/<html\b[^>]*\blang\s*=\s*["']?([^\s"'>]+)/iu)?.[1] || null;
  const accessLimited = /(?:subscribe to continue|sign in to continue|subscriber-only|purchase access|paywall)/iu.test(withoutActive.slice(0, 100_000));
  const text = withoutActive
    .replace(/<(?:br|p|div|section|article|main|header|footer|h[1-6]|li|tr|blockquote)\b[^>]*>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (_, entity: string) => {
      if (entity.startsWith("#x")) return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#")) return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return HTML_ENTITIES[entity.toLocaleLowerCase("en-US")] || " ";
    })
    .replace(/[\t ]+/gu, " ")
    .replace(/\n\s*\n+/gu, "\n\n")
    .trim();
  return { text, title, canonicalUrl, language, accessLimited };
}

function secureNodeFetch(dnsLookup: DnsLookup | undefined): FetchLike {
  const resolver = dnsLookup || systemLookup;
  return (url, init) => new Promise<ResponseLike>((resolve, reject) => {
    const request = httpsRequest(url, {
      method: init.method,
      headers: { ...init.headers, "Accept-Encoding": "identity" },
      signal: init.signal,
      lookup: (hostname, options, callback) => {
        void resolver(hostname, { all: true, verbatim: true }).then((records) => {
          const forbidden = records.find((record) => isForbiddenNetworkAddress(record.address));
          const complete = callback as unknown as (...values: unknown[]) => void;
          if (records.length === 0 || forbidden) return complete(new Error("SOURCE_RETRIEVAL_DNS_PRIVATE_ADDRESS_FORBIDDEN"));
          if (typeof options === "object" && options.all) return complete(null, records);
          const selected = records[0]!;
          complete(null, selected.address, selected.family);
        }, (error) => (callback as unknown as (...values: unknown[]) => void)(error));
      }
    }, (response) => {
      const headers: HeadersLike = { get: (name) => {
        const value = response.headers[name.toLocaleLowerCase("en-US")];
        return Array.isArray(value) ? value.join(", ") : value === undefined ? null : String(value);
      } };
      resolve({ status: response.statusCode || 0, headers, body: response as unknown as AsyncIterable<Uint8Array> });
    });
    request.once("error", reject);
    request.end();
  });
}

async function robotsAllows(url: URL, fetcher: FetchLike, dnsLookup: DnsLookup | undefined): Promise<boolean> {
  const robots = new URL("/robots.txt", url);
  await assertPublicHttpsDestination(robots.toString(), dnsLookup);
  const response = await fetcher(robots.toString(), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "TiMELiNESResearchBot/2.0", Accept: "text/plain" } });
  // A missing policy means there is no published crawl restriction. All other
  // non-success responses fail closed; in particular, never treat an auth or
  // transient origin failure as permission to crawl.
  if (response.status === 404 || response.status === 410) return true;
  if (response.status < 200 || response.status >= 300) return false;
  const body = await readBoundedBody(response, MAX_ROBOTS_BYTES);
  return parseRobotsPolicy(new TextDecoder("utf-8", { fatal: false }).decode(body), url.pathname);
}

function isGroundingAttributionRelay(url: URL): boolean {
  return url.hostname.toLocaleLowerCase("en-US") === "vertexaisearch.cloud.google.com"
    && url.pathname.startsWith("/grounding-api-redirect/");
}

function safeDeclaredCanonical(current: URL, declared: string | null): string {
  if (!declared) return canonicalizeUrl(current.toString());
  try {
    const candidate = new URL(declared, current);
    if (candidate.hostname.toLocaleLowerCase("en-US") !== current.hostname.toLocaleLowerCase("en-US")) return canonicalizeUrl(current.toString());
    return canonicalizeUrl(candidate.toString());
  } catch {
    return canonicalizeUrl(current.toString());
  }
}

export async function retrieveSource(input: {
  context: ArtifactContext;
  url: string;
  titleHint: string;
  publisherId: string | null;
  sourceClass: SourceDocument["sourceClass"];
  primarySecondaryRole: SourceDocument["primarySecondaryRole"];
  languageHint: string;
  respectRobots?: boolean;
}, dependencies: RetrievalDependencies = {}): Promise<{ source: SourceDocument; snapshot: SourceSnapshot; evidenceSegments: EvidenceSegment[]; archiveWrites: number }> {
  const fetcher = dependencies.fetch || secureNodeFetch(dependencies.dnsLookup);
  let current = await assertPublicHttpsDestination(input.url, dependencies.dnsLookup);
  const redirectChain: string[] = [];
  let response: ResponseLike | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicHttpsDestination(current.toString(), dependencies.dnsLookup);
    // Grounding attribution URLs are signed navigation relays, not publisher
    // content. Follow the relay, then enforce robots policy on the resolved
    // publisher URL before downloading its body.
    if (input.respectRobots !== false && !isGroundingAttributionRelay(current) && !(await robotsAllows(current, fetcher, dependencies.dnsLookup))) {
      throw new Error("SOURCE_RETRIEVAL_ROBOTS_DENIED");
    }
    response = await fetcher(current.toString(), { method: "GET", redirect: "manual", signal: AbortSignal.timeout(30_000), headers: { "User-Agent": "TiMELiNESResearchBot/2.0", Accept: "text/html,text/plain,application/xhtml+xml,application/pdf,application/json,application/ld+json" } });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    if (hop === MAX_REDIRECTS) throw new Error("SOURCE_RETRIEVAL_REDIRECT_LIMIT");
    const location = response.headers.get("location");
    if (!location) throw new Error("SOURCE_RETRIEVAL_REDIRECT_WITHOUT_LOCATION");
    redirectChain.push(canonicalizeUrl(current.toString()));
    current = await assertPublicHttpsDestination(new URL(location, current).toString(), dependencies.dnsLookup);
  }
  if (!response) throw new Error("SOURCE_RETRIEVAL_NO_RESPONSE");
  const retrievedAt = (dependencies.now || (() => new Date()))().toISOString();
  const type = mediaType(response.headers);
  const accessLimitations: string[] = [];
  if ([401, 402, 403].includes(response.status)) accessLimitations.push(response.status === 402 ? "PAYWALL" : "ACCESS_DENIED");
  if (response.status < 200 || response.status >= 300) {
    const canonicalUrl = canonicalizeUrl(current.toString());
    const sourceId = contentAddressedId("source", canonicalUrl);
    const source = sourceDocumentSchema.parse({ sourceId, corpusId: input.context.corpusId, canonicalUrl, canonicalUrlHash: sha256(canonicalUrl), publisherId: input.publisherId, title: input.titleHint, authors: [], publicationDate: null, sourceClass: input.sourceClass, language: input.languageHint, primarySecondaryRole: input.primarySecondaryRole, authorityDomains: [], access: response.status === 402 ? "PAYWALLED" : "UNAVAILABLE", currentSnapshotId: null, supersedesSourceId: null, identityHash: sha256(canonicalUrl), updatedAt: retrievedAt });
    const emptyHash = sha256("");
    const snapshotId = contentAddressedId("snapshot", { sourceId, retrievedAt, status: response.status });
    const snapshot = parseSealedArtifact(sourceSnapshotSchema, { ...immutableEnvelope(input.context, snapshotId), sourceSnapshotId: snapshotId, sourceId, retrievalUrl: canonicalizeUrl(input.url), resolvedUrl: canonicalUrl, redirectChain, retrievedAt, retrievalMethod: "HTTP", retrievalDisposition: response.status === 402 ? "ACCESS_LIMITED" : "UNAVAILABLE", mediaType: type || "application/octet-stream", language: input.languageHint, publicationDateObserved: null, rawObjectRef: null, extractedTextObjectRef: null, boundedExtractedText: "", contentHash: emptyHash, extractionHash: null, groundingMetadataRef: null, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), license: null, contentBytes: 0, accessLimitations, partial: true, supersedesSnapshotId: null });
    return { source, snapshot, evidenceSegments: [], archiveWrites: 0 };
  }
  if (!ALLOWED_MEDIA_TYPES.has(type)) throw new Error(`SOURCE_RETRIEVAL_UNSUPPORTED_CONTENT_TYPE:${type || "missing"}`);
  const contentEncoding = (response.headers.get("content-encoding") || "identity").toLocaleLowerCase("en-US");
  if (contentEncoding !== "identity") throw new Error("SOURCE_RETRIEVAL_UNEXPECTED_CONTENT_ENCODING");
  const raw = await readBoundedBody(response, MAX_BODY_BYTES);
  if (type === "application/pdf" && !(raw[0] === 0x25 && raw[1] === 0x50 && raw[2] === 0x44 && raw[3] === 0x46 && raw[4] === 0x2d)) throw new Error("SOURCE_RETRIEVAL_PDF_SIGNATURE_MISMATCH");
  const decoded = type === "application/pdf" ? null : new TextDecoder("utf-8", { fatal: false }).decode(raw);
  const html = type === "text/html" || type === "application/xhtml+xml" ? extractHtmlText(decoded || "") : null;
  if (html?.accessLimited) accessLimitations.push("PAYWALL_DETECTED");
  let extractedText = html?.text ?? decoded ?? "";
  if (type === "application/pdf") {
    if (!dependencies.pdfExtractor) accessLimitations.push("PDF_TEXT_EXTRACTION_NOT_CONFIGURED");
    else extractedText = await dependencies.pdfExtractor(raw);
  }
  const canonicalUrl = safeDeclaredCanonical(current, html?.canonicalUrl || null);
  const sourceId = contentAddressedId("source", canonicalUrl);
  const contentHash = sha256(raw);
  const extractionHash = extractedText ? sha256(extractedText) : null;
  const archive = dependencies.archive || new CloudStoragePrivateArchive();
  let rawObjectRef: string | null = null;
  let extractedTextObjectRef: string | null = null;
  let archiveWrites = 0;
  if (raw.byteLength > FIRESTORE_BODY_THRESHOLD || type === "application/pdf") {
    const stored = await archive.save(`factory-v2/sources/${sourceId}/${contentHash}/raw`, raw, { contentHash, mediaType: type, sourceId });
    rawObjectRef = stored.objectRef;
    archiveWrites += 1;
  }
  const encodedText = new TextEncoder().encode(extractedText);
  if (encodedText.byteLength > FIRESTORE_BODY_THRESHOLD) {
    const stored = await archive.save(`factory-v2/sources/${sourceId}/${contentHash}/extracted.txt`, encodedText, { contentHash: extractionHash || sha256(""), mediaType: "text/plain", sourceId });
    extractedTextObjectRef = stored.objectRef;
    archiveWrites += 1;
  }
  const boundedExtractedText = extractedText.slice(0, EXTRACTED_TEXT_LIMIT);
  const snapshotId = contentAddressedId("snapshot", { sourceId, contentHash, retrievedAt });
  const snapshot = parseSealedArtifact(sourceSnapshotSchema, { ...immutableEnvelope(input.context, snapshotId), sourceSnapshotId: snapshotId, sourceId, retrievalUrl: canonicalizeUrl(input.url), resolvedUrl: canonicalUrl, redirectChain, retrievedAt, retrievalMethod: "HTTP", retrievalDisposition: accessLimitations.length > 0 ? "ACCESS_LIMITED" : "NEWLY_RETRIEVED", mediaType: type, language: html?.language || input.languageHint, publicationDateObserved: null, rawObjectRef, extractedTextObjectRef, boundedExtractedText, contentHash, extractionHash, groundingMetadataRef: null, etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"), license: null, contentBytes: raw.byteLength, accessLimitations, partial: accessLimitations.length > 0 && extractedText.length === 0, supersedesSnapshotId: null });
  const source = sourceDocumentSchema.parse({ sourceId, corpusId: input.context.corpusId, canonicalUrl, canonicalUrlHash: sha256(canonicalUrl), publisherId: input.publisherId, title: html?.title || input.titleHint, authors: [], publicationDate: null, sourceClass: input.sourceClass, language: snapshot.language, primarySecondaryRole: input.primarySecondaryRole, authorityDomains: [], access: accessLimitations.includes("PAYWALL_DETECTED") ? "PAYWALLED" : accessLimitations.length > 0 ? "LIMITED" : "OPEN", currentSnapshotId: snapshotId, supersedesSourceId: null, identityHash: sha256(canonicalUrl), updatedAt: retrievedAt });
  const evidenceSegments = segmentExtractedText(input.context, snapshotId, boundedExtractedText, type === "application/pdf" ? "PDF_TEXT_EXTRACTOR" : type.includes("html") ? "SAFE_HTML_TEXT" : "PLAIN_TEXT");
  return { source, snapshot, evidenceSegments, archiveWrites };
}

export function segmentExtractedText(context: ArtifactContext, sourceSnapshotId: string, text: string, extractionMethod: string): EvidenceSegment[] {
  const segments: EvidenceSegment[] = [];
  const paragraphs = text.split(/\n\s*\n/gu);
  let searchOffset = 0;
  for (const paragraph of paragraphs) {
    const exactText = paragraph.trim();
    if (!exactText) continue;
    const startOffset = text.indexOf(exactText, searchOffset);
    const chunks = exactText.match(/[^]{1,12000}/gu) || [];
    let localOffset = 0;
    for (const chunk of chunks) {
      if (segments.length >= 200) return segments;
      const start = startOffset + localOffset;
      segments.push(buildEvidenceSegment(context, { sourceSnapshotId, exactText: chunk, segmentType: "TEXT", startOffset: start, endOffset: start + chunk.length, page: null, section: null, selector: null, extractionMethod, sourceCompleteness: "FULL_SNAPSHOT" }));
      localOffset += chunk.length;
    }
    searchOffset = Math.max(searchOffset, startOffset + exactText.length);
  }
  return segments;
}

export function canReuseSnapshot(snapshot: SourceSnapshot, freshness: "IMMUTABLE_HISTORICAL" | "MUTABLE" | "ONGOING", ongoingAsOf: string | null): boolean {
  if (snapshot.retrievalDisposition === "UNAVAILABLE" || snapshot.accessLimitations.length > 0) return false;
  if (freshness === "IMMUTABLE_HISTORICAL") return true;
  const retrieved = Date.parse(snapshot.retrievedAt);
  const reference = ongoingAsOf ? Date.parse(`${ongoingAsOf}T23:59:59.999Z`) : Date.now();
  const maximumAge = freshness === "ONGOING" ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return Number.isFinite(retrieved) && Number.isFinite(reference) && reference - retrieved <= maximumAge;
}
