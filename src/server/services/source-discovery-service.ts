import type {
  SourceAuthorityProvider,
  SourceDiscoveryInput,
  SourceDiscoveryResult,
  SourceRelevanceAssessment
} from "@/src/server/source-authority/contracts";
import { ApiError } from "@/src/server/api/responses";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { providerInCooldown, resilientFetch } from "@/src/server/source-authority/resilience";

const approvedProviders: SourceAuthorityProvider[] = ["wikidata", "dbpedia", "library_of_congress", "nara"];
const QUERY_STOP_WORDS = new Set(["a", "an", "and", "of", "the", "to", "in", "on", "for", "history"]);
const MIN_RELEVANT_SOURCES = 2;
const DBPEDIA_COLLECTION_EXPANSION_LIMIT = 24;
const HOMONYM_WORK_PATTERNS = [
  /\b(?:single|song|album|film|movie|novel|book|episode|television series|video game)\s+by\b/i,
  /\b(?:single|song|album|film|movie|novel|book|episode|television series|video game)\s+(?:from|released|recorded|published|starring|featuring)\b/i,
  /\b\d{3,4}\s+(?:single|song|album|film|movie|novel|book|episode|television series|video game|board game)\b/i,
  /\b(?:single|song|album|film|movie|novel|book|episode|television series|video game|board game)\b/i
];
const PUBLICATION_WORK_TERMS = new Set([
  "article", "book", "chapter", "journal", "paper", "publication", "study", "thesis", "volume"
]);
const BIBLIOGRAPHIC_WORK_PATTERNS = [
  /\b(?:academic|scientific|scholarly|journal|research)\s+(?:article|paper|publication|study)\b/i,
  /\b(?:article|book|chapter|paper|publication|study|thesis|volume)\s+published\b/i,
  /\b(?:isbn|issn|doi)\b/i,
  /\bvery short introduction\b/i,
  /\b97[89][-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?[\dx]\b/i
];

function relevanceTerms(value: string): string[] {
  return [...new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(
    (term) => term.length > 2 && !QUERY_STOP_WORDS.has(term)
  ))];
}

function topicRequestsPublicationWork(queryTerms: readonly string[]): boolean {
  return queryTerms.some((term) => PUBLICATION_WORK_TERMS.has(term));
}

function isBroadHistoricalTopic(query: string): boolean {
  return /^(?:the\s+)?history\s+of\s+/i.test(query.trim());
}

export function buildHistoricalDiscoveryQueries(query: string): string[] {
  const normalized = query.trim().replace(/\s+/g, " ");
  const subject = normalized
    .replace(/^the\s+history\s+of\s+/i, "")
    .replace(/^history\s+of\s+/i, "")
    .trim();
  const singular = subject.endsWith("ies")
    ? `${subject.slice(0, -3)}y`
    : subject.endsWith("s") && !subject.endsWith("ss")
      ? subject.slice(0, -1)
      : subject;
  return [...new Set([
    normalized,
    subject,
    singular,
    `${singular} history`,
    `list of ${subject}`,
    `${singular} timeline`,
    `${singular} chronology`
  ].filter((candidate) => candidate.length >= 2))].slice(0, 7);
}

