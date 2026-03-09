export type DatePrecision = "year" | "month" | "day" | "approximate";

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

export interface ImportPreview {
  format: "csv" | "json";
  valid: boolean;
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
  }>;
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
