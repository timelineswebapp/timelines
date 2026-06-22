import type {
  CategoryEntry,
  EventRecord,
  EventShareContext,
  HistoricalObjectParticipationHistoryItem,
  SearchResult,
  TagDetail,
  TimelineDetail,
  TimelineSummary
} from "@/src/lib/types";

export type PublishedReadModelType =
  | "timeline"
  | "milestone"
  | "historical_object"
  | "relationship"
  | "search"
  | "sitemap";

export type PublishedAuthorityRef = {
  authorityType: string;
  authorityId: string;
};

export type TimelineReadModel = TimelineDetail;
export type MilestoneReadModel = EventRecord;
export type HistoricalObjectReadModel = {
  object: {
    id: string;
    canonicalName: string;
    canonicalSlug: string;
    primaryType: string;
    description: string;
  };
  aliases: string[];
  participations: HistoricalObjectParticipationHistoryItem[];
  relatedMilestones: EventRecord[];
  relatedTimelines: TimelineSummary[];
};
export type RelationshipReadModel = {
  id: string;
  relationship_id: string;
  publishedSnapshotId: string;
  source_authority_ref: PublishedAuthorityRef;
  target_authority_ref: PublishedAuthorityRef;
  relationship_type: string;
  summary: string;
  evidence_refs: Array<Record<string, unknown>>;
  provenance: Record<string, unknown>;
  authority_state: string;
  published_state: Record<string, unknown>;
  continuity_metadata: Record<string, unknown>;
};

export type RelatedAuthorityReadModel = {
  authorityRef: PublishedAuthorityRef;
  relationships: RelationshipReadModel[];
};
export type SearchReadModel = SearchResult;
export type SitemapReadModel = Array<{ slug: string; updatedAt: string }>;

export type PublishedReadModelSnapshot = {
  snapshotId: string;
  authorityRef: {
    authorityType: string;
    authorityId: string;
  };
  readModelType: PublishedReadModelType;
  slug: string | null;
  payload: Record<string, unknown>;
  createdAt?: string;
};

export type ContinuityResolution = {
  sourcePublishedRecordId: string;
  targetPublishedRecordId: string | null;
  resolutionType: "active" | "retired" | "merged";
  continuityPath: Record<string, unknown>;
};

export type RelationshipReadQuery = {
  authorityRef: PublishedAuthorityRef;
  limit: number;
};
