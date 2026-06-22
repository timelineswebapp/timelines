import type {
  CategoryDetail,
  CategoryEntry,
  EventRecord,
  EventShareContext,
  MilestoneSearchSummary,
  SearchResultItem,
  HistoricalObjectDetail,
  MilestoneContext,
  SearchResult,
  TagDetail,
  TagRecord,
  TimelineDetail,
  TimelineSummary
} from "@/src/lib/types";
import { normalizeQuery } from "@/src/lib/utils";
import type {
  ContinuityResolution,
  PublishedAuthorityRef,
  PublishedReadModelSnapshot,
  RelatedAuthorityReadModel,
  RelationshipReadModel
} from "@/src/server/platform/read-model-contracts";
import { platformReadModelRepository } from "@/src/server/repositories/platform-read-model-repository";

const MAX_RELATIONSHIP_READ_LIMIT = 100;

function payloadAs<T>(snapshot: PublishedReadModelSnapshot | null): T | null {
  return snapshot ? (snapshot.payload as T) : null;
}

function matchesQuery(value: string, normalizedQuery: string) {
  return value.toLowerCase().includes(normalizedQuery);
}

function searchText(payload: Record<string, unknown>) {
  const directText = payload.searchableText;
  if (typeof directText === "string") {
    return directText;
  }
  return JSON.stringify(payload);
}

function clampRelationshipLimit(limit: number) {
  if (!Number.isFinite(limit)) {
    return 25;
  }
  return Math.max(1, Math.min(MAX_RELATIONSHIP_READ_LIMIT, Math.trunc(limit)));
}

function isAuthorityRef(value: unknown): value is PublishedAuthorityRef {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.authorityType === "string" && typeof candidate.authorityId === "string";
}

function otherAuthorityRef(relationship: RelationshipReadModel, authorityRef: PublishedAuthorityRef): PublishedAuthorityRef | null {
  const sourceMatches =
    relationship.source_authority_ref.authorityType === authorityRef.authorityType &&
    relationship.source_authority_ref.authorityId === authorityRef.authorityId;
  const targetMatches =
    relationship.target_authority_ref.authorityType === authorityRef.authorityType &&
    relationship.target_authority_ref.authorityId === authorityRef.authorityId;

  if (sourceMatches) {
    return relationship.target_authority_ref;
  }
  if (targetMatches) {
    return relationship.source_authority_ref;
  }
  return null;
}

function relationshipFromSnapshot(snapshot: PublishedReadModelSnapshot): RelationshipReadModel | null {
  const payload = snapshot.payload;
  const relationshipId = typeof payload.relationship_id === "string" ? payload.relationship_id : typeof payload.id === "string" ? payload.id : null;
  const sourceRef = payload.source_authority_ref;
  const targetRef = payload.target_authority_ref;
  if (!relationshipId || !isAuthorityRef(sourceRef) || !isAuthorityRef(targetRef) || typeof payload.relationship_type !== "string") {
    return null;
  }

  return {
    id: relationshipId,
    relationship_id: relationshipId,
    publishedSnapshotId: snapshot.snapshotId,
    source_authority_ref: sourceRef,
    target_authority_ref: targetRef,
    relationship_type: payload.relationship_type,
    summary: typeof payload.summary === "string" ? payload.summary : "",
    evidence_refs: Array.isArray(payload.evidence_refs) ? (payload.evidence_refs as Array<Record<string, unknown>>) : [],
    provenance: payload.provenance && typeof payload.provenance === "object" ? (payload.provenance as Record<string, unknown>) : {},
    authority_state: typeof payload.authority_state === "string" ? payload.authority_state : "published",
    published_state: payload.published_state && typeof payload.published_state === "object" ? (payload.published_state as Record<string, unknown>) : {},
    continuity_metadata:
      payload.continuity_metadata && typeof payload.continuity_metadata === "object" ? (payload.continuity_metadata as Record<string, unknown>) : {}
  };
}

function relatedAuthoritiesByType(
  relationships: RelationshipReadModel[],
  authorityRef: PublishedAuthorityRef,
  authorityType: string,
  limit: number
): RelatedAuthorityReadModel[] {
  const related = new Map<string, RelatedAuthorityReadModel>();
  for (const relationship of relationships) {
    const ref = otherAuthorityRef(relationship, authorityRef);
    if (!ref || ref.authorityType !== authorityType) {
      continue;
    }
    const key = `${ref.authorityType}:${ref.authorityId}`;
    const existing = related.get(key);
    if (existing) {
      existing.relationships.push(relationship);
    } else {
      related.set(key, { authorityRef: ref, relationships: [relationship] });
    }
    if (related.size >= limit) {
      break;
    }
  }
  return Array.from(related.values());
}

