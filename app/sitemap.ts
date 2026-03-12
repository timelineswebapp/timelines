import type { MetadataRoute } from "next";
import { config } from "@/src/lib/config";
import { contentService } from "@/src/server/services/content-service";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const timelineEntries = await contentService.listSitemapEntries();
  const latestTimelineUpdate = timelineEntries[0]?.updatedAt ? new Date(timelineEntries[0].updatedAt) : undefined;
  const staticEntries: MetadataRoute.Sitemap = [
    "",
    "/search"
  ].map((pathname) => ({
    url: `${config.siteUrl}${pathname}`,
    lastModified: latestTimelineUpdate,
    changeFrequency: "daily",
    priority: pathname === "" ? 1 : 0.7
  }));

  const timelinePageEntries = timelineEntries.map((timeline) => ({
    url: `${config.siteUrl}/timeline/${timeline.slug}`,
    lastModified: new Date(timeline.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.9
  }));

  return [...staticEntries, ...timelinePageEntries];
}
