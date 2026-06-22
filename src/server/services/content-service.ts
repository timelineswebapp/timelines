import type {
  CategoryDetail,
  CategoryEntry,
  EventShareContext,
  SearchResult,
  TagDetail,
  TimelineDetail,
  TimelineSummary
} from "@/src/lib/types";
import { platformReadModelService } from "@/src/server/services/platform-read-model-service";

type HomepageSnapshotSlice = {
  items: TimelineSummary[];
  nextOffset: number | null;
  hasMore: boolean;
  snapshotDate: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDateSeed(): string {
  return new Date().toISOString().slice(0, 10);
}

export const contentService = {
  listFeaturedTimelines(limit = 12): Promise<TimelineSummary[]> {
    return platformReadModelService.listFeaturedTimelines(limit);
  },

  listHomepageTimelines(limit = 12): Promise<TimelineSummary[]> {
    return platformReadModelService.listFeaturedTimelines(limit);
  },

  async getHomepageSnapshotSlice(offset = 0, limit = 12, snapshotDate?: string): Promise<HomepageSnapshotSlice> {
    const normalizedOffset = Math.max(0, offset);
    const normalizedLimit = clamp(limit, 1, 24);
    const items = (await platformReadModelService.listFeaturedTimelines(normalizedOffset + normalizedLimit)).slice(
      normalizedOffset,
      normalizedOffset + normalizedLimit
    );
    return {
      items,
      nextOffset: items.length === normalizedLimit ? normalizedOffset + items.length : null,
      hasMore: items.length === normalizedLimit,
      snapshotDate: snapshotDate || getDateSeed()
    };
  },

  listStaticSlugs(limit = 50): Promise<string[]> {
    return platformReadModelService.listStaticSlugs(limit);
  },

  listSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string }>> {
    return platformReadModelService.listSitemapEntries();
  },

  listMilestoneSitemapEntries(): Promise<Array<{ id: number; title: string; updatedAt: string }>> {
    return platformReadModelService.listMilestoneSitemapEntries();
  },

  listCategoryEntries(): Promise<CategoryEntry[]> {
    return platformReadModelService.listCategoryEntries();
  },

  listTags() {
    return platformReadModelService.listTags();
  },

  getTimeline(slug: string): Promise<TimelineDetail | null> {
    return platformReadModelService.getTimelineBySlug(slug);
  },

  resolveTimelineRoute(slug: string): Promise<{ timeline: TimelineDetail | null; redirectSlug: string | null }> {
    return platformReadModelService.resolveTimelineRoute(slug);
  },

  getEventShareContext(eventId: number): Promise<EventShareContext | null> {
    return platformReadModelService.getEventShareContext(eventId);
  },

  getMilestone(eventId: number): Promise<import("@/src/lib/types").EventRecord | null> {
    return platformReadModelService.getMilestone(eventId);
  },

  getMilestoneContext(eventId: number): Promise<import("@/src/lib/types").MilestoneContext | null> {
    return platformReadModelService.getMilestoneContext(eventId);
  },

  getHistoricalObjectBySlug(slug: string) {
    return platformReadModelService.getHistoricalObjectBySlug(slug);
  },

  getTagDetail(slug: string): Promise<TagDetail | null> {
    return platformReadModelService.getTagDetail(slug);
  },

  getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
    return platformReadModelService.getCategoryDetail(slug);
  },

  searchTimelines(query: string, limit = 12): Promise<SearchResult> {
    return platformReadModelService.searchKnowledge(query, limit);
  },

  searchKnowledge(query: string, limit = 12): Promise<SearchResult> {
    return platformReadModelService.searchKnowledge(query, limit);
  }
};
