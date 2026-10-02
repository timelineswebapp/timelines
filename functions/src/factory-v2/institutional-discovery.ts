import {
  controlledResearchOperationSchema,
  type ControlledResearchOperation,
  type TopicAuthorityBinding
} from "./contracts";
import { contentAddressedId } from "./hashing";

const MAX_RESPONSE_BYTES = 2_097_152;
const MAX_RETURNED_URLS = 60;
const MAX_SITEMAP_FETCHES = 5;
const MAX_REDIRECTS = 3;

export type InstitutionalDiscoveryTransport = (url: string, init: RequestInit) => Promise<Response>;

function registeredDomain(url: URL, binding: TopicAuthorityBinding): boolean {
  const hostname = url.hostname.toLocaleLowerCase("en-US").replace(/^www\./u, "");
  return binding.verifiedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function safeRegisteredUrl(value: string, binding: TopicAuthorityBinding): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !registeredDomain(url, binding)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function urlsFromJson(value: unknown, output: string[], depth = 0): void {
  if (depth > 6 || output.length >= MAX_RETURNED_URLS) return;
  if (typeof value === "string") {
    if (/^https:\/\//u.test(value)) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) urlsFromJson(item, output, depth + 1);
    return;
  }
  if (value && typeof value === "object") for (const child of Object.values(value as Record<string, unknown>)) urlsFromJson(child, output, depth + 1);
}

function extractCandidateUrls(body: string, mediaType: string, baseUrl: string): string[] {
  if (mediaType.includes("json")) {
    try {
      const values: string[] = [];
      urlsFromJson(JSON.parse(body), values);
      return values;
    } catch {
      return [];
    }
  }
  const values: string[] = [];
  for (const match of body.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)) if (match[1]) values.push(match[1].replaceAll("&amp;", "&"));
  // Institutional sites commonly use root-relative links. Resolve those links
  // against the fetched registered endpoint before admission; snippets and
  // off-domain targets remain excluded by safeRegisteredUrl below.
  for (const match of body.matchAll(/href\s*=\s*["']([^"']+)["']/giu)) {
    if (!match[1]) continue;
    try {
      const resolved = new URL(match[1].replaceAll("&amp;", "&"), baseUrl);
      if (resolved.protocol === "https:") values.push(resolved.toString());
    } catch { /* Non-URL attributes are not discovery candidates. */ }
  }
  return values;
}

function boundedTerms(purpose: string): string[] {
  const stop = new Set(["authority", "direct", "domain", "evidence", "fallback", "including", "institutional", "questions", "registered", "research", "these", "those", "what", "were", "with"]);
  return [...new Set(purpose.normalize("NFKC").toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]{4,}/gu) || [])].filter((term) => !stop.has(term)).slice(0, 80);
}