export function assessSourceRelevance(query: string, source: SourceDiscoveryResult): SourceRelevanceAssessment {
  const queryTerms = relevanceTerms(query);
  const titleTerms = relevanceTerms(source.title);
  const descriptionTerms = relevanceTerms(source.description || "");
  const candidateTerms = new Set([...titleTerms, ...descriptionTerms]);
  const matches = queryTerms.filter((term) =>
    [...candidateTerms].some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate))
  );
  const topicalRelevance = queryTerms.length ? matches.length / queryTerms.length : 0;
  const titleMatches = queryTerms.filter((term) =>
    titleTerms.some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate))
  );
  const isCategoryRecord = /^category:/i.test(source.providerRecordId) ||
    /^category:/i.test(source.title) ||
    /\bcategory containing\b/i.test(source.description || "");
  const descriptionMatches = queryTerms.filter((term) =>
    descriptionTerms.some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate))
  );
  const descriptionGroundedMemberEntity = isBroadHistoricalTopic(query) &&
    source.sourceType.toLowerCase().includes("knowledge_base_entity") &&
    !isCategoryRecord &&
    descriptionMatches.length === queryTerms.length;
  const semanticRelevance = queryTerms.length
    ? Math.max(titleMatches.length / queryTerms.length, descriptionGroundedMemberEntity ? 1 : 0)
    : 0;
  const description = source.description || "";
  const describesUnrequestedCreativeWork = HOMONYM_WORK_PATTERNS.some((pattern) => pattern.test(description)) &&
    !relevanceTerms(description)
      .filter((term) => ["single", "song", "album", "film", "movie", "novel", "book", "episode", "television", "video", "game", "board"].includes(term))
      .some((term) => queryTerms.includes(term));
  const describesUnrequestedBibliographicWork = !topicRequestsPublicationWork(queryTerms) &&
    BIBLIOGRAPHIC_WORK_PATTERNS.some((pattern) => pattern.test(`${source.title} ${description}`));
  const historicalRelevance = topicalRelevance > 0 && [
    "knowledge_base_entity", "archive_record", "library_record"
  ].some((type) => source.sourceType.toLowerCase().includes(type.replace("_record", ""))) ? 1 : topicalRelevance;
  const authorityRelevance = source.provider === "library_of_congress" || source.provider === "nara" ? 1 : 0.8;
  const publicationSuitability = topicalRelevance > 0 && Boolean(source.description || source.title) ? 1 : 0;
  const relevanceScore = Number((
    topicalRelevance * 0.35 +
    historicalRelevance * 0.15 +
    semanticRelevance * 0.25 +
    authorityRelevance * 0.15 +
    publicationSuitability * 0.1
  ).toFixed(3));
  const rejectionReasons: string[] = [];
  if (topicalRelevance === 0) rejectionReasons.push("Source does not concern the discovery Topic.");
  if (semanticRelevance === 0 || describesUnrequestedCreativeWork || describesUnrequestedBibliographicWork) {
    rejectionReasons.push("Source entity is semantically misaligned with the discovery Topic.");
  }
  if (historicalRelevance === 0) rejectionReasons.push("Source does not materially contribute historical understanding of the Topic.");
  if (publicationSuitability === 0) rejectionReasons.push("Source would not improve publication quality.");
  if (relevanceScore < 0.55) rejectionReasons.push("Source relevance score is below the institutional acceptance threshold.");
  return {
    accepted: topicalRelevance > 0 && semanticRelevance > 0 &&
      !describesUnrequestedCreativeWork && !describesUnrequestedBibliographicWork && relevanceScore >= 0.55,
    relevanceScore,
    topicalRelevance: Number(topicalRelevance.toFixed(3)),
    historicalRelevance: Number(historicalRelevance.toFixed(3)),
    semanticRelevance: Number(semanticRelevance.toFixed(3)),
    authorityRelevance,
    publicationSuitability,
    rejectionReasons,
    semanticMismatch: describesUnrequestedCreativeWork
      ? "Source description identifies a creative work type not requested by the Topic."
      : describesUnrequestedBibliographicWork
        ? "Source description identifies a bibliographic work rather than the requested historical Topic."
      : semanticRelevance === 0
        ? `No Topic terms (${queryTerms.join(", ")}) matched the source entity title.`
        : null
  };
}

function clampLimit(limit?: number): number {
  return Math.min(Math.max(limit || 10, 1), 25);
}

function requireApprovedProviders(providers?: SourceAuthorityProvider[]): SourceAuthorityProvider[] {
  const requested = providers?.length ? providers : approvedProviders;
  const invalid = requested.filter((provider) => !approvedProviders.includes(provider));
  if (invalid.length > 0) {
    throw new ApiError(400, "SOURCE_DISCOVERY_PROVIDER_NOT_APPROVED", "Source discovery provider is not approved.");
  }
  return requested;
}

