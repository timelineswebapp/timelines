import { normalizePublicSiteUrl } from "@/src/lib/public-site";

const isProduction = process.env.NODE_ENV === "production";
const siteUrl = normalizePublicSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);

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
