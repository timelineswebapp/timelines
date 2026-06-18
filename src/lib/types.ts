export type DatePrecision = "year" | "month" | "day" | "approximate";
export type TimelineOrderingMode = "chronology" | "editorial";
export type ImportFormat = "csv" | "json" | "text";
export type ImportType = "timeline_with_events" | "events_into_existing_timeline";
export type AnalyticsEventType = "timeline_view";

export type TimelineRequestStatus =
  | "pending"
  | "reviewed"
  | "planned"
  | "rejected"
  | "completed";

export interface SourceRecord {
  id: number;
  publisher: string;
  url: string;
  credibilityScore: number;
}

export interface EmbeddedSourceInput {
  title: string;
  url: string;
  publisher?: string | null;
}

export interface ImportSourceInput {
  publisher?: string | null;
  url: string;
  credibilityScore?: number | null;
}

export interface TagRecord {
  id: number;
  slug: string;
  name: string;
}

export interface EventRecord {
  id: number;
  date: string;
  datePrecision: DatePrecision;
  legacyDate?: string | null;
  displayDate?: string | null;
  sortYear?: number | null;
  sortMonth?: number | null;
  sortDay?: number | null;
  title: string;
  description: string;
  importance: number;
  location: string | null;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  sources: SourceRecord[];
  tags: TagRecord[];
  timelineLinks?: Array<{
    timelineId: number;
    slug: string;
    title: string;
    eventOrder: number;
  }>;
}

export interface TimelineSummary {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  orderingMode: TimelineOrderingMode;
  createdAt: string;
  updatedAt: string;
  tags: TagRecord[];
  eventCount: number;
  highlightedEventTitles: string[];
}

export interface TimelineDetail extends TimelineSummary {
  events: EventRecord[];
  relatedTimelines: TimelineSummary[];
}

export interface EventShareContext {
  event: EventRecord;
  timeline: Pick<TimelineSummary, "id" | "slug" | "title" | "category">;
}

export interface TagDetail {
  tag: TagRecord;
  timelines: TimelineSummary[];
}

export interface CategoryEntry {
  slug: string;
  name: string;
  count: number;
  updatedAt: string;
}

export interface CategoryDetail {
  category: CategoryEntry;
  timelines: TimelineSummary[];
}

export type CategoryGovernanceStatus = "active" | "hidden" | "merged" | "deprecated";
export type TagModerationStatus = "unreviewed" | "approved" | "needs_review" | "deprecated" | "promote_to_concept";

export interface CategoryGovernanceRecord {
  id: number | null;
  canonicalName: string;
  canonicalSlug: string;
  description: string;
  displayOrder: number;
  status: CategoryGovernanceStatus;
  timelineCount: number;
  aliasCount: number;
  redirectCount: number;
  mergeCount: number;
  isGoverned: boolean;
  rawNames: string[];
  updatedAt: string | null;
}

export interface TagGovernanceRecord {
  id: number;
  name: string;
  slug: string;
  moderationStatus: TagModerationStatus;
  usageCount: number;
  aliasCount: number;
  redirectCount: number;
  mergeCount: number;
  duplicateCandidateOf: number | null;
  promotionCandidate: boolean;
  governanceNotes: string | null;
  isGoverned: boolean;
  updatedAt: string | null;
}

export interface TaxonomyDuplicateCandidate {
  kind: "category" | "tag";
  slug: string;
  names: string[];
  count: number;
}

export interface TaxonomyGovernanceSnapshot {
  categories: CategoryGovernanceRecord[];
  tags: TagGovernanceRecord[];
  duplicateCandidates: TaxonomyDuplicateCandidate[];
  orphanedCategories: CategoryGovernanceRecord[];
  orphanedTags: TagGovernanceRecord[];
  summary: {
    governedCategories: number;
    ungovernedCategories: number;
    governedTags: number;
    unreviewedTags: number;
    orphanedTags: number;
    duplicateCandidates: number;
  };
}

export type RelationshipRecoveryRowStatus = "matched" | "unmatched" | "ambiguous" | "invalid";

export interface RelationshipRecoveryReportRow {
  file: string;
  rowNumber: number;
  timelineSlug: string;
  title: string;
  status: RelationshipRecoveryRowStatus;
  eventId: number | null;
  tags: string[];
  sources: string[];
  message: string | null;
}

