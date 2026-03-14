import type { AdminAnalyticsReport, AnalyticsSnapshot, DashboardOverview, TimelineRequestStatus } from "@/src/lib/types";
import { config } from "@/src/lib/config";
import { getSql } from "@/src/server/db/client";
import { getSampleDashboardOverview } from "@/src/server/dev/sample-data";
import { memoryStore } from "@/src/server/dev/memory-store";
import { analyticsEventsRepository } from "@/src/server/repositories/analytics-events-repository";

const HOUR_LABELS = Array.from({ length: 24 }, (_, index) => `${index.toString().padStart(2, "0")}:00`);
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_WINDOW_DAYS = 30;

function zeroSeries(labels: string[]) {
  return labels.map((label) => ({ label, value: 0 }));
}

export const analyticsRepository = {
  async getDashboardOverview(): Promise<DashboardOverview> {
    const sql = getSql();
    if (!sql) {
      return getSampleDashboardOverview();
    }

    const [totals, requestBreakdown, latestRequests] = await Promise.all([
      sql<{
        timelines: number;
        events: number;
        sources: number;
        tags: number;
        requests: number;
      }[]>`
        SELECT
          (SELECT COUNT(*)::int FROM timelines) AS timelines,
          (SELECT COUNT(*)::int FROM events) AS events,
          (SELECT COUNT(*)::int FROM sources) AS sources,
          (SELECT COUNT(*)::int FROM tags) AS tags,
          (SELECT COUNT(*)::int FROM timeline_requests) AS requests
      `,
      sql<{ status: TimelineRequestStatus; count: number }[]>`
        SELECT status, COUNT(*)::int AS count
        FROM timeline_requests
        GROUP BY status
      `,
      sql<{
        id: number;
        query: string;
        normalized_query: string;
        ip_hash: string;
        language: string;
        status: TimelineRequestStatus;
        created_at: string;
      }[]>`
        SELECT id, query, normalized_query, ip_hash, language, status, created_at::text
        FROM timeline_requests
        ORDER BY created_at DESC
        LIMIT 8
      `
    ]);

    return {
      totals: totals[0] || {
        timelines: 0,
        events: 0,
        sources: 0,
        tags: 0,
        requests: 0
      },
      requestStatusBreakdown: requestBreakdown,
      latestRequests: latestRequests.map((row) => ({
        id: row.id,
        query: row.query,
        normalizedQuery: row.normalized_query,
        ipHash: row.ip_hash,
        language: row.language,
        status: row.status,
        createdAt: row.created_at
      }))
    };
  },

  async getAnalyticsSnapshot(): Promise<AnalyticsSnapshot> {
    const sql = getSql();
    if (!sql) {
      const now = Date.now();
      const windowStart = now - 1000 * 60 * 60 * 24 * 30;
      return {
        contentVelocity: {
          timelinesLast30Days: memoryStore.getTimelines().filter((timeline) => new Date(timeline.createdAt).getTime() >= windowStart).length,
          eventsLast30Days: memoryStore.getTimelines().flatMap((timeline) => timeline.events).filter((event) => new Date(event.createdAt).getTime() >= windowStart).length,
          requestsLast30Days: memoryStore.getRequests().filter((request) => new Date(request.createdAt).getTime() >= windowStart).length
        },
        operational: {
          gaConfigured: Boolean(config.gaId),
          adsConfigured: Boolean(config.adsenseId),
          databaseConfigured: Boolean(config.databaseUrl)
        },
        topCategories: Array.from(
          memoryStore
            .getTimelineSummaries()
            .reduce<Map<string, number>>((acc, timeline) => acc.set(timeline.category, (acc.get(timeline.category) || 0) + 1), new Map())
            .entries()
        ).map(([category, count]) => ({ category, count }))
      };
    }

    const [contentVelocity, topCategories] = await Promise.all([
      sql<{
        timelines_last_30_days: number;
        events_last_30_days: number;
        requests_last_30_days: number;
      }[]>`
        SELECT
          (SELECT COUNT(*)::int FROM timelines WHERE created_at >= NOW() - INTERVAL '30 days') AS timelines_last_30_days,
          (SELECT COUNT(*)::int FROM events WHERE created_at >= NOW() - INTERVAL '30 days') AS events_last_30_days,
          (SELECT COUNT(*)::int FROM timeline_requests WHERE created_at >= NOW() - INTERVAL '30 days') AS requests_last_30_days
      `,
      sql<{ category: string; count: number }[]>`
        SELECT category, COUNT(*)::int AS count
        FROM timelines
        GROUP BY category
        ORDER BY count DESC, category ASC
      `
    ]);

    return {
      contentVelocity: {
        timelinesLast30Days: contentVelocity[0]?.timelines_last_30_days || 0,
        eventsLast30Days: contentVelocity[0]?.events_last_30_days || 0,
        requestsLast30Days: contentVelocity[0]?.requests_last_30_days || 0
      },
      operational: {
        gaConfigured: Boolean(config.gaId),
        adsConfigured: Boolean(config.adsenseId),
        databaseConfigured: Boolean(config.databaseUrl)
      },
      topCategories
    };
  },

  async getAnalyticsReport(): Promise<AdminAnalyticsReport> {
    const sql = getSql();
    const trackingConfigured = Boolean(config.gaId);
    const [timelineViewCounts, trackedTopTimelines, timelineViewsOverTime] = await Promise.all([
      analyticsEventsRepository.getTimelineViewCounts(),
      analyticsEventsRepository.listTopTimelinesByViews(10),
      analyticsEventsRepository.getTimelineViewsOverTime()
    ]);

    const topTimelines = trackedTopTimelines.map((timeline) => ({
      timelineId: timeline.timelineId,
      title: timeline.title,
      slug: timeline.slug,
      views: timeline.views,
      eventOpenRate: 0,
      avgReadTime: 0
    }));

    const topEvents: AdminAnalyticsReport["contentPerformance"]["topEvents"] = [];

    if (!sql) {
      const now = Date.now();
      const windowStart = now - 1000 * 60 * 60 * 24 * MONTH_WINDOW_DAYS;
      const requestsLast30Days = memoryStore
        .getRequests()
        .filter((request) => new Date(request.createdAt).getTime() >= windowStart).length;

      return {
        audience: {
          usersToday: 0,
          usersWeek: 0,
          usersMonth: 0,
          newUsers: 0,
          returningUsers: 0,
          countryDistribution: [],
          deviceDistribution: [],
          browserDistribution: []
        },
        behavior: {
          avgSessionDuration: 0,
          timelinesPerSession: 0,
          eventsOpenedPerSession: 0,
          bounceRate: 0,
          visitsByHour: zeroSeries(HOUR_LABELS),
          visitsByDay: zeroSeries(DAY_LABELS)
        },
        contentPerformance: {
          timelineViewsToday: timelineViewCounts.timelineViewsToday,
          timelineViews7d: timelineViewCounts.timelineViews7d,
          timelineViews30d: timelineViewCounts.timelineViews30d,
          topTimelines,
          topEvents
        },
        searchIntelligence: {
          topSearchQueries: [],
          noResultSearches: 0,
          searchClickRate: 0
        },
        growth: {
          trafficOverTime: zeroSeries(["Week 1", "Week 2", "Week 3", "Week 4"]),
          searchesOverTime: [
            { label: "Requests (30d)", value: requestsLast30Days }
          ],
          timelineViewsOverTime
        },
        trackingConfigured
      };
    }

    const [requestRows, timelineRows] = await Promise.all([
      sql<{ label: string; value: number }[]>`
        SELECT TO_CHAR(created_at, 'Dy') AS label, COUNT(*)::int AS value
        FROM timeline_requests
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY TO_CHAR(created_at, 'Dy')
      `,
      sql<{ label: string; value: number }[]>`
        SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS label, COUNT(*)::int AS value
        FROM timelines
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
        ORDER BY label ASC
      `
    ]);

    return {
      audience: {
        usersToday: 0,
        usersWeek: 0,
        usersMonth: 0,
        newUsers: 0,
        returningUsers: 0,
        countryDistribution: [],
        deviceDistribution: [],
        browserDistribution: []
      },
      behavior: {
        avgSessionDuration: 0,
        timelinesPerSession: 0,
        eventsOpenedPerSession: 0,
        bounceRate: 0,
        visitsByHour: zeroSeries(HOUR_LABELS),
        visitsByDay: DAY_LABELS.map((label) => ({
          label,
          value: requestRows.find((row) => row.label === label)?.value || 0
        }))
      },
      contentPerformance: {
        timelineViewsToday: timelineViewCounts.timelineViewsToday,
        timelineViews7d: timelineViewCounts.timelineViews7d,
        timelineViews30d: timelineViewCounts.timelineViews30d,
        topTimelines,
        topEvents
      },
      searchIntelligence: {
        topSearchQueries: [],
        noResultSearches: 0,
        searchClickRate: 0
      },
      growth: {
        trafficOverTime: timelineRows,
        searchesOverTime: requestRows,
        timelineViewsOverTime
      },
      trackingConfigured
    };
  }
};
