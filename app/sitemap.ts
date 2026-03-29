import type { MetadataRoute } from "next";
import { buildSitemapUrl } from "@/src/lib/sitemap";
import { contentService } from "@/src/server/services/content-service";

const DEFAULT_LAST_MODIFIED = "2026-01-01T00:00:00.000Z";

function normalizeLastModified(value?: string): string {
  if (!value) {
    return DEFAULT_LAST_MODIFIED;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? DEFAULT_LAST_MODIFIED : parsed.toISOString();
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, timelines] = await Promise.all([
    contentService.listCategoryEntries(),
    contentService.listSitemapEntries()
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: buildSitemapUrl("/"),
      lastModified: DEFAULT_LAST_MODIFIED,
      changeFrequency: "daily",
      priority: 1
    },
    {
      url: buildSitemapUrl("/search"),
      lastModified: DEFAULT_LAST_MODIFIED,
      changeFrequency: "weekly",
      priority: 0.8
    }
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((category) => ({
    url: buildSitemapUrl(`/category/${category.slug}`),
    lastModified: normalizeLastModified(category.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8
  }));

  const timelineEntries: MetadataRoute.Sitemap = timelines.map((timeline) => ({
    url: buildSitemapUrl(`/timeline/${timeline.slug}`),
    lastModified: normalizeLastModified(timeline.updatedAt),
    changeFrequency: "weekly",
    priority: 0.9
  }));

  return [...staticEntries, ...categoryEntries, ...timelineEntries];
}