const providerCapabilities: Record<SourceAuthorityProvider, {
  discoveryFormats: string[];
  retrievalFormats: string[];
  notes: string;
}> = {
  wikidata: {
    discoveryFormats: ["application/json"],
    retrievalFormats: ["application/json"],
    notes: "Uses Wikidata entity search and Special:EntityData retrieval endpoints."
  },
  dbpedia: {
    discoveryFormats: ["application/json", "application/xml"],
    retrievalFormats: ["application/json"],
    notes: "DBpedia lookup can return XML despite JSON negotiation; adapter parses both."
  },
  library_of_congress: {
    discoveryFormats: ["application/json"],
    retrievalFormats: ["application/json", "text/html"],
    notes: "Library of Congress search uses fo=json; record retrieval keeps canonical item URL."
  },
  nara: {
    discoveryFormats: ["application/json"],
    retrievalFormats: ["text/html"],
    notes: "NARA catalog API is best effort; HTML and malformed discovery payloads are rejected explicitly."
  }
};

async function fetchText(url: string, accept: string): Promise<{ contentType: string; text: string }> {
  const provider = providerFromUrl(url);
  const response = await resilientFetch(url, { provider, accept });
  return {
    contentType: response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() || "application/octet-stream",
    text: await response.text()
  };
}

function rejectHtml(provider: SourceAuthorityProvider, contentType: string, body: string): void {
  if (contentType.includes("html") || /^\s*<!doctype html/i.test(body) || /^\s*<html[\s>]/i.test(body)) {
    throw new Error(`${provider} returned HTML instead of a supported discovery format.`);
  }
}

