import type { SearchResult, TagDetail, TimelineDetail, TimelineSummary } from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import { timelineRepository } from "@/src/server/repositories/timeline-repository";
import { tagRepository } from "@/src/server/repositories/tag-repository";

export const contentService = {
  listFeaturedTimelines(limit = 12): Promise<TimelineSummary[]> {
    return timelineRepository.listSummaries(limit);
  },

  listStaticSlugs(limit = 50): Promise<string[]> {
    return timelineRepository.listStaticSlugs(limit);
  },

  getTimeline(slug: string): Promise<TimelineDetail | null> {
    return timelineRepository.getBySlug(slug);
  },

  async getTagDetail(slug: string): Promise<TagDetail | null> {
    const [tag, timelines] = await Promise.all([tagRepository.getBySlug(slug), timelineRepository.getByTag(slug)]);
    if (!tag) {
      return null;
    }

    return { tag, timelines };
  },

  async searchTimelines(query: string, limit = 12): Promise<SearchResult> {
    const normalized = normalizeQuery(query);
    const items = normalized ? await timelineRepository.search(normalized, limit) : [];
    return {
      query: normalized,
      total: items.length,
      items
    };
  }
};
