const VERIFIED_SITEMAP_ORIGIN = "https://www.timelines.sbs";

export function buildSitemapUrl(path: string): string {
  return new URL(path, VERIFIED_SITEMAP_ORIGIN).toString();
}

export function getVerifiedSitemapOrigin(): string {
  return VERIFIED_SITEMAP_ORIGIN;
}