export interface RelationshipRecoveryReport {
  mode: "preview" | "apply";
  generatedAt: string;
  inputPath: string;
  totals: {
    database: {
      events: number;
      timelineEvents: number;
      tags: number;
      sources: number;
      eventTags: number;
      eventSources: number;
    };
    files: number;
    csvRows: number;
    validRows: number;
    invalidRows: number;
    matchedRows: number;
    unmatchedRows: number;
    ambiguousRows: number;
    uniqueTagsSeen: number;
    uniqueSourcesSeen: number;
    tagsToCreate: number;
    sourcesToCreate: number;
    tagLinksPreExisting: number;
    tagLinksToInsert: number;
    tagLinksInserted: number;
    sourceLinksPreExisting: number;
    sourceLinksToInsert: number;
    sourceLinksInserted: number;
  };
  rows: RelationshipRecoveryReportRow[];
}

export interface SearchResult {
  query: string;
  total: number;
  items: SearchResultItem[];
}

export interface MilestoneSearchSummary {
  id: number;
  title: string;
  description: string;
  date: string;
  datePrecision: DatePrecision;
  legacyDate?: string | null;
  displayDate?: string | null;
  sortYear?: number | null;
  sortMonth?: number | null;
  sortDay?: number | null;
  location: string | null;
  sources: SourceRecord[];
  tags: TagRecord[];
  timelineLinks: NonNullable<EventRecord["timelineLinks"]>;
}

export type SearchResultItem =
  | {
      type: "timeline";
      id: number;
      rank: number;
      timeline: TimelineSummary;
    }
  | {
      type: "milestone";
      id: number;
      rank: number;
      milestone: MilestoneSearchSummary;
    };

export interface TimelineRequestRecord {
  id: number;
  query: string;
  normalizedQuery: string;
  ipHash: string;
  language: string;
  status: TimelineRequestStatus;
  createdAt: string;
}

export interface DashboardOverview {
  totals: {
    timelines: number;
    events: number;
    sources: number;
    tags: number;
    requests: number;
  };
  requestStatusBreakdown: Array<{
    status: TimelineRequestStatus;
    count: number;
  }>;
  latestRequests: TimelineRequestRecord[];
}

export interface AnalyticsSnapshot {
  contentVelocity: {
    timelinesLast30Days: number;
    eventsLast30Days: number;
    requestsLast30Days: number;
  };
  operational: {
    gaConfigured: boolean;
    adsConfigured: boolean;
    databaseConfigured: boolean;
  };
  topCategories: Array<{
    category: string;
    count: number;
  }>;
}

export interface MetricDistribution {
  label: string;
  value: number;
}

export interface TimeSeriesPoint {
  label: string;
  value: number;
}

export interface RankedTimelineMetric {
  timelineId: number;
  title: string;
  slug: string;
  views: number;
  eventOpenRate: number;
  avgReadTime: number;
}

export interface RankedEventMetric {
  eventId: number;
  title: string;
  views: number;
  eventOpenRate: number;
  avgReadTime: number;
}

export interface SearchQueryMetric {
  query: string;
  total: number;
}

export interface TimelineViewEventInput {
  timelineId: number;
  slug: string;
  sessionId?: string | null;
  userId?: string | null;
  country?: string | null;
  device?: string | null;
  referrer?: string | null;
  metadata?: Record<string, unknown>;
}

export interface AdminAnalyticsReport {
  audience: {
    usersToday: number;
    usersWeek: number;
    usersMonth: number;
    newUsers: number;
    returningUsers: number;
    countryDistribution: MetricDistribution[];
    deviceDistribution: MetricDistribution[];
    browserDistribution: MetricDistribution[];
  };
  behavior: {
    avgSessionDuration: number;
    timelinesPerSession: number;
    eventsOpenedPerSession: number;
    bounceRate: number;
    visitsByHour: TimeSeriesPoint[];
    visitsByDay: TimeSeriesPoint[];
  };
  contentPerformance: {
    timelineViewsToday: number;
    timelineViews7d: number;
    timelineViews30d: number;
    topTimelines: RankedTimelineMetric[];
    topEvents: RankedEventMetric[];
  };
  searchIntelligence: {
    topSearchQueries: SearchQueryMetric[];
    noResultSearches: number;
    searchClickRate: number;
  };
  growth: {
    trafficOverTime: TimeSeriesPoint[];
    searchesOverTime: TimeSeriesPoint[];
    timelineViewsOverTime: TimeSeriesPoint[];
  };
  trackingConfigured: boolean;
}

