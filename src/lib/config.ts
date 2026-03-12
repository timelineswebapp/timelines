const isProduction = process.env.NODE_ENV === "production";
const FALLBACK_PRODUCTION_SITE_URL = "https://timelines.sbs";

function normalizeSiteUrl(rawValue?: string): string {
  const value = rawValue?.trim();
  if (!value) {
    return FALLBACK_PRODUCTION_SITE_URL;
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
      return FALLBACK_PRODUCTION_SITE_URL;
    }

    return url.origin;
  } catch {
    return FALLBACK_PRODUCTION_SITE_URL;
  }
}

const siteUrl = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

export const config = {
  isProduction,
  siteUrl,
  metadataBase: new URL(siteUrl),
  gaId: process.env.NEXT_PUBLIC_GA_ID || "",
  adsenseId: process.env.NEXT_PUBLIC_ADSENSE_ID || "",
  adminApiToken: process.env.ADMIN_API_TOKEN || "",
  databaseUrl: process.env.DATABASE_URL || "",
  r2Bucket: process.env.R2_BUCKET || ""
};

export function assertDatabaseConfigured(): void {
  if (!config.databaseUrl && config.isProduction) {
    throw new Error("DATABASE_URL is required in production.");
  }
}
