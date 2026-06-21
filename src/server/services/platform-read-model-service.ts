import type {
  CategoryDetail,
  CategoryEntry,
  EventRecord,
  EventShareContext,
  HistoricalObjectDetail,
  MilestoneContext,
  SearchResult,
  TagDetail,
  TagRecord,
  TimelineDetail,
  TimelineSummary
} from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import type { ContinuityResolution, PublishedReadModelSnapshot } from "@/src/server/platform/read-model-contracts";
import { platformReadModelRepository } from "@/src/server/repositories/platform-read-model-repository";

function payloadAs<T>(snapshot: PublishedReadModelSnapshot | null): T | null {
  return snapshot ? (snapshot.payload as T) : null;
}

function matchesQuery(value: string, normalizedQuery: string) {
  return value.toLowerCase().includes(normalizedQuery);
}

export const platformReadModelService = {
  async hasPublishedReadModels(): Promise<boolean> {
    const timelines = await platformReadModelRepository.listPublishedReadModels("timeline", 1);
    return timelines.length > 0;
  },

  async listFeaturedTimelines(limit = 12): Promise<TimelineSummary[]> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("timeline", limit);
    return snapshots.map((snapshot) => snapshot.payload as unknown as TimelineDetail | TimelineSummary);
  },

  async getTimelineBySlug(slug: string): Promise<TimelineDetail | null> {
    return payloadAs<TimelineDetail>(await platformReadModelRepository.getPublishedReadModelBySlug("timeline", slug));
  },

  async resolveTimelineRoute(slug: string): Promise<{ timeline: TimelineDetail | null; redirectSlug: string | null }> {
    const timeline = await platformReadModelService.getTimelineBySlug(slug);
    return { timeline, redirectSlug: null };
  },

  async listStaticSlugs(limit = 50): Promise<string[]> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("timeline", limit);
    return snapshots.map((snapshot) => snapshot.slug).filter((slug): slug is string => Boolean(slug));
  },

  async listSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string }>> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("timeline", 5000);
    return snapshots
      .filter((snapshot) => snapshot.slug)
      .map((snapshot) => ({
        slug: snapshot.slug as string,
        updatedAt: snapshot.createdAt || new Date(0).toISOString()
      }));
  },

  async listMilestoneSitemapEntries(): Promise<Array<{ id: number; title: string; updatedAt: string }>> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("milestone", 5000);
    return snapshots.map((snapshot) => {
      const payload = snapshot.payload as { id: number; title: string; updatedAt?: string };
      return {
        id: payload.id,
        title: payload.title,
        updatedAt: payload.updatedAt || snapshot.createdAt || new Date(0).toISOString()
      };
    });
  },

  async listCategoryEntries(): Promise<CategoryEntry[]> {
    const timelines = await platformReadModelService.listFeaturedTimelines(5000);
    const entries = new Map<string, CategoryEntry>();
    for (const timeline of timelines) {
      const slug = timeline.category.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      const existing = entries.get(slug);
      if (!existing) {
        entries.set(slug, {
          slug,
          name: timeline.category,
          count: 1,
          updatedAt: timeline.updatedAt
        });
      } else {
        existing.count += 1;
        if (timeline.updatedAt > existing.updatedAt) {
          existing.updatedAt = timeline.updatedAt;
        }
      }
    }
    return Array.from(entries.values()).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  },

  async listTags(): Promise<TagRecord[]> {
    const timelines = await platformReadModelService.listFeaturedTimelines(5000);
    const tags = new Map<number, TagRecord>();
    for (const timeline of timelines) {
      for (const tag of timeline.tags) {
        tags.set(tag.id, tag);
      }
    }
    return Array.from(tags.values()).sort((left, right) => left.name.localeCompare(right.name));
  },

  async getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
    const entries = await platformReadModelService.listCategoryEntries();
    const category = entries.find((entry) => entry.slug === slug);
    if (!category) {
      return null;
    }
    const timelines = (await platformReadModelService.listFeaturedTimelines(5000)).filter(
      (timeline) => timeline.category === category.name
    );
    return { category, timelines };
  },

  async getTagDetail(slug: string): Promise<TagDetail | null> {
    const timelines = (await platformReadModelService.listFeaturedTimelines(5000)).filter((timeline) =>
      timeline.tags.some((tag) => tag.slug === slug)
    );
    const tag = timelines.flatMap((timeline) => timeline.tags).find((item) => item.slug === slug);
    return tag ? { tag, timelines } : null;
  },

  async getMilestone(eventId: number): Promise<EventRecord | null> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("milestone", 5000);
    const match = snapshots.find((snapshot) => (snapshot.payload as { id?: number }).id === eventId);
    return match ? (match.payload as unknown as EventRecord) : null;
  },

  async getMilestoneContext(eventId: number): Promise<MilestoneContext | null> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("milestone", 5000);
    const match = snapshots.find((snapshot) => (snapshot.payload as { id?: number }).id === eventId);
    const context = match ? (match.payload as { historicalContext?: unknown }).historicalContext : null;
    return context ? (context as MilestoneContext) : null;
  },

  async getHistoricalObjectBySlug(slug: string): Promise<HistoricalObjectDetail | null> {
    return payloadAs<HistoricalObjectDetail>(await platformReadModelRepository.getPublishedReadModelBySlug("historical_object", slug));
  },

  async getEventShareContext(eventId: number): Promise<EventShareContext | null> {
    const timelines = await platformReadModelService.listFeaturedTimelines(5000);
    for (const timeline of timelines as TimelineDetail[]) {
      const event = timeline.events?.find((item) => item.id === eventId);
      if (event) {
        return {
          event,
          timeline: {
            id: timeline.id,
            slug: timeline.slug,
            title: timeline.title,
            category: timeline.category
          }
        };
      }
    }
    return null;
  },

  async searchKnowledge(query: string, limit = 12): Promise<SearchResult> {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      return { query: "", total: 0, items: [] };
    }
    const timelines = (await platformReadModelService.listFeaturedTimelines(5000)).filter((timeline) =>
      matchesQuery(`${timeline.title} ${timeline.description} ${timeline.category}`, normalized)
    );
    const items = timelines.slice(0, limit).map((timeline, index) => ({
      type: "timeline" as const,
      id: timeline.id,
      rank: limit - index,
      timeline
    }));
    return { query: normalized, total: items.length, items };
  },

  async resolveContinuity(publishedSnapshotId: string): Promise<ContinuityResolution> {
    const merge = await platformReadModelRepository.getMergeContinuity(publishedSnapshotId);
    if (merge) {
      return {
        sourcePublishedRecordId: merge.sourcePublishedRecordId,
        targetPublishedRecordId: merge.targetPublishedRecordId,
        resolutionType: "merged",
        continuityPath: merge.continuityPath
      };
    }
    const retirement = await platformReadModelRepository.getRetirementContinuity(publishedSnapshotId);
    if (retirement) {
      return {
        sourcePublishedRecordId: retirement.sourcePublishedRecordId,
        targetPublishedRecordId: null,
        resolutionType: "retired",
        continuityPath: retirement.continuityPath
      };
    }
    return {
      sourcePublishedRecordId: publishedSnapshotId,
      targetPublishedRecordId: publishedSnapshotId,
      resolutionType: "active",
      continuityPath: {}
    };
  }
};
