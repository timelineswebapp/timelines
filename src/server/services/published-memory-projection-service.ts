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
import type { EventRecord, TimelineDetail, TimelineSummary } from "@/src/lib/types";
import {
  projectionDtoMetadata,
  validateProjectionDto
} from "@/src/server/platform/projection-dto-contracts";
import { ApiError } from "@/src/server/api/responses";

const DEFAULT_REBUILD_BATCH_SIZE = 500;

function stableTimelineId(value: string): number {
  const hex = value.replace(/[^a-f0-9]/gi, "").slice(0, 12) || "1";
  return (Number.parseInt(hex, 16) % 2_147_483_647) + 1;
}

function slugifyProjection(value: string): string {
  return value
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "publication-package";
}

function packageDescription(payload: Record<string, unknown>): string {
  const packageScope = payload.packageScope;
  if (packageScope && typeof packageScope === "object" && !Array.isArray(packageScope)) {
    const description = (packageScope as Record<string, unknown>).description;
    if (typeof description === "string" && description.trim() &&
        !/\b(?:candidate|factory|pipeline|draft|governance|not submitted)\b/i.test(description)) {
      return description.trim();
    }
  }
  return "Published timeline context package.";
}

function publicationPackageTitle(payload: Record<string, unknown>): string {
  for (const candidate of [payload.title, payload.subject, payload.name]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  const description = packageDescription(payload);
  const inferred = description.match(/^(.+?)\s+(?:inaugural|institutional|timeline|publication|package)\b/i);
  return inferred?.[1]?.trim() || "Publication Package Timeline";
}

function canonicalSubjectFromSnapshot(snapshot: PublishedMemorySnapshot): string | null {
  const payload = projectionPayload(snapshot.snapshot);
  const provenance = snapshot.snapshot.provenance;
  for (const candidate of [
    payload.canonicalSubject,
    provenance && typeof provenance === "object" && !Array.isArray(provenance)
      ? (provenance as Record<string, unknown>).canonicalSubject
      : null
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return null;
}

function admissionTimelineTitle(snapshots: readonly PublishedMemorySnapshot[], fallbackSnapshot: PublishedMemorySnapshot): string {
  for (const snapshot of snapshots) {
    const canonicalSubject = canonicalSubjectFromSnapshot(snapshot);
    if (canonicalSubject) return canonicalSubject;
  }
  return publicationPackageTitle(fallbackSnapshot.snapshot);
}

function isPublicationPackageTimelineSnapshot(snapshot: PublishedMemorySnapshot, payload: Record<string, unknown>): boolean {
  if (snapshot.authorityRef.authorityType !== "publication_package") {
    return false;
  }
  const packageScope = payload.packageScope;
  if (!packageScope || typeof packageScope !== "object" || Array.isArray(packageScope)) {
    return true;
  }
  const packageType = (packageScope as Record<string, unknown>).packageType;
  return packageType === "timeline_context_publication" || packageType === "mixed_authority_publication";
}

function inferProjectionType(snapshot: PublishedMemorySnapshot, payload: Record<string, unknown>): PublishedReadModelType {
  const explicitType = payload.readModelType;
  if (typeof explicitType === "string") {
    return explicitType as PublishedReadModelType;
  }
  if (isPublicationPackageTimelineSnapshot(snapshot, payload)) {
    return "timeline";
  }
  if (snapshot.authorityRef.authorityType === "participation") {
    return "milestone";
  }
  if (snapshot.authorityRef.authorityType === "milestone") {
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

function isTimelinePayload(payload: Record<string, unknown>) {
  return typeof payload.id === "number" && typeof payload.slug === "string" && typeof payload.title === "string" && typeof payload.category === "string";
}

function isMilestonePayload(payload: Record<string, unknown>) {
  return typeof payload.id === "number" && typeof payload.title === "string" && typeof payload.date === "string";
}

function isHistoricalObjectPayload(payload: Record<string, unknown>) {
  const object = payload.object;
  return Boolean(
    object &&
      typeof object === "object" &&
      typeof (object as Record<string, unknown>).id === "string" &&
      typeof (object as Record<string, unknown>).canonicalSlug === "string" &&
      typeof (object as Record<string, unknown>).canonicalName === "string"
  );
}

function publishedState(snapshot: PublishedMemorySnapshot) {
  return {
    published_snapshot_id: snapshot.snapshotId,
    publication_lifecycle: snapshot.lifecycle,
    published_at: snapshot.createdAt || null
  };
}

function continuityMetadata(snapshot: PublishedMemorySnapshot) {
  return {
    source_published_record_id: snapshot.snapshotId,
    continuity_state: "active"
  };
}

function seoMetadata(title: string, description: string, slug?: string | null) {
  return {
    title,
    description,
    slug: slug || null
  };
}

function ogMetadata(title: string, description: string) {
  return {
    title,
    description
  };
}

function buildTimelineDto(payload: Record<string, unknown>, snapshot: PublishedMemorySnapshot): Record<string, unknown> {
  if (isPublicationPackageTimelineSnapshot(snapshot, payload)) {
    const title = publicationPackageTitle(payload);
    const description = packageDescription(payload);
    const slug = typeof payload.slug === "string" && payload.slug.trim() ? payload.slug.trim() : slugifyProjection(title);
    const updatedAt = snapshot.createdAt || new Date(0).toISOString();
    return {
      ...payload,
      ...projectionDtoMetadata("timeline"),
      id: stableTimelineId(snapshot.snapshotId),
      slug,
      title,
      description,
      category: "Technology",
      orderingMode: "chronology",
      createdAt: snapshot.createdAt || updatedAt,
      updatedAt,
      tags: [],
      events: [],
      relatedTimelines: [],
      eventCount: 0,
      highlightedEventTitles: [],
      chronology_metadata: {
        ordering_mode: "chronology",
        event_count: 0,
        highlighted_event_titles: []
      },
      seo_metadata: seoMetadata(title, description, slug),
      og_metadata: ogMetadata(title, description),
      published_state: publishedState(snapshot),
      continuity_metadata: continuityMetadata(snapshot),
      provenance: {
        authorityRef: snapshot.authorityRef,
        admissionId: snapshot.admissionId,
        publicationPackageId: payload.publicationPackageId,
        readinessCertification: payload.readinessCertification,
        acceptanceOutcome: payload.acceptanceOutcome,
        packageScope: payload.packageScope
      }
    };
  }
  if (!isTimelinePayload(payload)) {
    return payload;
  }
  const timeline = payload as unknown as TimelineDetail | TimelineSummary;
  return {
    ...payload,
    ...projectionDtoMetadata("timeline"),
    chronology_metadata: {
      ordering_mode: timeline.orderingMode,
      event_count: timeline.eventCount,
      highlighted_event_titles: timeline.highlightedEventTitles
    },
    seo_metadata: seoMetadata(timeline.title, timeline.description, timeline.slug),
    og_metadata: ogMetadata(timeline.title, timeline.description),
    published_state: publishedState(snapshot),
    continuity_metadata: continuityMetadata(snapshot)
  };
}

function buildMilestoneDto(payload: Record<string, unknown>, snapshot: PublishedMemorySnapshot): Record<string, unknown> {
  if (snapshot.authorityRef.authorityType === "milestone" && !isMilestonePayload(payload)) {
    const title = typeof payload.title === "string" ? payload.title : "Historical milestone";
    const description =
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.summary === "string"
          ? payload.summary
          : title;
    const date = typeof payload.date === "string" ? payload.date : typeof payload.startDate === "string" ? payload.startDate : "";
    const id = stableTimelineId(snapshot.authorityRef.authorityId);
    const slug = `${id}`;
    return {
      ...payload,
      ...projectionDtoMetadata("milestone"),
      id,
      slug,
      title,
      description,
      date,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      timelineLinks: [],
      date_precision: typeof payload.datePrecision === "string" ? payload.datePrecision : "day",
      timeline_context: [],
      seo_metadata: seoMetadata(title, description, slug),
      og_metadata: ogMetadata(title, description),
      published_state: publishedState(snapshot)
    };
  }
  if (!isMilestonePayload(payload)) {
    return payload;
  }
  const milestone = payload as unknown as EventRecord;
  const slug = `${milestone.id}`;
  return {
    ...payload,
    ...projectionDtoMetadata("milestone"),
    slug,
    date_precision: milestone.datePrecision,
    timeline_context: milestone.timelineLinks || [],
    seo_metadata: seoMetadata(milestone.title, milestone.description, slug),
    og_metadata: ogMetadata(milestone.title, milestone.description),
    published_state: publishedState(snapshot)
  };
}

function buildHistoricalObjectDto(payload: Record<string, unknown>, snapshot: PublishedMemorySnapshot): Record<string, unknown> {
  if (snapshot.authorityRef.authorityType === "historical_object" && !isHistoricalObjectPayload(payload)) {
    const title =
      typeof payload.canonicalName === "string"
        ? payload.canonicalName
        : typeof payload.name === "string"
          ? payload.name
          : typeof payload.title === "string"
            ? payload.title
            : "Historical object";
    const description =
      typeof payload.description === "string"
        ? payload.description
        : typeof payload.summary === "string"
          ? payload.summary
          : title;
    const slug =
      typeof payload.canonicalSlug === "string" ? payload.canonicalSlug : slugifyProjection(title);
    return {
      ...payload,
      ...projectionDtoMetadata("historical_object"),
      id: snapshot.authorityRef.authorityId,
      slug,
      title,
      description,
      object_type: typeof payload.primaryType === "string" ? payload.primaryType : "entity",
      relationship_summary: {
        participations: 0,
        related_milestones: 0,
        related_timelines: 0
      },
      published_state: publishedState(snapshot)
    };
  }
  if (!isHistoricalObjectPayload(payload)) {
    return payload;
  }
  const object = (payload.object || {}) as Record<string, unknown>;
  const title = String(object.canonicalName);
  return {
    ...payload,
    ...projectionDtoMetadata("historical_object"),
    id: object.id,
    slug: object.canonicalSlug,
    title,
    description: object.description,
    object_type: object.primaryType,
    relationship_summary: {
      participations: Array.isArray(payload.participations) ? payload.participations.length : 0,
      related_milestones: Array.isArray(payload.relatedMilestones) ? payload.relatedMilestones.length : 0,
      related_timelines: Array.isArray(payload.relatedTimelines) ? payload.relatedTimelines.length : 0
    },
    published_state: publishedState(snapshot)
  };
}

function buildRelationshipDto(payload: Record<string, unknown>, snapshot: PublishedMemorySnapshot): Record<string, unknown> {
  const relationshipId = payload.relationship_id || payload.id || payload.relationshipId || snapshot.authorityRef.authorityId;
  return {
    ...payload,
    ...projectionDtoMetadata("relationship"),
    relationship_id: relationshipId,
    id: relationshipId,
    source_authority_ref: payload.source_authority_ref || payload.sourceAuthorityRef || null,
    target_authority_ref: payload.target_authority_ref || payload.targetAuthorityRef || null,
    relationship_type: payload.relationship_type || payload.relationshipType || "related_to",
    summary: payload.summary || "",
    evidence_refs: payload.evidence_refs || payload.evidenceRefs || [],
    provenance: payload.provenance || {},
    authority_state: payload.authority_state || payload.authorityState || "active",
    continuity_metadata: payload.continuity_metadata || payload.continuityMetadata || continuityMetadata(snapshot),
    published_state: publishedState(snapshot)
  };
}

function buildPrimaryDto(type: PublishedReadModelType, payload: Record<string, unknown>, snapshot: PublishedMemorySnapshot): Record<string, unknown> {
  if (type === "timeline") {
    return buildTimelineDto(payload, snapshot);
  }
  if (type === "milestone") {
    return buildMilestoneDto(payload, snapshot);
  }
  if (type === "historical_object") {
    return buildHistoricalObjectDto(payload, snapshot);
  }
  if (type === "relationship") {
    return buildRelationshipDto(payload, snapshot);
  }
  return payload;
}

function buildSearchPayload(type: PublishedReadModelType, payload: Record<string, unknown>): Record<string, unknown> | null {
  if (type === "timeline" && isTimelinePayload(payload)) {
    const timeline = payload as unknown as TimelineDetail | TimelineSummary;
    const searchableText = `${timeline.title} ${timeline.description} ${timeline.category} ${timeline.tags.map((tag) => tag.name).join(" ")}`;
    return {
      ...projectionDtoMetadata("search"),
      type: "timeline",
      id: timeline.id,
      rank: 1,
      timeline,
      searchableText,
      entity_type: "timeline",
      entity_id: timeline.id,
      slug: timeline.slug,
      title: timeline.title,
      description: timeline.description,
      searchable_text: searchableText,
      published_state: payload.published_state
    };
  }

  if (type === "milestone" && isMilestonePayload(payload)) {
    const milestone = payload as unknown as EventRecord;
    const searchableText = `${milestone.title} ${milestone.description} ${milestone.location || ""} ${milestone.tags.map((tag) => tag.name).join(" ")}`;
    const slug = typeof payload.slug === "string" ? payload.slug : `${milestone.id}`;
    return {
      ...projectionDtoMetadata("search"),
      type: "milestone",
      id: milestone.id,
      rank: 1,
      milestone,
      searchableText,
      entity_type: "milestone",
      entity_id: milestone.id,
      slug,
      title: milestone.title,
      description: milestone.description,
      searchable_text: searchableText,
      published_state: payload.published_state
    };
  }

  return null;
}

function buildSitemapPayload(type: PublishedReadModelType, slug: string | null, payload: Record<string, unknown>, createdAt?: string): Record<string, unknown> | null {
  if (type === "timeline" && typeof slug === "string") {
    const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : createdAt || new Date(0).toISOString();
    return {
      ...projectionDtoMetadata("sitemap"),
      entries: [{ kind: "timeline", slug, updatedAt }],
      canonical_url: `/timeline/${slug}`,
      last_modified: updatedAt,
      entity_type: "timeline",
      published_state: payload.published_state
    };
  }

  if (type === "milestone" && typeof payload.id === "number" && typeof payload.title === "string") {
    const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : createdAt || new Date(0).toISOString();
    return {
      ...projectionDtoMetadata("sitemap"),
      entries: [{ kind: "milestone", id: payload.id, title: payload.title, updatedAt }],
      canonical_url: `/milestone/${payload.id}`,
      last_modified: updatedAt,
      entity_type: "milestone",
      published_state: payload.published_state
    };
  }

  return null;
}

async function generateProjectionBundleFromSnapshot(input: {
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
  const rawPayload = projectionPayload(source);
  const projectionType = inferProjectionType(input.snapshot, source);
  const payload = buildPrimaryDto(projectionType, rawPayload, input.snapshot);
  validateProjectionDto(projectionType, payload);
  const slug = projectionSlug(source, payload);
  const primaryProjection = await publishedMemoryProjectionRepository.upsertProjection({
    publishedSnapshotId: input.snapshot.snapshotId,
    projectionType,
    slug,
    payload,
    sourceEventType: input.sourceEventType,
    sourceEventId: input.sourceEventId,
    auditRecordId: input.auditRecordId,
    lineage: input.lineage
  });
  const searchPayload = buildSearchPayload(projectionType, payload);
  const sitemapPayload = buildSitemapPayload(projectionType, slug, payload, input.snapshot.createdAt);
  if (searchPayload) {
    validateProjectionDto("search", searchPayload);
  }
  if (sitemapPayload) {
    validateProjectionDto("sitemap", sitemapPayload);
  }
  const companionProjections = await Promise.all(
    [
      searchPayload
        ? publishedMemoryProjectionRepository.upsertProjection({
            publishedSnapshotId: input.snapshot.snapshotId,
            projectionType: "search",
            slug,
            payload: searchPayload,
            sourceEventType: input.sourceEventType,
            sourceEventId: input.sourceEventId,
            auditRecordId: input.auditRecordId,
            lineage: input.lineage
          })
        : null,
      sitemapPayload
        ? publishedMemoryProjectionRepository.upsertProjection({
            publishedSnapshotId: input.snapshot.snapshotId,
            projectionType: "sitemap",
            slug,
            payload: sitemapPayload,
            sourceEventType: input.sourceEventType,
            sourceEventId: input.sourceEventId,
            auditRecordId: input.auditRecordId,
            lineage: input.lineage
          })
        : null
    ].filter((projection): projection is Promise<Awaited<ReturnType<typeof publishedMemoryProjectionRepository.upsertProjection>>> => Boolean(projection))
  );

  return {
    primaryProjection,
    companionProjections
  };
}

async function generateAdmissionTimeline(input: {
  admissionId: string;
  snapshots: PublishedMemorySnapshot[];
  auditRecordId?: string | null;
  sourceEventType?: "admission" | "rebuild";
}) {
  const milestoneSnapshots = input.snapshots
    .filter((snapshot) => snapshot.authorityRef.authorityType === "milestone")
    .sort((left, right) => left.authorityRef.authorityId.localeCompare(right.authorityRef.authorityId));
  if (milestoneSnapshots.length === 0) {
    return null;
  }
  const anchor = milestoneSnapshots[0]!;
  await publishedMemoryProjectionRepository.supersedeOtherAdmissionTimelines(input.admissionId, anchor.snapshotId);
  const events = milestoneSnapshots
    .map((snapshot) => buildMilestoneDto(projectionPayload(snapshot.snapshot), snapshot))
    .sort((left, right) => String(left.date).localeCompare(String(right.date)) || String(left.title).localeCompare(String(right.title)));
  const title = admissionTimelineTitle(milestoneSnapshots, anchor);
  const description = packageDescription(anchor.snapshot);
  const slug = slugifyProjection(title);
  const timelinePayload = buildTimelineDto(
    {
      id: stableTimelineId(input.admissionId),
      slug,
      title,
      description,
      category: "Technology",
      orderingMode: "chronology",
      createdAt: anchor.createdAt || new Date(0).toISOString(),
      updatedAt: anchor.createdAt || new Date(0).toISOString(),
      tags: [],
      events,
      relatedTimelines: [],
      eventCount: events.length,
      highlightedEventTitles: events.slice(0, 3).map((event) => String(event.title))
    },
    anchor
  );
  validateProjectionDto("timeline", timelinePayload);
  const primaryProjection = await publishedMemoryProjectionRepository.upsertProjection({
    publishedSnapshotId: anchor.snapshotId,
    projectionType: "timeline",
    slug,
    payload: timelinePayload,
    sourceEventType: input.sourceEventType || "admission",
    sourceEventId: input.admissionId,
    auditRecordId: input.auditRecordId
  });
  const timelineLink = {
    id: timelinePayload.id,
    slug,
    title,
    description,
    category: timelinePayload.category,
    eventCount: events.length
  };
  await Promise.all(milestoneSnapshots.map((snapshot) => {
    const milestonePayload = buildMilestoneDto(projectionPayload(snapshot.snapshot), snapshot);
    return publishedMemoryProjectionRepository.upsertProjection({
      publishedSnapshotId: snapshot.snapshotId,
      projectionType: "milestone",
      slug: projectionSlug(snapshot.snapshot, milestonePayload),
      payload: {
        ...milestonePayload,
        timelineLinks: [timelineLink],
        timeline_context: [timelineLink]
      },
      sourceEventType: input.sourceEventType || "admission",
      sourceEventId: input.admissionId,
      auditRecordId: input.auditRecordId
    });
  }));
  const searchPayload = buildSearchPayload("timeline", timelinePayload);
  const sitemapPayload = buildSitemapPayload("timeline", slug, timelinePayload, anchor.createdAt);
  const companionProjections = await Promise.all([
    searchPayload
      ? publishedMemoryProjectionRepository.upsertProjection({
          publishedSnapshotId: anchor.snapshotId,
          projectionType: "search",
          slug,
          payload: searchPayload,
          sourceEventType: input.sourceEventType || "admission",
          sourceEventId: input.admissionId,
          auditRecordId: input.auditRecordId
        })
      : null,
    sitemapPayload
      ? publishedMemoryProjectionRepository.upsertProjection({
          publishedSnapshotId: anchor.snapshotId,
          projectionType: "sitemap",
          slug,
          payload: sitemapPayload,
          sourceEventType: input.sourceEventType || "admission",
          sourceEventId: input.admissionId,
          auditRecordId: input.auditRecordId
        })
      : null
  ]);
  return { primaryProjection, companionProjections: companionProjections.filter(Boolean) };
}

export const publishedMemoryProjectionService = {
  async generateForAdmission(input: { admissionId: string; snapshots: PublishedMemorySnapshot[]; auditRecordId?: string | null }) {
    const projectableSnapshots = input.snapshots.filter((snapshot) =>
      ["historical_object", "milestone", "relationship"].includes(snapshot.authorityRef.authorityType)
    );
    const authorityProjections = await Promise.all(
      projectableSnapshots.map((snapshot) =>
        generateProjectionBundleFromSnapshot({
          snapshot,
          sourceEventType: "admission",
          sourceEventId: input.admissionId,
          auditRecordId: input.auditRecordId
        })
      )
    );
    const timelineProjection = await generateAdmissionTimeline(input);
    return { authorityProjections, timelineProjection };
  },

  async generateForRevision(revision: HistoricalLibraryRevision) {
    const snapshot = await historicalLibraryRepository.getPublishedSnapshot(revision.publishedSnapshotId);
    if (!snapshot) {
      return null;
    }
    return generateProjectionBundleFromSnapshot({
      snapshot,
      sourceEventType: "revision",
      sourceEventId: revision.revisionId,
      auditRecordId: revision.auditRecordId,
      sourceSnapshotOverride: revision.revisedSnapshot,
      lineage: { revisionId: revision.revisionId }
    });
  },

  async generateForRetirement(retirement: HistoricalLibraryRetirement) {
    const [projections, continuityProjection] = await Promise.all([
      publishedMemoryProjectionRepository.markSnapshotProjectionsLifecycle({
        publishedSnapshotId: retirement.publishedSnapshotId,
        lifecycle: "retired",
        sourceEventId: retirement.retirementId,
        auditRecordId: retirement.auditRecordId,
        lineage: { retirementId: retirement.retirementId }
      }),
      publishedMemoryProjectionRepository.upsertContinuityProjection({
        sourcePublishedSnapshotId: retirement.publishedSnapshotId,
        continuityType: "retired",
        continuityPath: retirement.continuityPath,
        sourceEventId: retirement.retirementId,
        auditRecordId: retirement.auditRecordId
      })
    ]);
    return { projections, continuityProjection };
  },

  async generateForMerge(merge: HistoricalLibraryMerge) {
    const [projections, continuityProjection] = await Promise.all([
      publishedMemoryProjectionRepository.markSnapshotProjectionsLifecycle({
        publishedSnapshotId: merge.sourcePublishedRecordId,
        lifecycle: "merged",
        sourceEventId: merge.mergeId,
        auditRecordId: merge.auditRecordId,
        lineage: { mergeId: merge.mergeId }
      }),
      publishedMemoryProjectionRepository.upsertContinuityProjection({
        sourcePublishedSnapshotId: merge.sourcePublishedRecordId,
        targetPublishedSnapshotId: merge.targetPublishedRecordId,
        continuityType: "merged",
        continuityPath: merge.continuityPath,
        sourceEventId: merge.mergeId,
        auditRecordId: merge.auditRecordId
      })
    ]);
    return { projections, continuityProjection };
  },

  async generateForPreservation(preservation: HistoricalLibraryPreservation) {
    const snapshot = await historicalLibraryRepository.getPublishedSnapshot(preservation.publishedSnapshotId);
    if (!snapshot) {
      return null;
    }
    return generateProjectionBundleFromSnapshot({
      snapshot,
      sourceEventType: "preservation",
      sourceEventId: preservation.preservationId,
      auditRecordId: preservation.auditRecordId,
      lineage: { preservationId: preservation.preservationId }
    });
  },

  async getCutoverMetrics() {
    const publishedSnapshotCount = await historicalLibraryRepository.countPublishedSnapshots();
    return publishedMemoryProjectionRepository.getCoverageMetrics(publishedSnapshotCount);
  },

  async rebuildAll(input?: { batchSize?: number; incremental?: boolean }) {
    const startedAt = new Date();
    const batchSize = input?.batchSize || DEFAULT_REBUILD_BATCH_SIZE;
    const incremental = input?.incremental === true;
    const totalSnapshots = incremental
      ? await historicalLibraryRepository.countUnprojectedPublishedSnapshots()
      : await historicalLibraryRepository.countPublishedSnapshots();
    let totalProcessed = 0;
    let generated = 0;
    let updated = 0;
    let unchanged = 0;
    let skipped = 0;
    const dtoValidationFailures: Array<Record<string, unknown>> = [];
    const rebuildFailures: Array<Record<string, unknown>> = [];
    const rebuiltAdmissionTimelines = new Set<string>();

    for (let offset = 0; offset < totalSnapshots; offset += batchSize) {
      const snapshots = incremental
        ? await historicalLibraryRepository.listUnprojectedPublishedSnapshots(batchSize, 0)
        : await historicalLibraryRepository.listPublishedSnapshots(batchSize, offset);
      for (const snapshot of snapshots) {
        totalProcessed += 1;
        if (!["historical_object", "milestone", "relationship"].includes(snapshot.authorityRef.authorityType)) {
          skipped += 1;
          continue;
        }
        try {
          const bundle = await generateProjectionBundleFromSnapshot({
            snapshot,
            sourceEventType: "rebuild",
            sourceEventId: snapshot.snapshotId
          });
          generated += 1 + bundle.companionProjections.length;
          if (bundle.primaryProjection.projectionVersion > 1 || bundle.companionProjections.some((projection) => projection.projectionVersion > 1)) {
            updated += 1;
          } else {
            unchanged += 1;
          }
          if (snapshot.authorityRef.authorityType === "milestone" && !rebuiltAdmissionTimelines.has(snapshot.admissionId)) {
            const admissionSnapshots = await historicalLibraryRepository.getPublishedSnapshotsByAdmissionId(snapshot.admissionId);
            await generateAdmissionTimeline({
              admissionId: snapshot.admissionId,
              snapshots: admissionSnapshots,
              sourceEventType: "rebuild"
            });
            rebuiltAdmissionTimelines.add(snapshot.admissionId);
          }
        } catch (error) {
          skipped += 1;
          const failure = {
            publishedSnapshotId: snapshot.snapshotId,
            projectionType: inferProjectionType(snapshot, snapshot.snapshot),
            message: error instanceof Error ? error.message : "Unknown projection rebuild failure"
          };
          if (error instanceof ApiError && error.code === "PROJECTION_DTO_CONTRACT_VIOLATION") {
            dtoValidationFailures.push(failure);
          } else {
            rebuildFailures.push(failure);
          }
        }
      }
    }

    const retiredSnapshotIds: string[] = [];
    const mergedSnapshotIds: string[] = [];
    let continuityProjectionCount = 0;
    const [totalRetirements, totalMerges] = await Promise.all([
      historicalLibraryRepository.countRetirements(),
      historicalLibraryRepository.countMerges()
    ]);

    for (let offset = 0; offset < totalRetirements; offset += batchSize) {
      const retirements = await historicalLibraryRepository.listRetirements(batchSize, offset);
      for (const retirement of retirements) {
        retiredSnapshotIds.push(retirement.publishedSnapshotId);
        await publishedMemoryProjectionRepository.upsertContinuityProjection({
          sourcePublishedSnapshotId: retirement.publishedSnapshotId,
          continuityType: "retired",
          continuityPath: retirement.continuityPath,
          sourceEventId: retirement.retirementId,
          auditRecordId: retirement.auditRecordId
        });
        continuityProjectionCount += 1;
      }
    }

    for (let offset = 0; offset < totalMerges; offset += batchSize) {
      const merges = await historicalLibraryRepository.listMerges(batchSize, offset);
      for (const merge of merges) {
        mergedSnapshotIds.push(merge.sourcePublishedRecordId);
        await publishedMemoryProjectionRepository.upsertContinuityProjection({
          sourcePublishedSnapshotId: merge.sourcePublishedRecordId,
          targetPublishedSnapshotId: merge.targetPublishedRecordId,
          continuityType: "merged",
          continuityPath: merge.continuityPath,
          sourceEventId: merge.mergeId,
          auditRecordId: merge.auditRecordId
        });
        continuityProjectionCount += 1;
      }
    }

    const reconciliation = await publishedMemoryProjectionRepository.reconcileLifecycleState({
      retiredSnapshotIds,
      mergedSnapshotIds
    });
    const coverageSummary = await publishedMemoryProjectionRepository.getCoverageMetrics(totalSnapshots);
    const completedAt = new Date();
    const failed = dtoValidationFailures.length + rebuildFailures.length;
    const status = failed > 0 ? "completed_with_failures" : "completed";
    const report = await publishedMemoryProjectionRepository.insertRebuildReport({
      status,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs: completedAt.getTime() - startedAt.getTime(),
      batchSize,
      totalProcessed,
      generated,
      updated,
      unchanged,
      failed,
      skipped,
      continuityProjectionCount,
      coverageSummary,
      dtoValidationFailures,
      rebuildFailures
    });

    return {
      rebuiltAt: completedAt.toISOString(),
      mode: incremental ? "incremental" : "full",
      report,
      reconciliation
    };
  }
};