async function fetchJson(url: string): Promise<unknown> {
  const provider = providerFromUrl(url);
  const response = await fetchText(url, "application/json");
  rejectHtml(provider, response.contentType, response.text);
  if (!response.contentType.includes("json") && !/^\s*[\[{]/.test(response.text)) {
    throw new Error(`${provider} returned ${response.contentType}; expected JSON.`);
  }
  try {
    return JSON.parse(response.text);
  } catch (error) {
    throw new Error(`${provider} returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function providerFromUrl(url: string): SourceAuthorityProvider {
  const hostname = new URL(url).hostname;
  if (hostname.includes("dbpedia.org")) return "dbpedia";
  if (hostname.includes("loc.gov")) return "library_of_congress";
  if (hostname.includes("archives.gov")) return "nara";
  return "wikidata";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function xmlValues(xml: string, tag: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<[^>]*(?:${tag})[^>]*>([\\s\\S]*?)<\\/[^>]*(?:${tag})>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml))) {
    const value = match[1]
      ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    if (value) values.push(value);
  }
  return values;
}

function dbpediaDataUrl(resource: string): string {
  const name = resource.split("/").pop() || resource;
  return `https://dbpedia.org/data/${encodeURIComponent(name)}.json`;
}

function normalizeLibraryOfCongressUrl(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const hostname = parsed.hostname.toLowerCase();
  if (hostname !== "www.loc.gov" && hostname !== "loc.gov") {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }
  parsed.protocol = "https:";
  return parsed.toString();
}

async function discoverWikidata(query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  const url = new URL("https://www.wikidata.org/w/api.php");
  url.searchParams.set("action", "wbsearchentities");
  url.searchParams.set("format", "json");
  url.searchParams.set("language", "en");
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));
  const payload = await fetchJson(url.toString()) as { search?: Array<Record<string, unknown>> };
  return (payload.search || []).map((item) => {
    const id = text(item.id) || text(item.concepturi)?.split("/").pop() || "unknown";
    const canonicalUrl = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
    const originUrl = text(item.concepturi) || `https://www.wikidata.org/wiki/${id}`;
    return {
      provider: "wikidata",
      providerRecordId: id,
      canonicalUrl,
      title: text(item.label) || id,
      description: text(item.description),
      sourceType: "knowledge_base_entity",
      originUrl,
      raw: { ...item, providerCapabilities: providerCapabilities.wikidata }
    };
  });
}

async function discoverDbpedia(query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  const url = new URL("https://lookup.dbpedia.org/api/search");
  url.searchParams.set("query", query);
  url.searchParams.set("maxResults", String(limit));
  const response = await fetchText(url.toString(), "application/json, application/xml;q=0.9, text/xml;q=0.8");
  rejectHtml("dbpedia", response.contentType, response.text);
  if (response.contentType.includes("xml") || /^\s*<\?xml/i.test(response.text)) {
    const resources = xmlValues(response.text, "URI");
    const labels = xmlValues(response.text, "Label");
    const descriptions = xmlValues(response.text, "Description");
    return resources.slice(0, limit).map((resource, index) => {
      const id = resource.split("/").pop() || labels[index] || "unknown";
      return {
        provider: "dbpedia",
        providerRecordId: id,
        canonicalUrl: dbpediaDataUrl(resource),
        title: labels[index] || id,
        description: descriptions[index] || null,
        sourceType: "knowledge_base_entity",
        originUrl: resource,
        raw: { resource, providerCapabilities: providerCapabilities.dbpedia }
      };
    });
  }
  let payload: { docs?: Array<Record<string, unknown>> };
  try {
    payload = JSON.parse(response.text) as { docs?: Array<Record<string, unknown>> };
  } catch (error) {
    throw new Error(`dbpedia returned malformed JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return (payload.docs || []).map((item) => {
    const resource = Array.isArray(item.resource) ? text(item.resource[0]) : text(item.resource);
    const id = resource?.split("/").pop() || text(item.label) || "unknown";
    return {
      provider: "dbpedia",
      providerRecordId: id,
      canonicalUrl: resource ? dbpediaDataUrl(resource) : `https://dbpedia.org/data/${encodeURIComponent(id)}.json`,
      title: Array.isArray(item.label) ? text(item.label[0]) || id : text(item.label) || id,
      description: Array.isArray(item.comment) ? text(item.comment[0]) : text(item.comment),
      sourceType: "knowledge_base_entity",
      originUrl: resource || `https://dbpedia.org/resource/${encodeURIComponent(id)}`,
      raw: { ...item, providerCapabilities: providerCapabilities.dbpedia }
    };
  });
}

function dbpediaResourceUri(source: SourceDiscoveryResult): string | null {
  const candidate = source.originUrl || source.canonicalUrl;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname.includes("dbpedia.org")) return null;
    if (parsed.pathname.startsWith("/resource/")) {
      return `http://dbpedia.org/resource/${parsed.pathname.split("/").pop()}`;
    }
    if (parsed.pathname.startsWith("/data/")) {
      return `http://dbpedia.org/resource/${decodeURIComponent(parsed.pathname.split("/").pop() || "").replace(/\.json$/i, "")}`;
    }
  } catch {
    return null;
  }
  return null;
}

function isDbpediaCollection(source: SourceDiscoveryResult): boolean {
  if (source.provider !== "dbpedia") return false;
  const identity = `${source.providerRecordId} ${source.title}`.replace(/[_-]+/g, " ");
  return /\blist\s+of\b/i.test(identity);
}

function dbpediaCollectionTopic(source: SourceDiscoveryResult): string | null {
  const identity = source.title.replace(/[_-]+/g, " ").trim();
  const listSubject = identity.match(/\blist\s+of\s+(.+)$/i)?.[1]?.trim();
  const topic = listSubject || identity;
  return topic.length >= 2 ? topic : null;
}

function dbpediaResourceLabel(resource: string): string {
  const rawName = resource.split("/").pop() || resource;
  try {
    return decodeURIComponent(rawName).replace(/[_-]+/g, " ");
  } catch {
    return rawName.replace(/[_-]+/g, " ");
  }
}

