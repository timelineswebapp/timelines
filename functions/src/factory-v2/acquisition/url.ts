import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

const TRACKING_PARAMETERS = new Set([
  "fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid", "igshid", "ref", "ref_src", "source"
]);

export function canonicalizeUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("SOURCE_RETRIEVAL_HTTPS_REQUIRED");
  if (url.username || url.password) throw new Error("SOURCE_RETRIEVAL_URL_CREDENTIALS_FORBIDDEN");
  url.hash = "";
  url.hostname = url.hostname.toLocaleLowerCase("en-US").replace(/\.$/u, "");
  if (url.port === "443") url.port = "";
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLocaleLowerCase("en-US");
    if (normalized.startsWith("utm_") || TRACKING_PARAMETERS.has(normalized)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/gu, "/");
  return url.toString();
}

function ipv4Number(address: string): number {
  return address.split(".").reduce((value, part) => value * 256 + Number(part), 0) >>> 0;
}

function inV4Cidr(address: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4Number(address) & mask) === (ipv4Number(base) & mask);
}

export function isForbiddenNetworkAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return [
      ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
      ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
      ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
      ["224.0.0.0", 4], ["240.0.0.0", 4]
    ].some(([base, prefix]) => inV4Cidr(address, String(base), Number(prefix)));
  }
  if (isIP(address) === 6) {
    const normalized = address.toLocaleLowerCase("en-US");
    const mapped = normalized.match(/^(?:::ffff:)(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
    if (mapped) return isForbiddenNetworkAddress(mapped);
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
      /^fe[89ab]/u.test(normalized) || normalized.startsWith("ff") || normalized.startsWith("2001:db8:");
  }
  return true;
}

export type DnsLookup = typeof lookup;

export async function assertPublicHttpsDestination(value: string, dnsLookup: DnsLookup = lookup): Promise<URL> {
  const canonical = canonicalizeUrl(value);
  const url = new URL(canonical);
  const hostname = url.hostname;
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname === "metadata.google.internal" || hostname === "metadata.goog") {
    throw new Error("SOURCE_RETRIEVAL_PRIVATE_HOST_FORBIDDEN");
  }
  if (isIP(hostname) && isForbiddenNetworkAddress(hostname)) throw new Error("SOURCE_RETRIEVAL_PRIVATE_ADDRESS_FORBIDDEN");
  const addresses = await dnsLookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("SOURCE_RETRIEVAL_DNS_EMPTY");
  if (addresses.some((record) => isForbiddenNetworkAddress(record.address))) throw new Error("SOURCE_RETRIEVAL_DNS_PRIVATE_ADDRESS_FORBIDDEN");
  return url;
}

export function parseRobotsPolicy(body: string, path: string, userAgent = "TiMELiNESResearchBot"): boolean {
  const groups: Array<{ agents: string[]; disallow: string[]; allow: string[] }> = [];
  let current: { agents: string[]; disallow: string[]; allow: string[] } | null = null;
  for (const rawLine of body.split(/\r?\n/gu).slice(0, 10_000)) {
    const line = rawLine.replace(/#.*$/u, "").trim();
    if (!line) continue;
    const match = line.match(/^([^:]+):\s*(.*)$/u);
    if (!match) continue;
    const field = match[1]!.trim().toLocaleLowerCase("en-US");
    const value = match[2]!.trim();
    if (field === "user-agent") {
      if (!current || current.disallow.length > 0 || current.allow.length > 0) {
        current = { agents: [], disallow: [], allow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLocaleLowerCase("en-US"));
    } else if (current && field === "disallow" && value) current.disallow.push(value);
    else if (current && field === "allow" && value) current.allow.push(value);
  }
  const ua = userAgent.toLocaleLowerCase("en-US");
  const candidates = groups.filter((group) => group.agents.some((agent) => agent === "*" || ua.includes(agent)));
  if (candidates.length === 0) return true;
  const rules = candidates.flatMap((group) => [
    ...group.allow.map((value) => ({ value, allow: true })),
    ...group.disallow.map((value) => ({ value, allow: false }))
  ]).filter((rule) => path.startsWith(rule.value)).sort((left, right) => right.value.length - left.value.length);
  return rules[0]?.allow ?? true;
}