function projectionToSearchItem(payload: Record<string, unknown>, rank: number): SearchResultItem | null {
  if (payload.type === "timeline" && typeof payload.id === "number" && payload.timeline && typeof payload.timeline === "object") {
    return {
      type: "timeline",
      id: payload.id,
      rank,
      timeline: payload.timeline as TimelineSummary
    };
  }
  if (payload.type === "milestone" && typeof payload.id === "number" && payload.milestone && typeof payload.milestone === "object") {
    return {
      type: "milestone",
      id: payload.id,
      rank,
      milestone: payload.milestone as MilestoneSearchSummary
    };
  }
  return null;
}

function sitemapEntriesFromProjection(payload: Record<string, unknown>): {
  timelines: Array<{ slug: string; updatedAt: string }>;
  milestones: Array<{ id: number; title: string; updatedAt: string }>;
} {
  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  const timelines: Array<{ slug: string; updatedAt: string }> = [];
  const milestones: Array<{ id: number; title: string; updatedAt: string }> = [];

  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const candidate = entry as Record<string, unknown>;
    const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : new Date(0).toISOString();
    if (candidate.kind === "timeline" && typeof candidate.slug === "string") {
      timelines.push({ slug: candidate.slug, updatedAt });
    }
    if (candidate.kind === "milestone" && typeof candidate.id === "number" && typeof candidate.title === "string") {
      milestones.push({ id: candidate.id, title: candidate.title, updatedAt });
    }
  }

  return { timelines, milestones };
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
    const sitemapSnapshots = await platformReadModelRepository.listPublishedReadModels("sitemap", 5000);
    const projectedEntries = sitemapSnapshots.flatMap((snapshot) => sitemapEntriesFromProjection(snapshot.payload).timelines);
    if (projectedEntries.length > 0) {
      return projectedEntries;
    }

    const snapshots = await platformReadModelRepository.listPublishedReadModels("timeline", 5000);
    return snapshots
      .filter((snapshot) => snapshot.slug)
      .map((snapshot) => ({
        slug: snapshot.slug as string,
        updatedAt: snapshot.createdAt || new Date(0).toISOString()
      }));
  },

  async listMilestoneSitemapEntries(): Promise<Array<{ id: number; title: string; updatedAt: string }>> {
    const sitemapSnapshots = await platformReadModelRepository.listPublishedReadModels("sitemap", 5000);
    const projectedEntries = sitemapSnapshots.flatMap((snapshot) => sitemapEntriesFromProjection(snapshot.payload).milestones);
    if (projectedEntries.length > 0) {
      return projectedEntries;
    }

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

  async getRelationshipById(relationshipId: string): Promise<RelationshipReadModel | null> {
    const snapshot = await platformReadModelRepository.getRelationshipByRelationshipId(relationshipId);
    return snapshot ? relationshipFromSnapshot(snapshot) : null;
  },

  async listRelationshipsForAuthorityRef(authorityRef: PublishedAuthorityRef, limit = 25): Promise<RelationshipReadModel[]> {
    const snapshots = await platformReadModelRepository.listRelationshipsForAuthorityRef(authorityRef, clampRelationshipLimit(limit));
    return snapshots.map(relationshipFromSnapshot).filter((relationship): relationship is RelationshipReadModel => Boolean(relationship));
  },

  async listRelatedObjects(authorityRef: PublishedAuthorityRef, limit = 25): Promise<RelatedAuthorityReadModel[]> {
    const boundedLimit = clampRelationshipLimit(limit);
    const relationships = await platformReadModelService.listRelationshipsForAuthorityRef(authorityRef, boundedLimit);
    return relatedAuthoritiesByType(relationships, authorityRef, "historical_object", boundedLimit);
  },

  async listRelatedMilestones(authorityRef: PublishedAuthorityRef, limit = 25): Promise<RelatedAuthorityReadModel[]> {
    const boundedLimit = clampRelationshipLimit(limit);
    const relationships = await platformReadModelService.listRelationshipsForAuthorityRef(authorityRef, boundedLimit);
    return relatedAuthoritiesByType(relationships, authorityRef, "milestone", boundedLimit);
  },

  async listRelatedTimelines(authorityRef: PublishedAuthorityRef, limit = 25): Promise<RelatedAuthorityReadModel[]> {
    const boundedLimit = clampRelationshipLimit(limit);
    const relationships = await platformReadModelService.listRelationshipsForAuthorityRef(authorityRef, boundedLimit);
    return relatedAuthoritiesByType(relationships, authorityRef, "timeline", boundedLimit);
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
    const searchSnapshots = await platformReadModelRepository.listPublishedReadModels("search", 5000);
    const projectedItems = searchSnapshots
      .filter((snapshot) => matchesQuery(searchText(snapshot.payload), normalized))
      .map((snapshot, index) => projectionToSearchItem(snapshot.payload, limit - index))
      .filter((item): item is SearchResultItem => Boolean(item))
      .slice(0, limit);
    if (projectedItems.length > 0) {
      return { query: normalized, total: projectedItems.length, items: projectedItems };
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
