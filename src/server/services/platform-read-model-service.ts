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

// Founder-directed public-publication hold. The underlying published record,
// provenance, and certification state are deliberately retained; this list only
// controls reader exposure until the hold is formally lifted.
const PUBLIC_PUBLICATION_HOLD_TIMELINE_SLUGS = new Set([
  "the-fall-of-the-berlin-wall"
]);

function isHeldFromPublicPublication(slug: string): boolean {
  return PUBLIC_PUBLICATION_HOLD_TIMELINE_SLUGS.has(slug);
}

function filterPublicTimelineExposure<T extends { slug: string }>(timelines: T[]): T[] {
  return timelines.filter((timeline) => !isHeldFromPublicPublication(timeline.slug));
}

function isPublicMilestoneExposureAllowed(milestone: EventRecord): boolean {
  const timelineLinks = milestone.timelineLinks || [];
  return timelineLinks.length === 0 || timelineLinks.some((timeline) => !isHeldFromPublicPublication(timeline.slug));
}

type HeldTimelinePublicationMetadata = {
  milestoneIds: Set<number>;
  tagSlugs: Set<string>;
};

async function heldTimelinePublicationMetadata(): Promise<HeldTimelinePublicationMetadata | null> {
  const eventIds = new Set<number>();
  const tagSlugs = new Set<string>();
  // The hold set is deliberately small and founder-owned. Reading these
  // records server-side keeps the sitemap from advertising a held timeline's
  // milestone routes without exposing the record to a reader.
  for (const slug of PUBLIC_PUBLICATION_HOLD_TIMELINE_SLUGS) {
    const snapshot = await platformReadModelRepository.getPublishedReadModelBySlug("timeline", slug);
    if (!snapshot) {
      return null;
    }
    const payload = snapshot.payload as Partial<TimelineDetail>;
    if (
      !Array.isArray(payload.events) ||
      payload.events.some((event) => !event || typeof event.id !== "number") ||
      !Array.isArray(payload.tags) ||
      payload.tags.some((tag) => !tag || typeof tag.slug !== "string")
    ) {
      return null;
    }
    for (const event of payload.events) {
      eventIds.add(event.id);
    }
    for (const tag of payload.tags) {
      tagSlugs.add(tag.slug);
    }
  }
  return { milestoneIds: eventIds, tagSlugs };
}

