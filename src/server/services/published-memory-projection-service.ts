import type {
  HistoricalLibraryMerge,
  HistoricalLibraryPreservation,
  HistoricalLibraryRetirement,
  HistoricalLibraryRevision,
  PublishedMemorySnapshot
} from "@/src/server/repositories/historical-library-repository";
import { historicalLibraryRepository } from "@/src/server/repositories/historical-library-repository";
import { publishedMemoryProjectionRepository } from "@/src/server/repositories/published-memory-projection-repository";
import type { PublishedReadModelType } from "@/src/server/platform/read-model-contracts";

function inferProjectionType(snapshot: PublishedMemorySnapshot, payload: Record<string, unknown>): PublishedReadModelType {
  const explicitType = payload.readModelType;
  if (typeof explicitType === "string") {
    return explicitType as PublishedReadModelType;
  }
  if (snapshot.authorityRef.authorityType === "participation") {
    return "milestone";
  }
  if (snapshot.authorityRef.authorityType === "historical_object") {
    return "historical_object";
  }
  return "relationship";
}

function projectionPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload = source.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return source;
}

function projectionSlug(source: Record<string, unknown>, payload: Record<string, unknown>): string | null {
  for (const candidate of [source.slug, payload.slug, payload.canonicalSlug]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return null;
}

async function generateProjectionFromSnapshot(input: {
  snapshot: PublishedMemorySnapshot;
  sourceEventType: "admission" | "revision" | "preservation" | "rebuild";
  sourceEventId: string;
  auditRecordId?: string | null;
  sourceSnapshotOverride?: Record<string, unknown>;
  lineage?: {
    revisionId?: string | null;
    preservationId?: string | null;
  };
}) {
  const source = input.sourceSnapshotOverride || input.snapshot.snapshot;
  const payload = projectionPayload(source);
  const projectionType = inferProjectionType(input.snapshot, source);
  return publishedMemoryProjectionRepository.upsertProjection({
    publishedSnapshotId: input.snapshot.snapshotId,
    projectionType,
    slug: projectionSlug(source, payload),
    payload,
    sourceEventType: input.sourceEventType,
    sourceEventId: input.sourceEventId,
    auditRecordId: input.auditRecordId,
    lineage: input.lineage
  });
}

export const publishedMemoryProjectionService = {
  async generateForAdmission(input: { admissionId: string; snapshots: PublishedMemorySnapshot[]; auditRecordId?: string | null }) {
    return Promise.all(
      input.snapshots.map((snapshot) =>
        generateProjectionFromSnapshot({
          snapshot,
          sourceEventType: "admission",
          sourceEventId: input.admissionId,
          auditRecordId: input.auditRecordId
        })
      )
    );
  },

  async generateForRevision(revision: HistoricalLibraryRevision) {
    const snapshot = await historicalLibraryRepository.getPublishedSnapshot(revision.publishedSnapshotId);
    if (!snapshot) {
      return null;
    }
    return generateProjectionFromSnapshot({
      snapshot,
      sourceEventType: "revision",
      sourceEventId: revision.revisionId,
      auditRecordId: revision.auditRecordId,
      sourceSnapshotOverride: revision.revisedSnapshot,
      lineage: { revisionId: revision.revisionId }
    });
  },

  async generateForRetirement(retirement: HistoricalLibraryRetirement) {
    return publishedMemoryProjectionRepository.upsertContinuityProjection({
      sourcePublishedSnapshotId: retirement.publishedSnapshotId,
      continuityType: "retired",
      continuityPath: retirement.continuityPath,
      sourceEventId: retirement.retirementId,
      auditRecordId: retirement.auditRecordId
    });
  },

  async generateForMerge(merge: HistoricalLibraryMerge) {
    return publishedMemoryProjectionRepository.upsertContinuityProjection({
      sourcePublishedSnapshotId: merge.sourcePublishedRecordId,
      targetPublishedSnapshotId: merge.targetPublishedRecordId,
      continuityType: "merged",
      continuityPath: merge.continuityPath,
      sourceEventId: merge.mergeId,
      auditRecordId: merge.auditRecordId
    });
  },

  async generateForPreservation(preservation: HistoricalLibraryPreservation) {
    const snapshot = await historicalLibraryRepository.getPublishedSnapshot(preservation.publishedSnapshotId);
    if (!snapshot) {
      return null;
    }
    return generateProjectionFromSnapshot({
      snapshot,
      sourceEventType: "preservation",
      sourceEventId: preservation.preservationId,
      auditRecordId: preservation.auditRecordId,
      lineage: { preservationId: preservation.preservationId }
    });
  },

  async rebuildAll() {
    const snapshots = await historicalLibraryRepository.listPublishedSnapshots(5000);
    const generated = await Promise.all(
      snapshots.map((snapshot) =>
        generateProjectionFromSnapshot({
          snapshot,
          sourceEventType: "rebuild",
          sourceEventId: snapshot.snapshotId
        })
      )
    );
    return {
      rebuiltAt: new Date().toISOString(),
      projectionCount: generated.length,
      projections: generated
    };
  }
};
