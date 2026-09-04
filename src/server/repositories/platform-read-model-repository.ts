import type {
  PublishedAuthorityRef,
  PublishedReadModelSnapshot,
  PublishedReadModelType
} from "@/src/server/platform/read-model-contracts";
import type { CategoryDetail, CategoryEntry, EventRecord, SearchResult, TagDetail, TagRecord } from "@/src/lib/types";
import { serverlessBackendClient } from "@/src/server/serverless/backend-client";

type BackendProjection = {
  publishedSnapshotId: string;
  projectionType: PublishedReadModelType;
  slug: string | null;
  payload: Record<string, unknown>;
  createdAt?: string;
};

function projectionToReadModel(projection: BackendProjection): PublishedReadModelSnapshot {
  return {
    snapshotId: projection.publishedSnapshotId,
    authorityRef: { authorityType: projection.projectionType, authorityId: projection.publishedSnapshotId },
    readModelType: projection.projectionType,
    slug: projection.slug,
    payload: projection.payload,
    createdAt: projection.createdAt
  };
}

async function listPublishedReadModels(type: PublishedReadModelType, limit: number, offset = 0): Promise<PublishedReadModelSnapshot[]> {
  const projections = await serverlessBackendClient.listReadModels<BackendProjection>(type, limit, offset);
  return (projections || []).map(projectionToReadModel);
}

export const platformReadModelRepository = {
  listPublishedReadModels,

  async searchPublishedReadModels(query: string, limit: number, offset: number) {
    const result = await serverlessBackendClient.search<SearchResult>(query, limit, offset);
    if (!result) return [];
    return result.items.map((item) => ({
      snapshot: projectionToReadModel({
        publishedSnapshotId: `${item.type}:${item.id}`,
        projectionType: "search",
        slug: item.type === "timeline" ? item.timeline.slug : null,
        payload: item as unknown as Record<string, unknown>
      }),
      rank: item.rank,
      total: result.total
    }));
  },

  async getPublishedReadModelBySlug(type: PublishedReadModelType, slug: string): Promise<PublishedReadModelSnapshot | null> {
    const projection = await serverlessBackendClient.getReadModel<BackendProjection>(type, { slug });
    return projection ? projectionToReadModel(projection) : null;
  },

  async getMilestone(eventId: number): Promise<EventRecord | null> {
    const projection = await serverlessBackendClient.getReadModel<BackendProjection>("milestone", { id: eventId });
    return projection ? (projection.payload as unknown as EventRecord) : null;
  },

  async getRelationshipByRelationshipId(relationshipId: string): Promise<PublishedReadModelSnapshot | null> {
    const projection = await serverlessBackendClient.getRelationships<BackendProjection>({ relationshipId });
    return projection && !Array.isArray(projection) ? projectionToReadModel(projection) : null;
  },

  async listRelationshipsForAuthorityRef(authorityRef: PublishedAuthorityRef, limit: number): Promise<PublishedReadModelSnapshot[]> {
    const projections = await serverlessBackendClient.getRelationships<BackendProjection>({
      authorityKey: `${authorityRef.authorityType}:${authorityRef.authorityId}`,
      limit
    });
    return (Array.isArray(projections) ? projections : []).map(projectionToReadModel);
  },

  async listCategories(): Promise<CategoryEntry[]> {
    return (await serverlessBackendClient.listCategories<CategoryEntry>()) || [];
  },

  async listTags(): Promise<TagRecord[]> {
    return (await serverlessBackendClient.listTags<TagRecord>()) || [];
  },

  getCategoryDetail(slug: string): Promise<CategoryDetail | null> {
    return serverlessBackendClient.getCategory<CategoryDetail>(slug);
  },

  getTagDetail(slug: string): Promise<TagDetail | null> {
    return serverlessBackendClient.getTag<TagDetail>(slug);
  },

  async listSitemapDocuments() {
    return (await serverlessBackendClient.listSitemap<Record<string, unknown>>()) || [];
  },

  async getMergeContinuity(sourcePublishedRecordId: string): Promise<{
    sourcePublishedRecordId: string;
    targetPublishedRecordId: string | null;
    continuityPath: Record<string, unknown>;
  } | null> {
    const continuity = await serverlessBackendClient.getContinuity<{
      sourcePublishedSnapshotId: string;
      targetPublishedSnapshotId: string | null;
      continuityType: "merged" | "retired";
      continuityPath: Record<string, unknown>;
    }>(sourcePublishedRecordId);
    return continuity?.continuityType === "merged" ? {
      sourcePublishedRecordId: continuity.sourcePublishedSnapshotId,
      targetPublishedRecordId: continuity.targetPublishedSnapshotId,
      continuityPath: continuity.continuityPath
    } : null;
  },

  async getRetirementContinuity(publishedSnapshotId: string): Promise<{
    sourcePublishedRecordId: string;
    continuityPath: Record<string, unknown>;
  } | null> {
    const continuity = await serverlessBackendClient.getContinuity<{
      sourcePublishedSnapshotId: string;
      continuityType: "merged" | "retired";
      continuityPath: Record<string, unknown>;
    }>(publishedSnapshotId);
    return continuity?.continuityType === "retired" ? {
      sourcePublishedRecordId: continuity.sourcePublishedSnapshotId,
      continuityPath: continuity.continuityPath
    } : null;
  }
};