function relevance(url: string, terms: readonly string[]): number {
  const tokens = new Set(decodeURIComponent(url).toLocaleLowerCase("en-US").split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  return terms.reduce((score, term) => score + (tokens.has(term) ? 1 : 0), 0);
}

export async function executeInstitutionalDiscovery(input: {
  binding: TopicAuthorityBinding;
  researchQuestionIds: string[];
  layer: "ORIENTATION" | "EVIDENTIARY_CORE";
  mechanism: Exclude<ControlledResearchOperation["mechanism"], "GOOGLE_GROUNDING_ESCALATION">;
  endpoint: string;
  purpose: string;
  transport?: InstitutionalDiscoveryTransport;
  signal?: AbortSignal;
}): Promise<ControlledResearchOperation> {
  if (!input.binding.discoveryMechanisms.includes(input.mechanism)) throw new Error(`AUTHORITY_DISCOVERY_MECHANISM_NOT_REGISTERED:${input.mechanism}`);
  const endpoint = safeRegisteredUrl(input.endpoint, input.binding);
  if (!endpoint) throw new Error("AUTHORITY_DISCOVERY_ENDPOINT_OUTSIDE_REGISTERED_DOMAIN");
  const semanticIdentity = { authorityBindingId: input.binding.bindingId, researchQuestionIds: [...new Set(input.researchQuestionIds)].sort(), layer: input.layer, mechanism: input.mechanism, endpoint, purpose: input.purpose.normalize("NFKC").trim() };
  const operationId = contentAddressedId("controlled-research-operation", semanticIdentity);
  if (input.mechanism === "DIRECT_URL") return controlledResearchOperationSchema.parse({ ...semanticIdentity, operationId, status: "SUCCEEDED", returnedUrls: [endpoint], providerInternalQueries: [], latencyMs: 0, failureReason: null });
  const startedAt = Date.now();
  try {
    const transport = input.transport || fetch;
    const fetchRegistered = async (initialUrl: string): Promise<Response> => {
      let current = initialUrl;
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
        const response = await transport(current, { method: "GET", headers: { Accept: "application/json, application/xml, text/xml, text/html;q=0.8" }, redirect: "manual", signal: input.signal });
        if (![301, 302, 303, 307, 308].includes(response.status)) return response;
        const location = response.headers.get("location");
        if (!location) throw new Error("INSTITUTIONAL_DISCOVERY_REDIRECT_WITHOUT_LOCATION");
        const target = safeRegisteredUrl(new URL(location, current).toString(), input.binding);
        if (!target) throw new Error("INSTITUTIONAL_DISCOVERY_REDIRECT_OUTSIDE_REGISTERED_DOMAIN");
        current = target;
      }
      throw new Error("INSTITUTIONAL_DISCOVERY_REDIRECT_LIMIT_EXCEEDED");
    };
    const pending = [endpoint];
    const visited = new Set<string>();
    const extracted: string[] = [];
    let totalBytes = 0;
    while (pending.length > 0 && visited.size < (input.mechanism === "SITEMAP" ? MAX_SITEMAP_FETCHES : 1)) {
      const current = pending.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const response = await fetchRegistered(current);
      if (!response.ok) {
        if (current === endpoint) throw new Error(`INSTITUTIONAL_DISCOVERY_HTTP_${response.status}`);
        continue;
      }
      const declaredLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) throw new Error("INSTITUTIONAL_DISCOVERY_RESPONSE_TOO_LARGE");
      const body = await response.text();
      totalBytes += Buffer.byteLength(body, "utf8");
      if (totalBytes > MAX_RESPONSE_BYTES) throw new Error("INSTITUTIONAL_DISCOVERY_RESPONSE_TOO_LARGE");
      const urls = extractCandidateUrls(body, response.headers.get("content-type") || "", current);
      if (input.mechanism === "SITEMAP" && /<sitemapindex(?:\s|>)/iu.test(body)) {
        for (const value of urls) {
          const child = safeRegisteredUrl(value, input.binding);
          if (child && !visited.has(child) && pending.length + visited.size < MAX_SITEMAP_FETCHES) pending.push(child);
        }
      } else extracted.push(...urls);
    }
    if (input.mechanism === "REGISTERED_DOMAIN_DISCOVERY") extracted.push(endpoint);
    const terms = boundedTerms(input.purpose);
    const scored = [...new Set(extracted.map((url) => safeRegisteredUrl(url, input.binding)).filter((url): url is string => Boolean(url)))]
      .map((url) => ({ url, score: relevance(url, terms) }));
    // A registered homepage or navigation page is not evidence merely because
    // it belongs to an approved authority. With no topical URL signal, leave
    // the question uncovered so bounded escalation can make an auditable
    // decision rather than admitting generic site content.
    const relevant = scored.filter((candidate) => candidate.score > 0);
    const candidates = relevant
      .sort((left, right) => right.score - left.score || left.url.localeCompare(right.url))
      .map((candidate) => candidate.url)
      .slice(0, MAX_RETURNED_URLS);
    return controlledResearchOperationSchema.parse({ ...semanticIdentity, operationId, status: "SUCCEEDED", returnedUrls: candidates, providerInternalQueries: [], latencyMs: Date.now() - startedAt, failureReason: null });
  } catch (error) {
    const failureReason = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
    return controlledResearchOperationSchema.parse({ ...semanticIdentity, operationId, status: "FAILED", returnedUrls: [], providerInternalQueries: [], latencyMs: Date.now() - startedAt, failureReason });
  }
}
