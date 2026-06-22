import type {
  PublishedAuthorityRef,
  PublishedReadModelSnapshot,
  PublishedReadModelType
} from "@/src/server/platform/read-model-contracts";
import { publishedMemoryProjectionRepository } from "@/src/server/repositories/published-memory-projection-repository";

function projectionToReadModel(projection: Awaited<ReturnType<typeof publishedMemoryProjectionRepository.listActiveProjections>>[number]): PublishedReadModelSnapshot {
  return {
    snapshotId: projection.publishedSnapshotId,
    authorityRef: {
      authorityType: projection.projectionType,
      authorityId: projection.publishedSnapshotId
    },
    readModelType: projection.projectionType,
    slug: projection.slug,
    payload: projection.payload,
    createdAt: projection.createdAt
  };
}

async function listPublishedReadModels(type: PublishedReadModelType, limit: number): Promise<PublishedReadModelSnapshot[]> {
  const projections = await publishedMemoryProjectionRepository.listActiveProjections(type, limit);
  return projections.map(projectionToReadModel);
}

export const platformReadModelRepository = {
  listPublishedReadModels,

  async getPublishedReadModelBySlug(type: PublishedReadModelType, slug: string): Promise<PublishedReadModelSnapshot | null> {
    const projection = await publishedMemoryProjectionRepository.getActiveProjectionBySlug(type, slug);
    return projection ? projectionToReadModel(projection) : null;
  },

  async getRelationshipByRelationshipId(relationshipId: string): Promise<PublishedReadModelSnapshot | null> {
    const projection = await publishedMemoryProjectionRepository.getActiveRelationshipProjectionByRelationshipId(relationshipId);
    return projection ? projectionToReadModel(projection) : null;
  },

  async listRelationshipsForAuthorityRef(authorityRef: PublishedAuthorityRef, limit: number): Promise<PublishedReadModelSnapshot[]> {
    const projections = await publishedMemoryProjectionRepository.listActiveRelationshipProjectionsForAuthorityRef({
      authorityType: authorityRef.authorityType,
      authorityId: authorityRef.authorityId,
      limit
    });
    return projections.map(projectionToReadModel);
  },

  async getMergeContinuity(sourcePublishedRecordId: string) {
    const projection = await publishedMemoryProjectionRepository.getLatestContinuityProjection(sourcePublishedRecordId);
    if (projection?.continuityType !== "merged") {
      return null;
    }
    return {
      sourcePublishedRecordId: projection.sourcePublishedSnapshotId,
      targetPublishedRecordId: projection.targetPublishedSnapshotId,
      continuityPath: projection.continuityPath
    };
  },

  async getRetirementContinuity(publishedSnapshotId: string) {
    const projection = await publishedMemoryProjectionRepository.getLatestContinuityProjection(publishedSnapshotId);
    if (projection?.continuityType !== "retired") {
      return null;
    }
    return {
      sourcePublishedRecordId: projection.sourcePublishedSnapshotId,
      continuityPath: projection.continuityPath
    };
  }
};