function payloadAs<T>(snapshot: PublishedReadModelSnapshot | null): T | null {
  return snapshot ? (snapshot.payload as T) : null;
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

  async listFeaturedTimelines(limit = 12, offset = 0): Promise<TimelineSummary[]> {
    // The current hold set is deliberately bounded. Fetch one extra projection
    // per hold so regular public lists retain their requested cardinality without
    // introducing an unbounded scan of Published Memory.
    const snapshots = await platformReadModelRepository.listPublishedReadModels(
      "timeline",
      Math.min(50, limit + PUBLIC_PUBLICATION_HOLD_TIMELINE_SLUGS.size),
      offset
    );
    return filterPublicTimelineExposure(
      snapshots.map((snapshot) => snapshot.payload as unknown as TimelineDetail | TimelineSummary)
    ).slice(0, limit);
  },

  async getTimelineBySlug(slug: string): Promise<TimelineDetail | null> {
    if (isHeldFromPublicPublication(slug)) return null;
    const timeline = payloadAs<TimelineDetail>(await platformReadModelRepository.getPublishedReadModelBySlug("timeline", slug));
    return timeline ? { ...timeline, relatedTimelines: filterPublicTimelineExposure(timeline.relatedTimelines) } : null;
  },

  async resolveTimelineRoute(slug: string): Promise<{ timeline: TimelineDetail | null; redirectSlug: string | null }> {
    const timeline = await platformReadModelService.getTimelineBySlug(slug);
    return { timeline, redirectSlug: null };
  },

  async listStaticSlugs(limit = 50): Promise<string[]> {
    const snapshots = await platformReadModelRepository.listPublishedReadModels("timeline", limit);
    return snapshots
      .map((snapshot) => snapshot.slug)
      .filter((slug): slug is string => typeof slug === "string" && !isHeldFromPublicPublication(slug));
  },

  async listSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string }>> {
    const documents = await platformReadModelRepository.listSitemapDocuments();
    return documents
      .filter((document) => document.kind === "timeline" && typeof document.slug === "string" && !isHeldFromPublicPublication(document.slug))
      .map((document) => ({ slug: document.slug as string, updatedAt: String(document.updatedAt || new Date(0).toISOString()) }));
  },

  async listMilestoneSitemapEntries(): Promise<Array<{ id: number; title: string; updatedAt: string }>> {
    const [documents, heldMetadata] = await Promise.all([
      platformReadModelRepository.listSitemapDocuments(),
      heldTimelinePublicationMetadata()
    ]);
    // If the source of the public hold cannot be verified, do not publish any
    // milestone sitemap entries. This prevents a transient backend failure from
    // silently re-promoting Berlin through search engines.
    if (heldMetadata === null) return [];
    return documents
      .filter((document) => document.kind === "milestone" && typeof document.id === "number" && !heldMetadata.milestoneIds.has(document.id) && typeof document.title === "string")
      .map((document) => ({ id: document.id as number, title: document.title as string, updatedAt: String(document.updatedAt || new Date(0).toISOString()) }));
  },

  async listCategoryEntries(): Promise<CategoryEntry[]> {
    return platformReadModelRepository.listCategories();
  },

  async listTags(): Promise<TagRecord[]> {
    const [tags, heldMetadata] = await Promise.all([
      platformReadModelRepository.listTags(),
      heldTimelinePublicationMetadata()
    ]);
    // Tag index routes are reader promotion surfaces too. Do not emit any of
    // them if the held record cannot be verified server-side.
    if (heldMetadata === null) return [];
    return tags.filter((tag) => !heldMetadata.tagSlugs.has(tag.slug));
  },

  async getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
    const detail = await platformReadModelRepository.getCategoryDetail(slug);
    return detail ? { ...detail, timelines: filterPublicTimelineExposure(detail.timelines) } : null;
  },

  async getTagDetail(slug: string): Promise<TagDetail | null> {
    const heldMetadata = await heldTimelinePublicationMetadata();
    if (heldMetadata === null || heldMetadata.tagSlugs.has(slug)) return null;
    const detail = await platformReadModelRepository.getTagDetail(slug);
    return detail ? { ...detail, timelines: filterPublicTimelineExposure(detail.timelines) } : null;
  },

  async getMilestone(eventId: number): Promise<EventRecord | null> {
    const milestone = await platformReadModelRepository.getMilestone(eventId);
    if (!milestone || !isPublicMilestoneExposureAllowed(milestone)) return null;
    return {
      ...milestone,
      timelineLinks: milestone.timelineLinks?.filter((timeline) => !isHeldFromPublicPublication(timeline.slug))
    };
  },

  async getMilestoneContext(eventId: number): Promise<MilestoneContext | null> {
    const milestone = await platformReadModelService.getMilestone(eventId);
    const context = milestone?.historicalContext;
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
    const event = await platformReadModelService.getMilestone(eventId);
    const link = event?.timelineLinks?.[0];
    if (!event || !link) return null;
    const timeline = await platformReadModelService.getTimelineBySlug(link.slug);
    return timeline ? { event, timeline: { id: timeline.id, slug: timeline.slug, title: timeline.title, category: timeline.category } } : null;
  },

  async searchKnowledge(query: string, limit = 12, offset = 0): Promise<SearchResult> {
    const normalized = normalizeQuery(query);
    if (!normalized) {
      return { query: "", total: 0, items: [] };
    }
    const boundedLimit = Math.max(1, Math.min(50, Math.trunc(limit)));
    const boundedOffset = Math.max(0, Math.min(10_000, Math.trunc(offset)));
    const { matches, total } = await platformReadModelRepository.searchPublishedReadModels(normalized, boundedLimit, boundedOffset);
    const allProjectedItems = matches
      .map(({ snapshot, rank }) => projectionToSearchItem(snapshot.payload, rank))
      .filter((item): item is SearchResultItem => Boolean(item))
      .filter((item) => item.type !== "timeline" || !isHeldFromPublicPublication(item.timeline.slug))
      .filter((item) => item.type !== "milestone" || item.milestone.timelineLinks.some((timeline) => !isHeldFromPublicPublication(timeline.slug)));
    const projectedItems = allProjectedItems.slice(0, boundedLimit);
    // A public hold must not advertise a hidden match in a direct search.
    // The backend remains the authoritative full corpus; this bounded reader
    // result intentionally reports only the currently exposable page.
    return {
      query: normalized,
      total: Math.max(0, total - (matches.length - allProjectedItems.length)),
      items: projectedItems
    };
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