function rankDbpediaCollectionLink(resource: string, query: string, collectionTopic: string | null, originalIndex: number): number {
  const labelTerms = relevanceTerms(dbpediaResourceLabel(resource));
  const contextTerms = relevanceTerms(`${query} ${collectionTopic || ""}`);
  const termMatches = contextTerms.filter((term) =>
    labelTerms.some((candidate) => candidate === term || candidate.startsWith(term) || term.startsWith(candidate))
  ).length;
  const temporalSignal = /\b(?:\d{3,4}|\d{3,4}\s*[–-]\s*\d{2,4}|century)\b/i.test(dbpediaResourceLabel(resource)) ? 1 : 0;
  return termMatches * 100 + temporalSignal * 10 - originalIndex / 1000;
}

function expandedFromCollectionTopic(source: SourceDiscoveryResult): string | null {
  const provenance = source.raw as Record<string, unknown> | undefined;
  const expandedFrom = provenance?.expandedFromCollection;
  if (!expandedFrom || typeof expandedFrom !== "object") return null;
  const title = text((expandedFrom as Record<string, unknown>).title);
  return title ? dbpediaCollectionTopic({ ...source, title }) : null;
}

function assessDiscoveryRelevance(query: string, source: SourceDiscoveryResult): SourceRelevanceAssessment {
  const directAssessment = assessSourceRelevance(query, source);
  if (directAssessment.accepted || !isBroadHistoricalTopic(query)) return directAssessment;
  const collectionTopic = expandedFromCollectionTopic(source);
  return collectionTopic ? assessSourceRelevance(`History of ${collectionTopic}`, source) : directAssessment;
}

