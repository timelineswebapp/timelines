import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import { assertPublicHttpsDestination, canonicalizeUrl, isForbiddenNetworkAddress, parseRobotsPolicy } from "./acquisition/url";
import { canReuseSnapshot, extractHtmlText, retrieveSource, type FetchLike, type PrivateArchive } from "./acquisition/retrieval";
import { TEST_CONTEXT } from "./test-fixtures";

const publicDns = (async () => [{ address: "93.184.216.34", family: 4 }]) as never;

function response(status: number, body: string | Uint8Array, headers: Record<string, string>): Awaited<ReturnType<FetchLike>> {
  const bytes = typeof body === "string" ? new TextEncoder().encode(body) : body;
  return { status, headers: { get: (name) => headers[name.toLocaleLowerCase("en-US")] || null }, body: Readable.from([bytes]) as unknown as AsyncIterable<Uint8Array> };
}

function fetchSequence(values: Array<Awaited<ReturnType<FetchLike>>>): FetchLike {
  let index = 0;
  return async () => values[index++] || (() => { throw new Error("Unexpected fetch"); })();
}

const archive: PrivateArchive & { writes: string[] } = {
  writes: [],
  async save(path) { this.writes.push(path); return { objectRef: `gs://private/${path}#1`, generation: "1" }; }
};

const base = { context: TEST_CONTEXT, url: "https://example.com/history?utm_source=test&page=2", titleHint: "History", publisherId: null, sourceClass: "OTHER" as const, primarySecondaryRole: "UNKNOWN" as const, languageHint: "en", respectRobots: false };

test("Canonical URLs retain semantic parameters and remove tracking parameters", () => {
  assert.equal(canonicalizeUrl("https://EXAMPLE.com:443/a//b?page=2&utm_source=x#fragment"), "https://example.com/a/b?page=2");
  assert.throws(() => canonicalizeUrl("http://example.com"), /HTTPS_REQUIRED/);
  assert.throws(() => canonicalizeUrl("https://user:secret@example.com"), /CREDENTIALS/);
});

test("SSRF policy rejects private, link-local, metadata, reserved, and rebinding destinations", async () => {
  for (const address of ["127.0.0.1", "10.2.3.4", "169.254.169.254", "192.168.1.1", "::1", "fc00::1", "fe80::1", "2001:db8::1"]) assert.equal(isForbiddenNetworkAddress(address), true, address);
  assert.equal(isForbiddenNetworkAddress("93.184.216.34"), false);
  await assert.rejects(assertPublicHttpsDestination("https://metadata.google.internal/computeMetadata/v1/", publicDns), /PRIVATE_HOST/);
  await assert.rejects(assertPublicHttpsDestination("https://example.com", (async () => [{ address: "10.0.0.8", family: 4 }]) as never), /DNS_PRIVATE/);
});

test("Robots policy applies the longest matching allow/disallow rule", () => {
  const body = "User-agent: *\nDisallow: /private\nAllow: /private/public\n";
  assert.equal(parseRobotsPolicy(body, "/private/report"), false);
  assert.equal(parseRobotsPolicy(body, "/private/public/report"), true);
});

test("Safe HTML extraction removes executable content and preserves exact deterministic text", () => {
  const extracted = extractHtmlText("<html lang='fr'><head><title> Test </title><link rel='canonical' href='/canonical'></head><body><script>ignore me</script><header>Current news boilerplate</header><main><h1>Bonjour &amp; monde</h1><p>Evidence.</p></main><footer>Unrelated footer</footer></body></html>");
  assert.equal(extracted.text.includes("ignore me"), false);
  assert.equal(extracted.text.includes("Current news boilerplate"), false);
  assert.equal(extracted.text.includes("Unrelated footer"), false);
  assert.match(extracted.text, /Bonjour & monde/);
  assert.equal(extracted.canonicalUrl, "/canonical");
  assert.equal(extracted.language, "fr");
});

test("Retrieval follows bounded safe redirects, snapshots HTML, archives large bodies, and segments evidence", async () => {
  const html = `<html lang="en"><head><title>Source title</title><link rel="canonical" href="/canonical?page=2&utm_campaign=x"></head><body><p>${"Historical evidence. ".repeat(15_000)}</p></body></html>`;
  archive.writes.length = 0;
  const result = await retrieveSource(base, {
    dnsLookup: publicDns,
    fetch: fetchSequence([
      response(301, "", { location: "/redirected", "content-type": "text/plain" }),
      response(200, html, { "content-type": "text/html; charset=utf-8", etag: "v1" })
    ]),
    archive,
    now: () => new Date("2026-09-06T01:00:00.000Z")
  });
  assert.equal(result.source.canonicalUrl, "https://example.com/canonical?page=2");
  assert.equal(result.snapshot.redirectChain.length, 1);
  assert.equal(result.snapshot.rawObjectRef?.startsWith("gs://private/"), true);
  assert.ok(result.evidenceSegments.length > 1);
  assert.equal(result.evidenceSegments.every((segment) => segment.sourceSnapshotId === result.snapshot.sourceSnapshotId), true);
  assert.equal(result.snapshot.boundedExtractedText.includes("<script"), false);
});

