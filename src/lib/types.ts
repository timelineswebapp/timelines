export type DatePrecision = "year" | "month" | "day" | "approximate";
export type ImportFormat = "csv" | "json" | "text";
export type ImportType = "timeline_with_events" | "events_into_existing_timeline";

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

export interface TagRecord {
  id: number;
  slug: string;
  name: string;
}

export interface EventRecord {
  id: number;
  date: string;
  datePrecision: DatePrecision;
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

export interface TagDetail {
  tag: TagRecord;
  timelines: TimelineSummary[];
}

export interface SearchResult {
  query: string;
  total: number;
  items: TimelineSummary[];
}

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
    description: string;
    category: string;
  };
  totals: {
    rows: number;
    duplicates: number;
    accepted: number;
  };
  errors: string[];
  preview: Array<{
    date: string;
    title: string;
    description: string;
    duplicate: boolean;
  }>;
  skipDuplicates: boolean;
}

export interface ImportExecutionResult {
  message: string;
  timelineId: number;
  eventsCreatedCount: number;
  duplicatesSkipped: number;
  timelineCreated: boolean;
}

export interface TimelineImportRow {
  date: string;
  datePrecision: DatePrecision;
  title: string;
  description: string;
  importance: number;
  location?: string | null;
  imageUrl?: string | null;
}
