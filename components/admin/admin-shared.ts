import type {
  AdCampaignRecord,
  AdminAnalyticsReport,
  AdsDashboardData,
  AnalyticsSnapshot,
  DashboardOverview,
  EmbeddedSourceInput,
  EventRecord,
  TagRecord,
  TimelineRequestRecord,
  TimelineSummary
} from "@/src/lib/types";

export type TopTab = "content" | "analytics" | "ads";
export type ContentSection = "snapshot" | "timelines" | "events" | "import_data" | "requests";
export type AdminFetcher = <T>(url: string, init?: RequestInit) => Promise<T>;

export type ContentDataset = {
  overview: DashboardOverview | null;
  analyticsSnapshot: AnalyticsSnapshot | null;
  timelines: TimelineSummary[];
  events: EventRecord[];
  tags: TagRecord[];
  requests: TimelineRequestRecord[];
};

export type AnalyticsDataset = {
  analyticsSnapshot: AnalyticsSnapshot | null;
  analyticsReport: AdminAnalyticsReport | null;
};

export type TimelineDraft = {
  id: number | null;
  title: string;
  slug: string;
  description: string;
  category: string;
  status: "published";
};

export type EventDraft = {
  id: number | null;
  timelineId: string;
  eventOrder: string;
  date: string;
  datePrecision: EventRecord["datePrecision"];
  title: string;
  description: string;
  importance: string;
  location: string;
  imageUrl: string;
  sources: EmbeddedSourceInput[];
  tagIds: string;
};

export type TagDraft = {
  id: number | null;
  name: string;
  slug: string;
};

export type AdCampaignDraft = {
  id: number | null;
  slot: AdCampaignRecord["slot"];
  campaignName: string;
  advertiser: string;
  creativeImage: string;
  headline: string;
  description: string;
  cta: string;
  targetUrl: string;
  startDate: string;
  endDate: string;
  status: AdCampaignRecord["status"];
};

export const initialContentDataset: ContentDataset = {
  overview: null,
  analyticsSnapshot: null,
  timelines: [],
  events: [],
  tags: [],
  requests: []
};

export const initialAnalyticsDataset: AnalyticsDataset = {
  analyticsSnapshot: null,
  analyticsReport: null
};

export const initialTimelineDraft: TimelineDraft = {
  id: null,
  title: "",
  slug: "",
  description: "",
  category: "",
  status: "published"
};

export const initialEventDraft: EventDraft = {
  id: null,
  timelineId: "",
  eventOrder: "1",
  date: "",
  datePrecision: "day",
  title: "",
  description: "",
  importance: "3",
  location: "",
  imageUrl: "",
  sources: [],
  tagIds: ""
};

export const initialTagDraft: TagDraft = {
  id: null,
  name: "",
  slug: ""
};

export const initialCampaignDraft: AdCampaignDraft = {
  id: null,
  slot: "home_feed_ad",
  campaignName: "",
  advertiser: "",
  creativeImage: "",
  headline: "",
  description: "",
  cta: "",
  targetUrl: "",
  startDate: "",
  endDate: "",
  status: "draft"
};

export function parseIdList(value: string): number[] {
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function renderPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function renderSeconds(value: number) {
  return `${value.toFixed(0)}s`;
}

export type StatusHandlers = {
  setStatus: (value: string) => void;
  setError: (value: string) => void;
  onLoaded: () => void;
};

export type AdsModuleState = AdsDashboardData | null;