test("Retrieval fails closed for redirect-to-private, oversized, encoded, and unsupported responses", async () => {
  await assert.rejects(retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(302, "", { location: "https://127.0.0.1/", "content-type": "text/plain" })]) }), /PRIVATE_ADDRESS/);
  await assert.rejects(retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "x", { "content-type": "text/plain", "content-length": String(25 * 1024 * 1024 + 1) })]) }), /BODY_TOO_LARGE/);
  await assert.rejects(retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "compressed", { "content-type": "text/plain", "content-encoding": "gzip" })]) }), /UNEXPECTED_CONTENT_ENCODING/);
  await assert.rejects(retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "binary", { "content-type": "application/octet-stream" })]) }), /UNSUPPORTED_CONTENT_TYPE/);
});

test("PDF retrieval requires a valid signature and records page extraction provenance through an injected safe extractor", async () => {
  archive.writes.length = 0;
  await assert.rejects(retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "not pdf", { "content-type": "application/pdf" })]), archive }), /PDF_SIGNATURE/);
  const bytes = new TextEncoder().encode("%PDF-1.7 fake fixture bytes");
  const result = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, bytes, { "content-type": "application/pdf" })]), archive, pdfExtractor: async () => "Extracted multilingual mission evidence from page one." });
  assert.equal(result.snapshot.mediaType, "application/pdf");
  assert.equal(result.snapshot.rawObjectRef?.startsWith("gs://private/"), true);
  assert.equal(result.evidenceSegments[0]!.extractionMethod, "PDF_TEXT_EXTRACTOR");
});

test("Access-limited pages are represented honestly and immutable historical cache is claim-sensitive", async () => {
  const limited = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(402, "", { "content-type": "text/html" })]) });
  assert.equal(limited.source.access, "PAYWALLED");
  assert.equal(limited.snapshot.partial, true);
  assert.equal(limited.evidenceSegments.length, 0);
  assert.equal(canReuseSnapshot({ ...limited.snapshot, retrievalDisposition: "NEWLY_RETRIEVED", accessLimitations: [] }, "IMMUTABLE_HISTORICAL", null), true);
  assert.equal(canReuseSnapshot({ ...limited.snapshot, retrievalDisposition: "NEWLY_RETRIEVED", accessLimitations: [], retrievedAt: "2020-01-01T00:00:00.000Z" }, "ONGOING", "2026-09-06"), false);
});

test("Retrieval reuses immutable snapshots and conditionally revalidates stale mutable snapshots", async () => {
  const first = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "Historical evidence.", { "content-type": "text/plain", etag: "v1", "last-modified": "Mon, 01 Jan 2024 00:00:00 GMT" })]), now: () => new Date("2024-01-01T00:00:00.000Z") });
  let cacheFetches = 0;
  const reused = await retrieveSource(base, { dnsLookup: publicDns, fetch: async () => { cacheFetches += 1; throw new Error("Cache hit must not fetch the body"); }, cachedSource: async () => ({ source: first.source, snapshot: first.snapshot, evidenceSegments: first.evidenceSegments, reusable: true }) });
  assert.equal(reused.cacheDisposition, "CACHE_HIT");
  assert.equal(cacheFetches, 0);
  let conditionalHeaders: Record<string, string> | null = null;
  const revalidated = await retrieveSource(base, { dnsLookup: publicDns, fetch: async (_url, init) => { conditionalHeaders = init.headers; return response(304, "", { "content-type": "text/plain" }); }, cachedSource: async () => ({ source: first.source, snapshot: first.snapshot, evidenceSegments: first.evidenceSegments, reusable: false }) });
  assert.equal(revalidated.cacheDisposition, "REVALIDATED");
  assert.equal(conditionalHeaders?.["If-None-Match"], "v1");
  assert.equal(conditionalHeaders?.["If-Modified-Since"], "Mon, 01 Jan 2024 00:00:00 GMT");
});

test("source snapshot identity covers the exact immutable retrieval observation", async () => {
  const now = () => new Date("2024-01-01T00:00:00.000Z");
  const first = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "Historical evidence.", { "content-type": "text/plain", etag: "v1" })]), now });
  const exactRetry = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "Historical evidence.", { "content-type": "text/plain", etag: "v1" })]), now });
  const changedObservation = await retrieveSource(base, { dnsLookup: publicDns, fetch: fetchSequence([response(200, "Historical evidence.", { "content-type": "text/plain", etag: "v2" })]), now });
  assert.equal(exactRetry.snapshot.sourceSnapshotId, first.snapshot.sourceSnapshotId);
  assert.equal(exactRetry.snapshot.payloadHash, first.snapshot.payloadHash);
  assert.notEqual(changedObservation.snapshot.sourceSnapshotId, first.snapshot.sourceSnapshotId);
});

test("Robots denial stops document retrieval rather than bypassing access constraints", async () => {
  const fetcher = fetchSequence([response(200, "User-agent: *\nDisallow: /history", { "content-type": "text/plain" })]);
  await assert.rejects(retrieveSource({ ...base, respectRobots: true }, { dnsLookup: publicDns, fetch: fetcher }), /ROBOTS_DENIED/);
});