async function fetchDbpediaExpansionJson(url: string): Promise<Record<string, unknown> | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "dbpedia.org") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "manual",
      headers: { accept: "application/json" }
    });
    if (!response.ok) return null;
    const textBody = await response.text();
    if (!/^\s*[\[{]/.test(textBody)) return null;
    const payload = JSON.parse(textBody);
    return payload && typeof payload === "object" && !Array.isArray(payload)
      ? payload as Record<string, unknown>
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function discoverDbpediaLinkedResources(
  source: SourceDiscoveryResult,
  query: string,
  limit: number
): Promise<SourceDiscoveryResult[]> {
  const resource = dbpediaResourceUri(source);
  if (!resource) return [];
  const collectionTopic = dbpediaCollectionTopic(source);
  const collectionPayload = await fetchJson(source.canonicalUrl) as Record<string, unknown>;
  const collectionSubjects = [resource, resource.replace("http://", "https://")];
  const linkedResources = collectionSubjects.flatMap((subject) => {
    const properties = collectionPayload[subject];
    if (!properties || typeof properties !== "object") return [];
    return Object.entries(properties as Record<string, unknown>).flatMap(([predicate, values]) => {
      if (!/wikiPageWikiLink$/i.test(predicate)) return [];
      return (Array.isArray(values) ? values : [values]).flatMap((entry) => {
        const value = entry && typeof entry === "object" ? text((entry as Record<string, unknown>).value) : text(entry);
        if (!value || !/^https?:\/\/dbpedia\.org\/resource\//i.test(value)) return [];
        if (/\/(?:Category|File|Template):/i.test(value)) return [];
        return [value.replace(/^https:/i, "http:")];
      });
    });
  });
  const seen = new Set<string>();
  const boundedLinks = linkedResources
    .map((linkedResource, originalIndex) => ({ linkedResource, originalIndex }))
    .filter(({ linkedResource }) => {
      if (seen.has(linkedResource)) return false;
      seen.add(linkedResource);
      return true;
    })
    .sort((left, right) =>
      rankDbpediaCollectionLink(right.linkedResource, query, collectionTopic, right.originalIndex) -
      rankDbpediaCollectionLink(left.linkedResource, query, collectionTopic, left.originalIndex)
    )
    .map(({ linkedResource }) => linkedResource)
    .slice(0, Math.max(limit * 4, DBPEDIA_COLLECTION_EXPANSION_LIMIT));
  const expanded = await Promise.all(boundedLinks.map(async (linkedResource) => {
    const payload = await fetchDbpediaExpansionJson(dbpediaDataUrl(linkedResource));
    if (!payload) return null;
    const properties = payload[linkedResource] || payload[linkedResource.replace("http://", "https://")];
    if (!properties || typeof properties !== "object") return null;
    let label = linkedResource.split("/").pop()?.replace(/_/g, " ") || null;
    let abstract: string | null = null;
    for (const [predicate, rawValues] of Object.entries(properties as Record<string, unknown>)) {
      const values = Array.isArray(rawValues) ? rawValues : [rawValues];
      if (/\/label$/i.test(predicate)) {
        label = values.flatMap((value) => {
          const valueObject = value && typeof value === "object" ? value as Record<string, unknown> : null;
          return valueObject && text(valueObject.lang) === "en" ? [text(valueObject.value)] : [];
        }).find((value): value is string => Boolean(value)) || label;
      }
      if (/\/abstract$/i.test(predicate)) {
        abstract = values.flatMap((value) => {
          const valueObject = value && typeof value === "object" ? value as Record<string, unknown> : null;
          return valueObject && text(valueObject.lang) === "en" ? [text(valueObject.value)] : [];
        }).find((value): value is string => Boolean(value)) || abstract;
      }
    }
    if (!linkedResource || !label || !abstract) return null;
    const candidate: SourceDiscoveryResult = {
      provider: "dbpedia",
      providerRecordId: linkedResource.split("/").pop() || label,
      canonicalUrl: dbpediaDataUrl(linkedResource),
      title: label,
      description: abstract,
      sourceType: "knowledge_base_entity",
      originUrl: linkedResource,
      raw: {
        expandedFromCollection: {
          providerRecordId: source.providerRecordId,
          title: source.title,
          query
        },
        providerCapabilities: providerCapabilities.dbpedia
      }
    };
    const directlyRelevant = assessSourceRelevance(query, candidate).accepted;
    const collectionRelevant = isBroadHistoricalTopic(query) && collectionTopic
      ? assessSourceRelevance(`History of ${collectionTopic}`, candidate).accepted
      : false;
    return directlyRelevant || collectionRelevant ? candidate : null;
  }));
  return expanded.filter((candidate): candidate is SourceDiscoveryResult => Boolean(candidate)).slice(0, limit);
}

async function discoverLibraryOfCongress(query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  const url = new URL("https://www.loc.gov/search/");
  url.searchParams.set("fo", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("c", String(limit));
  const payload = await fetchJson(url.toString()) as { results?: Array<Record<string, unknown>> };
  return (payload.results || []).map((item) => {
    const link = normalizeLibraryOfCongressUrl(text(item.url)) || normalizeLibraryOfCongressUrl(text(item.id));
    if (!link) {
      throw new Error("Library of Congress discovery returned a non-normalizable source URL.");
    }
    return {
      provider: "library_of_congress",
      providerRecordId: link,
      canonicalUrl: link,
      title: text(item.title) || link,
      description: text(item.description) || text(item.date),
      sourceType: text(item.original_format) || "library_record",
      originUrl: link,
      raw: { ...item, providerCapabilities: providerCapabilities.library_of_congress }
    };
  });
}

async function discoverNara(query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  const url = new URL("https://catalog.archives.gov/api/v1/");
  url.searchParams.set("q", query);
  url.searchParams.set("rows", String(limit));
  const payload = await fetchJson(url.toString()) as { body?: { hits?: { hits?: Array<Record<string, unknown>> } } };
  return (payload.body?.hits?.hits || []).map((hit) => {
    const source = (hit._source || {}) as Record<string, unknown>;
    const id = text(source.naId) || text(hit._id) || "unknown";
    const canonicalUrl = `https://catalog.archives.gov/id/${id}`;
    return {
      provider: "nara",
      providerRecordId: id,
      canonicalUrl,
      title: text(source.title) || id,
      description: text(source.scopeAndContentNote) || text(source.generalNote),
      sourceType: "archive_record",
      originUrl: canonicalUrl,
      raw: { ...source, providerCapabilities: providerCapabilities.nara }
    };
  });
}

async function discoverProvider(provider: SourceAuthorityProvider, query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  if (provider === "wikidata") return discoverWikidata(query, limit);
  if (provider === "dbpedia") return discoverDbpedia(query, limit);
  if (provider === "library_of_congress") return discoverLibraryOfCongress(query, limit);
  return discoverNara(query, limit);
}

export const sourceDiscoveryService = {
  approvedProviders,
  providerCapabilities,

  async discover(input: SourceDiscoveryInput) {
    const query = input.query.trim();
    if (query.length < 2 || query.length > 160) {
      throw new ApiError(400, "SOURCE_DISCOVERY_QUERY_INVALID", "Source discovery query must be between 2 and 160 characters.");
    }

    const requestedProviders = requireApprovedProviders(input.providers);
    const providers = [
      ...requestedProviders,
      ...approvedProviders.filter((provider) => !requestedProviders.includes(provider))
    ];
    const limit = clampLimit(input.limit);
    const queryVariants = buildHistoricalDiscoveryQueries(query);
    const evaluated: Array<{
      discovery: SourceDiscoveryResult;
      discoveryQuery: string;
      assessment: SourceRelevanceAssessment;
    }> = [];
    const seen = new Set<string>();

    for (const discoveryQuery of queryVariants) {
      const providerWave = (await Promise.all(providers.map(async (provider) => {
        if (await providerInCooldown(provider)) {
          console.warn(JSON.stringify({
            level: "warn",
            component: "source_discovery",
            provider,
            message: "Source discovery provider is in cooldown."
          }));
          return [];
        }
        try {
          return await discoverProvider(provider, discoveryQuery, limit);
        } catch (error) {
          console.warn(JSON.stringify({
            level: "warn",
            component: "source_discovery",
            provider,
            message: "Source discovery provider failed.",
            error: error instanceof Error ? error.message : String(error)
          }));
          return [];
        }
      }))).flat();
      const collectionExpansions = (await Promise.all(
        providerWave
          .filter(isDbpediaCollection)
          .slice(0, 3)
          .map((source) => discoverDbpediaLinkedResources(source, query, DBPEDIA_COLLECTION_EXPANSION_LIMIT).catch((error) => {
            console.warn(JSON.stringify({
              level: "warn",
              component: "source_discovery",
              provider: "dbpedia",
              message: "DBpedia collection expansion failed.",
              source: source.title,
              error: error instanceof Error ? error.message : String(error)
            }));
            return [];
          }))
      )).flat();
      const wave = [...providerWave, ...collectionExpansions];
      for (const discovery of wave) {
        const key = `${discovery.provider}:${discovery.providerRecordId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        evaluated.push({
          discovery,
          discoveryQuery,
          assessment: assessDiscoveryRelevance(query, discovery)
        });
      }
      const chronologyQueryCompleted = discoveryQuery !== query &&
        /\bhistory\b/i.test(discoveryQuery);
      const broadHistoryRequiresCollectionSweep = isBroadHistoricalTopic(query);
      if (
        chronologyQueryCompleted &&
        !broadHistoryRequiresCollectionSweep &&
        evaluated.filter((candidate) => candidate.assessment.accepted).length >= MIN_RELEVANT_SOURCES
      ) break;
    }

    const accepted = evaluated.filter((candidate) => candidate.assessment.accepted);
    const rejected = evaluated.filter((candidate) => !candidate.assessment.accepted);
    const [records, diagnostics] = await Promise.all([
      Promise.all(accepted.map(({ discovery, discoveryQuery, assessment }) => sourceAuthorityRepository.registerDiscoveredSource({
        discovery,
        query: discoveryQuery,
        actor: input.actor,
        relevanceAssessment: assessment
      }))),
      Promise.all(rejected.map(({ discovery, discoveryQuery, assessment }) =>
        sourceAuthorityRepository.recordRelevanceRejection({ discovery, query: discoveryQuery, assessment, actor: input.actor })
      ))
    ]);

    return {
      query,
      queryVariants,
      providers,
      discovered: evaluated.map(({ discovery }) => discovery),
      accepted: accepted.map(({ discovery }) => discovery),
      records,
      rejected: diagnostics
    };
  }
};
