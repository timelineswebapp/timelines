import type { TimeSeriesPoint, TimelineViewEventInput } from "@/src/lib/types";
import { ApiError } from "@/src/server/api/responses";
import { getSql, getWriteSql } from "@/src/server/db/client";

const TIMELINE_VIEW_EVENT = "timeline_view";

type TimelineViewCountsRow = {
  timeline_views_today: number;
  timeline_views_7d: number;
  timeline_views_30d: number;
};

type TopTimelineViewRow = {
  timeline_id: number;
  title: string;
  slug: string;
  views: number;
};

export const analyticsEventsRepository = {
  async recordTimelineView(input: TimelineViewEventInput): Promise<string> {
    const sql = getWriteSql("timeline view telemetry");
    const rows = await sql<{ id: string }[]>`
      INSERT INTO analytics_events (
        event_type,
        timeline_id,
        slug,
        session_id,
        user_id,
        country,
        device,
        referrer,
        metadata
      )
      SELECT
        ${TIMELINE_VIEW_EVENT},
        ${input.timelineId},
        ${input.slug},
        ${input.sessionId || null},
        ${input.userId || null},
        ${input.country || null},
        ${input.device || null},
        ${input.referrer || null},
        CAST(${JSON.stringify(input.metadata || {})} AS jsonb)
      WHERE NOT EXISTS (
        SELECT 1
        FROM analytics_events
        WHERE event_type = ${TIMELINE_VIEW_EVENT}
          AND slug = ${input.slug}
          AND session_id = ${input.sessionId || null}
          AND created_at >= NOW() - INTERVAL '30 minutes'
      )
      RETURNING id::text AS id
    `;

    const insertedId = rows[0]?.id;
    if (!insertedId) {
      return "deduped";
    }

    return insertedId;
  },

  async getTimelineViewCounts(): Promise<{
    timelineViewsToday: number;
    timelineViews7d: number;
    timelineViews30d: number;
  }> {
    const sql = getSql();
    if (!sql) {
      return {
        timelineViewsToday: 0,
        timelineViews7d: 0,
        timelineViews30d: 0
      };
    }

    const rows = await sql<TimelineViewCountsRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS timeline_views_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '6 days')::int AS timeline_views_7d,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '29 days')::int AS timeline_views_30d
      FROM analytics_events
      WHERE event_type = ${TIMELINE_VIEW_EVENT}
    `;

    return {
      timelineViewsToday: rows[0]?.timeline_views_today || 0,
      timelineViews7d: rows[0]?.timeline_views_7d || 0,
      timelineViews30d: rows[0]?.timeline_views_30d || 0
    };
  },

  async listTopTimelinesByViews(limit = 10): Promise<Array<{
    timelineId: number;
    title: string;
    slug: string;
    views: number;
  }>> {
    const sql = getSql();
    if (!sql) {
      return [];
    }

    const rows = await sql<TopTimelineViewRow[]>`
      SELECT
        timelines.id::int AS timeline_id,
        timelines.title,
        timelines.slug,
        COUNT(*)::int AS views
      FROM analytics_events
      INNER JOIN timelines ON timelines.id = analytics_events.timeline_id
      WHERE analytics_events.event_type = ${TIMELINE_VIEW_EVENT}
        AND analytics_events.created_at >= CURRENT_DATE - INTERVAL '29 days'
      GROUP BY timelines.id, timelines.title, timelines.slug, timelines.updated_at
      ORDER BY views DESC, timelines.updated_at DESC, timelines.id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => ({
      timelineId: row.timeline_id,
      title: row.title,
      slug: row.slug,
      views: row.views
    }));
  },

  async getTimelineViewsOverTime(): Promise<TimeSeriesPoint[]> {
    const sql = getSql();
    if (!sql) {
      return [];
    }

    return sql<TimeSeriesPoint[]>`
      WITH days AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '29 days',
          CURRENT_DATE,
          INTERVAL '1 day'
        )::date AS day
      ),
      counts AS (
        SELECT DATE(created_at) AS day, COUNT(*)::int AS value
        FROM analytics_events
        WHERE event_type = ${TIMELINE_VIEW_EVENT}
          AND created_at >= CURRENT_DATE - INTERVAL '29 days'
        GROUP BY DATE(created_at)
      )
      SELECT
        TO_CHAR(days.day, 'YYYY-MM-DD') AS label,
        COALESCE(counts.value, 0)::int AS value
      FROM days
      LEFT JOIN counts ON counts.day = days.day
      ORDER BY days.day ASC
    `;
  }
};
