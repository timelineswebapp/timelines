import type { TimelineDetail, TimelineSummary } from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";
import { getSql } from "@/src/server/db/client";
import { memoryStore, touchTimelineSummary, withRelatedTimelines } from "@/src/server/dev/memory-store";

interface TimelineRow {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}

function summaryFromRow(row: TimelineRow, tags: TimelineSummary["tags"], eventCount: number, highlightedEventTitles: string[]): TimelineSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
    eventCount,
    highlightedEventTitles
  };
}

async function getTimelineTags(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((item) => item.id === timelineId);
    return timeline?.tags || [];
  }

  return sql<{
    id: number;
    slug: string;
    name: string;
  }[]>`
    SELECT DISTINCT tags.id, tags.slug, tags.name
    FROM timeline_events
    INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
    INNER JOIN tags ON tags.id = event_tags.tag_id
    WHERE timeline_events.timeline_id = ${timelineId}
    ORDER BY tags.name ASC
  `;
}

async function getTimelineEventHighlights(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((item) => item.id === timelineId);
    return timeline?.events.slice(0, 3).map((event) => event.title) || [];
  }

  const rows = await sql<{ title: string }[]>`
    SELECT events.title
    FROM timeline_events
    INNER JOIN events ON events.id = timeline_events.event_id
    WHERE timeline_events.timeline_id = ${timelineId}
    ORDER BY timeline_events.event_order ASC
    LIMIT 3
  `;

  return rows.map((row) => row.title);
}