export type AdSlotKey =
  | "home_feed_ad"
  | "timeline_inline_1"
  | "timeline_inline_2"
  | "timeline_bottom"
  | "search_bottom";

export type AdCampaignStatus = "draft" | "active" | "paused" | "completed";

export interface AdCampaignRecord {
  id: number;
  slot: AdSlotKey;
  campaignName: string;
  advertiser: string;
  creativeImage: string | null;
  headline: string;
  description: string;
  cta: string;
  targetUrl: string;
  startDate: string;
  endDate: string;
  status: AdCampaignStatus;
  impressions: number;
  clicks: number;
  revenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdSlotAssignment {
  slot: AdSlotKey;
  label: string;
  activeCampaign: AdCampaignRecord | null;
}

export interface AdsSnapshot {
  revenueToday: number;
  revenueMonth: number;
  activeCampaigns: number;
  fillRate: number;
  impressionsToday: number;
  ctr: number;
}

export interface AdsDashboardData {
  snapshot: AdsSnapshot;
  slots: AdSlotAssignment[];
  campaigns: AdCampaignRecord[];
}

export interface ImportPreview {
  format: ImportFormat;
  importType: ImportType;
  valid: boolean;
  timeline: {
    mode: "create" | "existing";
    timelineId: number | null;
    title: string;
    slug: string;
    description: string;
    category: string;
  };
	  timelines: Array<{
	    mode: "create" | "existing";
	    timelineId: number | null;
	    title: string;
	    slug: string;
	    description: string;
	    category: string;
	    orderingMode: TimelineOrderingMode;
	    rows: number;
	    duplicates: number;
	    accepted: number;
	    sources: number;
	    tags: number;
	    warnings: string[];
	  }>;
	  totals: {
	    rows: number;
	    duplicates: number;
	    accepted: number;
	    timelines: number;
	    sources: number;
	    tags: number;
	    warnings: number;
	  };
	  errors: string[];
	  preview: Array<{
	    date: string;
	    legacyDate?: string | null;
	    displayDate?: string | null;
	    datePrecision: DatePrecision;
	    sortYear?: number | null;
	    sortMonth?: number | null;
	    sortDay?: number | null;
	    title: string;
	    description: string;
	    duplicate: boolean;
	    sources: number;
	    tags: number;
	    tagNames: string[];
	    eventOrder?: number | null;
	    timelineSlug?: string;
	    timelineTitle?: string;
	  }>;
  skipDuplicates: boolean;
}

export interface ImportReason {
  type: "timeline_skipped" | "event_skipped";
  message: string;
  timelineSlug: string;
  row?: number;
  date?: string | null;
  title?: string | null;
}

export interface ImportExecutionResult {
  message: string;
  timelineId: number;
  eventsCreatedCount: number;
  duplicatesSkipped: number;
  timelineCreated: boolean;
  importedTimelinesCount: number;
  importedEventsCount: number;
  skippedTimelinesCount: number;
  skippedEventsCount: number;
	  affectedTimelineSlugs: string[];
	  importedSourcesCount: number;
	  importedTagsCount: number;
	  warnings: string[];
	  timelineResults: Array<{
	    timelineId: number;
	    title: string;
	    slug: string;
	    importedEventsCount: number;
	    skippedEventsCount: number;
	    timelineCreated: boolean;
	    orderingMode: TimelineOrderingMode;
	    importedSourcesCount: number;
	    importedTagsCount: number;
	    warnings: string[];
	  }>;
  reasons: ImportReason[];
}

export interface TimelineImportRow {
  date: string;
  datePrecision: DatePrecision;
  legacyDate?: string | null;
  displayDate?: string | null;
  sortYear?: number | null;
	  sortMonth?: number | null;
	  sortDay?: number | null;
	  eventOrder?: number | null;
	  title: string;
  description: string;
  importance: number;
  location?: string | null;
  imageUrl?: string | null;
  sources: ImportSourceInput[];
  tags: string[];
}
