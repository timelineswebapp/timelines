import type { MetadataRoute } from "next";
import { config } from "@/src/lib/config";
import { contentService } from "@/src/server/services/content-service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await contentService.listStaticSlugs(200);
  const staticEntries: MetadataRoute.Sitemap = [
    "",
    "/search"
  ].map((pathname) => ({
    url: `${config.siteUrl}${pathname}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: pathname === "" ? 1 : 0.7
  }));

  const timelineEntries = slugs.map((slug) => ({
    url: `${config.siteUrl}/timeline/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.9
  }));

  return [...staticEntries, ...timelineEntries];
}
