import { buildPublicUrl, getVerifiedPublicSiteUrl } from "@/src/lib/public-site";

export function buildSitemapUrl(path: string): string {
  return buildPublicUrl(path);
}

export function getVerifiedSitemapOrigin(): string {
  return getVerifiedPublicSiteUrl();
}
