import type {
  SourceAuthorityProvider,
  SourceDiscoveryInput,
  SourceDiscoveryResult
} from "@/src/server/source-authority/contracts";
import { ApiError } from "@/src/server/api/responses";
import { sourceAuthorityRepository } from "@/src/server/repositories/source-authority-repository";
import { providerInCooldown, resilientFetch } from "@/src/server/source-authority/resilience";

const approvedProviders: SourceAuthorityProvider[] = ["wikidata", "dbpedia", "library_of_congress", "nara"];

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

async function discoverLibraryOfCongress(query: string, limit: number): Promise<SourceDiscoveryResult[]> {
  const url = new URL("https://www.loc.gov/search/");
  url.searchParams.set("fo", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("c", String(limit));
  const payload = await fetchJson(url.toString()) as { results?: Array<Record<string, unknown>> };
  return (payload.results || []).map((item) => {
    const link = text(item.id) || text(item.url) || "https://www.loc.gov/";
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
    const discovered = (await Promise.all(
      providers.map(async (provider) => {
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
          return await discoverProvider(provider, query, limit);
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
      })
    )).flat().slice(0, limit * providers.length);

    const records = await Promise.all(
      discovered.map((discovery) => sourceAuthorityRepository.registerDiscoveredSource({
        discovery,
        query,
        actor: input.actor
      }))
    );

    return { query, providers, discovered, records };
  }
};