async function getTimelineEventCount(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    return memoryStore.getTimelines().find((item) => item.id === timelineId)?.events.length || 0;
  }

  const [row] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM timeline_events
    WHERE timeline_id = ${timelineId}
  `;

  return row?.count || 0;
}

export const timelineRepository = {
  async listSummaries(limit = 12): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelineSummaries().slice(0, limit);
    }

    const rows = await sql<
      (TimelineRow & {
        tags: TimelineSummary["tags"] | null;
        event_count: number | null;
        highlighted_event_titles: string[] | null;
      })[]
    >`
      SELECT
        timelines.id,
        timelines.title,
        timelines.slug,
        timelines.description,
        timelines.category,
        timelines.created_at,
        timelines.updated_at,
        COALESCE(tags.tags, '[]'::jsonb) AS tags,
        COALESCE(counts.event_count, 0) AS event_count,
        COALESCE(highlights.highlighted_event_titles, ARRAY[]::text[]) AS highlighted_event_titles
      FROM timelines
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS event_count
        FROM timeline_events
        WHERE timeline_id = timelines.id
      ) counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT events.title
          FROM timeline_events
          INNER JOIN events ON events.id = timeline_events.event_id
          WHERE timeline_events.timeline_id = timelines.id
          ORDER BY timeline_events.event_order ASC
          LIMIT 3
        ) AS highlighted_event_titles
      ) highlights ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('id', timeline_tags.id, 'slug', timeline_tags.slug, 'name', timeline_tags.name)
            ORDER BY timeline_tags.name ASC
          ),
          '[]'::jsonb
        ) AS tags
        FROM (
          SELECT DISTINCT tags.id, tags.slug, tags.name
          FROM timeline_events
          INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
          INNER JOIN tags ON tags.id = event_tags.tag_id
          WHERE timeline_events.timeline_id = timelines.id
        ) AS timeline_tags
      ) tags ON TRUE
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) =>
      summaryFromRow(
        row,
        row.tags || [],
        row.event_count || 0,
        row.highlighted_event_titles || []
      )
    );
  },

  async listStaticSlugs(limit = 50): Promise<string[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().slice(0, limit).map((timeline) => timeline.slug);
    }

    const rows = await sql<{ slug: string }[]>`
      SELECT slug
      FROM timelines
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => row.slug);
  },

  async getBySlug(slug: string): Promise<TimelineDetail | null> {
    const sql = getSql();
    if (!sql) {
      const timeline = memoryStore.getTimelines().find((item) => item.slug === slug);
      return timeline ? withRelatedTimelines(timeline, memoryStore.getTimelines()) : null;
    }

    const [timelineRow] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at, updated_at
      FROM timelines
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (!timelineRow) {
      return null;
    }

    const [tags, eventRows, relatedRows] = await Promise.all([
      getTimelineTags(timelineRow.id),
      sql<{
        id: number;
        date: string;
        date_precision: TimelineDetail["events"][number]["datePrecision"];
        title: string;
        description: string;
        importance: number;
        location: string | null;
        image_url: string | null;
        created_at: string;
        updated_at: string;
        source_ids: number[] | null;
        tag_ids: number[] | null;
      }[]>`
        SELECT
          events.id,
          events.date::text AS date,
          events.date_precision,
          events.title,
          events.description,
          events.importance,
          events.location,
          events.image_url,
          events.created_at::text AS created_at,
          events.updated_at::text AS updated_at,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_sources.source_id), NULL) AS source_ids,
          ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_tags.tag_id), NULL) AS tag_ids
        FROM timeline_events
        INNER JOIN events ON events.id = timeline_events.event_id
        LEFT JOIN event_sources ON event_sources.event_id = events.id
        LEFT JOIN event_tags ON event_tags.event_id = events.id
        WHERE timeline_events.timeline_id = ${timelineRow.id}
        GROUP BY events.id, timeline_events.event_order
        ORDER BY timeline_events.event_order ASC
      `,
      sql<TimelineRow[]>`
        SELECT id, title, slug, description, category, created_at, updated_at
        FROM timelines
        WHERE category = ${timelineRow.category} AND id <> ${timelineRow.id}
        ORDER BY updated_at DESC
        LIMIT 3
      `
    ]);

    const sourceIds = Array.from(new Set(eventRows.flatMap((row) => row.source_ids || [])));
    const tagIds = Array.from(new Set(eventRows.flatMap((row) => row.tag_ids || [])));

    const [sources, eventTags] = await Promise.all([
      sourceIds.length > 0
        ? sql<{ id: number; publisher: string; url: string; credibility_score: string }[]>`
            SELECT id, publisher, url, credibility_score::text
            FROM sources
            WHERE id IN ${sql(sourceIds)}
          `
        : Promise.resolve([]),
      tagIds.length > 0
        ? sql<{ id: number; slug: string; name: string }[]>`
            SELECT id, slug, name
            FROM tags
            WHERE id IN ${sql(tagIds)}
          `
        : Promise.resolve([])
    ]);

    const detail: TimelineDetail = {
      ...summaryFromRow(
        timelineRow,
        tags,
        eventRows.length,
        eventRows.slice(0, 3).map((row) => row.title)
      ),
      events: eventRows.map((row) => ({
        id: row.id,
        date: row.date,
        datePrecision: row.date_precision,
        title: row.title,
        description: row.description,
        importance: row.importance,
        location: row.location,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sources: sources
          .filter((source) => (row.source_ids || []).includes(source.id))
          .map((source) => ({
            id: source.id,
            publisher: source.publisher,
            url: source.url,
            credibilityScore: Number(source.credibility_score)
          })),
        tags: eventTags.filter((tag) => (row.tag_ids || []).includes(tag.id))
      })),
      relatedTimelines: await Promise.all(
        relatedRows.map(async (row) => {
          const [relatedTags, relatedCount, highlights] = await Promise.all([
            getTimelineTags(row.id),
            getTimelineEventCount(row.id),
            getTimelineEventHighlights(row.id)
          ]);

          return summaryFromRow(row, relatedTags, relatedCount, highlights);
        })
      )
    };

    return detail;
  },

  async getById(id: number): Promise<TimelineSummary | null> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelineSummaries().find((item) => item.id === id) || null;
    }

    const [row] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at, updated_at
      FROM timelines
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!row) {
      return null;
    }

    const [tags, count, highlights] = await Promise.all([
      getTimelineTags(row.id),
      getTimelineEventCount(row.id),
      getTimelineEventHighlights(row.id)
    ]);

    return summaryFromRow(row, tags, count, highlights);
  },

  async getByTag(slug: string): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore
        .getTimelineSummaries()
        .filter((timeline) => timeline.tags.some((tag) => tag.slug === slug));
    }

    const rows = await sql<TimelineRow[]>`
      SELECT DISTINCT timelines.id, timelines.title, timelines.slug, timelines.description, timelines.category, timelines.created_at, timelines.updated_at
      FROM timelines
      INNER JOIN timeline_events ON timeline_events.timeline_id = timelines.id
      INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
      INNER JOIN tags ON tags.id = event_tags.tag_id
      WHERE tags.slug = ${slug}
      ORDER BY timelines.updated_at DESC
    `;

    return Promise.all(
      rows.map(async (row) => {
        const [tags, count, highlights] = await Promise.all([
          getTimelineTags(row.id),
          getTimelineEventCount(row.id),
          getTimelineEventHighlights(row.id)
        ]);

        return summaryFromRow(row, tags, count, highlights);
      })
    );
  },

  async search(query: string, limit: number): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      const normalized = query.toLowerCase();
      return memoryStore
        .getTimelineSummaries()
        .filter((timeline) => {
          const haystacks = [
            timeline.title,
            timeline.description,
            timeline.tags.map((tag) => tag.name).join(" "),
            ...memoryStore.getTimelines().find((candidate) => candidate.id === timeline.id)?.events.map((event) => `${event.title} ${event.description}`) || []
          ]
            .join(" ")
            .toLowerCase();

          return haystacks.includes(normalized);
        })
        .slice(0, limit);
    }

    const rows = await sql<{
      id: number;
      title: string;
      slug: string;
      description: string;
      category: string;
      created_at: string;
      updated_at: string;
    }[]>`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS q
      )
      SELECT DISTINCT
        timelines.id,
        timelines.title,
        timelines.slug,
        timelines.description,
        timelines.category,
        timelines.created_at,
        timelines.updated_at
      FROM timelines
      CROSS JOIN search_query
      LEFT JOIN timeline_events ON timeline_events.timeline_id = timelines.id
      LEFT JOIN events ON events.id = timeline_events.event_id
      LEFT JOIN event_tags ON event_tags.event_id = events.id
      LEFT JOIN tags ON tags.id = event_tags.tag_id
      WHERE
        timelines.search_vector @@ search_query.q
        OR events.search_vector @@ search_query.q
        OR to_tsvector('english', coalesce(tags.name, '') || ' ' || coalesce(tags.slug, '')) @@ search_query.q
      ORDER BY
        GREATEST(
          ts_rank_cd(timelines.search_vector, search_query.q) * 1.5,
          COALESCE(ts_rank_cd(events.search_vector, search_query.q), 0),
          CASE WHEN to_tsvector('english', coalesce(tags.name, '') || ' ' || coalesce(tags.slug, '')) @@ search_query.q THEN 0.8 ELSE 0 END
        ) DESC,
        timelines.updated_at DESC
      LIMIT ${limit}
    `;

    return Promise.all(
      rows.map(async (row) => {
        const [tags, count, highlights] = await Promise.all([
          getTimelineTags(row.id),
          getTimelineEventCount(row.id),
          getTimelineEventHighlights(row.id)
        ]);

        return summaryFromRow(row, tags, count, highlights);
      })
    );
  },

  async create(input: { title: string; slug: string; description: string; category: string }): Promise<TimelineSummary> {
    const sql = getSql();
    if (!sql) {
      const nextId = memoryStore.nextTimelineId();
      const timeline: TimelineDetail = {
        id: nextId,
        title: input.title,
        slug: input.slug || slugify(input.title),
        description: input.description,
        category: input.category,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        tags: [],
        eventCount: 0,
        highlightedEventTitles: [],
        events: [],
        relatedTimelines: []
      };
      memoryStore.setTimelines([...memoryStore.getTimelines(), timeline]);
      const { events: _events, relatedTimelines: _relatedTimelines, ...summary } = timeline;
      return summary;
    }

    const [row] = await sql<TimelineRow[]>`
      INSERT INTO timelines (title, slug, description, category)
      VALUES (${input.title}, ${input.slug}, ${input.description}, ${input.category})
      RETURNING id, title, slug, description, category, created_at, updated_at
    `;

    if (!row) {
      throw new Error("Timeline insert failed.");
    }

    return summaryFromRow(row, [], 0, []);
  },

  async update(id: number, input: { title: string; slug: string; description: string; category: string }): Promise<TimelineSummary | null> {
    const sql = getSql();
    if (!sql) {
      const timelines = memoryStore.getTimelines();
      const timeline = timelines.find((item) => item.id === id);
      if (!timeline) {
        return null;
      }

      timeline.title = input.title;
      timeline.slug = input.slug || slugify(input.title);
      timeline.description = input.description;
      timeline.category = input.category;
      touchTimelineSummary(timeline);
      const { events: _events, relatedTimelines: _relatedTimelines, ...summary } = timeline;
      return summary;
    }

    const [row] = await sql<TimelineRow[]>`
      UPDATE timelines
      SET title = ${input.title}, slug = ${input.slug}, description = ${input.description}, category = ${input.category}
      WHERE id = ${id}
      RETURNING id, title, slug, description, category, created_at, updated_at
    `;

    if (!row) {
      return null;
    }

    const [tags, count, highlights] = await Promise.all([
      getTimelineTags(row.id),
      getTimelineEventCount(row.id),
      getTimelineEventHighlights(row.id)
    ]);

    return summaryFromRow(row, tags, count, highlights);
  },

  async delete(id: number): Promise<boolean> {
    const sql = getSql();
    if (!sql) {
      const timelines = memoryStore.getTimelines();
      const next = timelines.filter((timeline) => timeline.id !== id);
      if (next.length === timelines.length) {
        return false;
      }
      memoryStore.setTimelines(next);
      return true;
    }

    const result = await sql`
      DELETE FROM timelines
      WHERE id = ${id}
    `;

    return result.count > 0;
  }
};
