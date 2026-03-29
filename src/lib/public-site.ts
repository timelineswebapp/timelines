const VERIFIED_PUBLIC_SITE_URL = "https://www.timelines.sbs";

export function getVerifiedPublicSiteUrl(): string {
  return VERIFIED_PUBLIC_SITE_URL;
}

export function buildPublicUrl(path: string): string {
  return new URL(path, VERIFIED_PUBLIC_SITE_URL).toString();
}

export function normalizePublicSiteUrl(rawValue?: string): string {
  const value = rawValue?.trim();
  if (!value) {
    return VERIFIED_PUBLIC_SITE_URL;
  }

  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const isLocalHost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1";
    const isPreviewHost = hostname.endsWith(".vercel.app");
    const isHttps = url.protocol === "https:";

    if (!isHttps || isLocalHost || isPreviewHost) {
      return VERIFIED_PUBLIC_SITE_URL;
    }

    return VERIFIED_PUBLIC_SITE_URL;
  } catch {
    return VERIFIED_PUBLIC_SITE_URL;
  }
}
