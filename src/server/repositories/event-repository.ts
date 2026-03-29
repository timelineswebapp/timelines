import type { EmbeddedSourceInput, EventRecord, EventShareContext, SourceRecord } from "@/src/lib/types";
import type { Sql } from "postgres";
import { compareHistoricalSort, parseHistoricalDateInput } from "@/src/lib/historical-date";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { hasHistoricalChronologyColumns } from "@/src/server/db/schema-capabilities";
import { ApiError } from "@/src/server/api/responses";
import { attachTaxonomyToEvent, memoryStore, touchTimelineSummary } from "@/src/server/dev/memory-store";

type EventInput = {
  date: string;
  datePrecision: EventRecord["datePrecision"];
  title: string;
  description: string;
  importance: number;
  location: string | null;
  imageUrl: string | null;
  timelineId: number;
  eventOrder: number;
  sources: EmbeddedSourceInput[];
  tagIds: number[];
};

function castLegacyDateExpression(sql: Sql, value: string) {
  return sql`CAST(CAST(${value} AS TEXT) AS DATE)`;
}

function reorderEvents(events: EventRecord[]) {
  return [...events].sort(compareHistoricalSort);
}

async function assertTimelineExists(sql: Sql, timelineId: number): Promise<void> {
  const [timeline] = await sql<{ id: number }[]>`
    SELECT id
    FROM timelines
    WHERE id = ${timelineId}
    LIMIT 1
  `;

  if (!timeline) {
    throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
  }
}

async function insertEventSources(sql: Sql, eventId: number, sourceIds: number[]): Promise<void> {
  if (sourceIds.length === 0) {
    return;
  }

  const rows = sourceIds.map((sourceId) => ({
    event_id: eventId,
    source_id: sourceId
  }));

  await sql`
    INSERT INTO event_sources ${sql(rows, "event_id", "source_id")}
    ON CONFLICT DO NOTHING
  `;
}

function normalizeSourcePublisher(source: EmbeddedSourceInput): string {
  return source.publisher?.trim() || source.title.trim();
}

async function resolveSourceIds(sql: Sql, sources: EmbeddedSourceInput[]): Promise<number[]> {
  if (sources.length === 0) {
    return [];
  }

  const normalized = Array.from(
    new Map(
      sources.map((source) => [
        source.url.trim().toLowerCase(),
        {
          url: source.url.trim(),
          publisher: normalizeSourcePublisher(source)
        }
      ])
    ).values()
  );

  const urls = normalized.map((source) => source.url);
  const existing = await sql<{ id: number; url: string }[]>`
    SELECT id, url
    FROM sources
    WHERE url IN ${sql(urls)}
  `;

  const existingByUrl = new Map(existing.map((row) => [row.url.toLowerCase(), row.id]));
  const missing = normalized.filter((source) => !existingByUrl.has(source.url.toLowerCase()));

  if (missing.length > 0) {
    const inserted = await Promise.all(
      missing.map(async (source) => {
        const [row] = await sql<{ id: number; url: string }[]>`
          INSERT INTO sources (publisher, url, credibility_score)
          VALUES (${source.publisher}, ${source.url}, ${0.8})
          ON CONFLICT (url) DO UPDATE
          SET publisher = COALESCE(NULLIF(EXCLUDED.publisher, ''), sources.publisher)
          RETURNING id, url
        `;

        if (!row) {
          throw new ApiError(500, "SOURCE_INSERT_FAILED", "Source insert failed.");
        }

        return row;
      })
    );

    for (const row of inserted) {
      existingByUrl.set(row.url.toLowerCase(), row.id);
    }
  }

  return normalized
    .map((source) => existingByUrl.get(source.url.toLowerCase()))
    .filter((value): value is number => Boolean(value));
}

function resolveMemorySources(sources: EmbeddedSourceInput[]): SourceRecord[] {
  if (sources.length === 0) {
    return [];
  }

  const records = memoryStore.getSources();
  const attached: SourceRecord[] = [];

  for (const source of sources) {
    const url = source.url.trim();
    let record = records.find((candidate) => candidate.url.toLowerCase() === url.toLowerCase());
    if (!record) {
      record = {
        id: memoryStore.nextSourceId(),
        publisher: normalizeSourcePublisher(source),
        url,
        credibilityScore: 0.8
      };
      records.push(record);
    }
    attached.push(record);
  }

  memoryStore.setSources([...records]);
  return attached;
}

async function insertEventTags(sql: Sql, eventId: number, tagIds: number[]): Promise<void> {
  if (tagIds.length === 0) {
    return;
  }

  const rows = tagIds.map((tagId) => ({
    event_id: eventId,
    tag_id: tagId
  }));

  await sql`
    INSERT INTO event_tags ${sql(rows, "event_id", "tag_id")}
    ON CONFLICT DO NOTHING
  `;
}

export const eventRepository = {
  async list(): Promise<EventRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().flatMap((timeline) =>
        timeline.events.map((event) => ({
          ...event,
          timelineLinks: [
            {
              timelineId: timeline.id,
              slug: timeline.slug,
              title: timeline.title,
              eventOrder: timeline.events.findIndex((candidate) => candidate.id === event.id) + 1
            }
          ]
        }))
      );
    }

    const hasHistoricalColumns = await hasHistoricalChronologyColumns(sql);

    const rows = await (hasHistoricalColumns
      ? sql<{
          id: number;
          date: string;
          legacy_date: string;
          display_date: string | null;
          sort_year: number | null;
          sort_month: number | null;
          sort_day: number | null;
          date_precision: EventRecord["datePrecision"];
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
            COALESCE(events.display_date, events.date::text) AS date,
            events.date::text AS legacy_date,
            events.display_date,
            events.sort_year,
            events.sort_month,
            events.sort_day,
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
          FROM events
          LEFT JOIN event_sources ON event_sources.event_id = events.id
          LEFT JOIN event_tags ON event_tags.event_id = events.id
          GROUP BY events.id
          ORDER BY
            events.sort_year DESC NULLS LAST,
            events.sort_month DESC NULLS LAST,
            events.sort_day DESC NULLS LAST,
            events.id DESC
          LIMIT 200
        `
      : sql<{
          id: number;
          date: string;
          date_precision: EventRecord["datePrecision"];
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
          FROM events
          LEFT JOIN event_sources ON event_sources.event_id = events.id
          LEFT JOIN event_tags ON event_tags.event_id = events.id
          GROUP BY events.id
          ORDER BY events.date DESC, events.id DESC
          LIMIT 200
        `);

    const eventIds = rows.map((row) => row.id);
    const sourceIds = Array.from(new Set(rows.flatMap((row) => row.source_ids || [])));
    const tagIds = Array.from(new Set(rows.flatMap((row) => row.tag_ids || [])));
    const timelineLinks = eventIds.length
      ? await sql<{
          event_id: number;
          timeline_id: number;
          slug: string;
          title: string;
          event_order: number;
        }[]>`
          SELECT
            timeline_events.event_id,
            timeline_events.timeline_id,
            timelines.slug,
            timelines.title,
            timeline_events.event_order
          FROM timeline_events
          INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
          WHERE timeline_events.event_id IN ${sql(eventIds)}
          ORDER BY timeline_events.event_order ASC
        `
      : [];
    const [sources, tags] = await Promise.all([
      sourceIds.length
        ? sql<{ id: number; publisher: string; url: string; credibility_score: string }[]>`
            SELECT id, publisher, url, credibility_score::text
            FROM sources
            WHERE id IN ${sql(sourceIds)}
          `
        : Promise.resolve([]),
      tagIds.length
        ? sql<{ id: number; slug: string; name: string }[]>`
            SELECT id, slug, name
            FROM tags
            WHERE id IN ${sql(tagIds)}
          `
        : Promise.resolve([])
    ]);

    return rows.map((row) => ({
      id: row.id,
      date: row.date,
      datePrecision: row.date_precision,
      legacyDate: "legacy_date" in row ? row.legacy_date : row.date,
      displayDate: "display_date" in row ? row.display_date : null,
      sortYear: "sort_year" in row ? row.sort_year : null,
      sortMonth: "sort_month" in row ? row.sort_month : null,
      sortDay: "sort_day" in row ? row.sort_day : null,
      title: row.title,
      description: row.description,
      importance: row.importance,
      location: row.location,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sources: sources
        .filter((source) => (row.source_ids || []).map(Number).includes(Number(source.id)))
        .map((source) => ({
          id: source.id,
          publisher: source.publisher,
          url: source.url,
          credibilityScore: Number(source.credibility_score)
        })),
      tags: tags.filter((tag) => (row.tag_ids || []).includes(tag.id)),
      timelineLinks: timelineLinks
        .filter((link) => link.event_id === row.id)
        .map((link) => ({
          timelineId: link.timeline_id,
          slug: link.slug,
          title: link.title,
          eventOrder: link.event_order
        }))
    }));
  },

  async getShareContextById(id: number): Promise<EventShareContext | null> {
    const sql = getSql();
    if (!sql) {
      for (const timeline of memoryStore.getTimelines()) {
        const event = timeline.events.find((candidate) => candidate.id === id);
        if (!event) {
          continue;
        }

        return {
          event: {
            ...event,
            timelineLinks: [
              {
                timelineId: timeline.id,
                slug: timeline.slug,
                title: timeline.title,
                eventOrder: timeline.events.findIndex((candidate) => candidate.id === id) + 1
              }
            ]
          },
          timeline: {
            id: timeline.id,
            slug: timeline.slug,
            title: timeline.title,
            category: timeline.category
          }
        };
      }

      return null;
    }

    const hasHistoricalColumns = await hasHistoricalChronologyColumns(sql);

    const rows = await (hasHistoricalColumns
      ? sql<{
          id: number;
          date: string;
          legacy_date: string;
          display_date: string | null;
          sort_year: number | null;
          sort_month: number | null;
          sort_day: number | null;
          date_precision: EventRecord["datePrecision"];
          title: string;
          description: string;
          importance: number;
          location: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
          source_ids: number[] | null;
          tag_ids: number[] | null;
          timeline_id: number;
          timeline_slug: string;
          timeline_title: string;
          timeline_category: string;
          event_order: number;
        }[]>`
          SELECT
            events.id,
            COALESCE(events.display_date, events.date::text) AS date,
            events.date::text AS legacy_date,
            events.display_date,
            events.sort_year,
            events.sort_month,
            events.sort_day,
            events.date_precision,
            events.title,
            events.description,
            events.importance,
            events.location,
            events.image_url,
            events.created_at::text AS created_at,
            events.updated_at::text AS updated_at,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_sources.source_id), NULL) AS source_ids,
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_tags.tag_id), NULL) AS tag_ids,
            timelines.id::int AS timeline_id,
            timelines.slug AS timeline_slug,
            timelines.title AS timeline_title,
            timelines.category AS timeline_category,
            timeline_events.event_order::int AS event_order
          FROM events
          INNER JOIN timeline_events ON timeline_events.event_id = events.id
          INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
          LEFT JOIN event_sources ON event_sources.event_id = events.id
          LEFT JOIN event_tags ON event_tags.event_id = events.id
          WHERE events.id = ${id}
          GROUP BY events.id, timelines.id, timeline_events.event_order
          ORDER BY timeline_events.event_order ASC, timelines.id ASC
          LIMIT 1
        `
      : sql<{
          id: number;
          date: string;
          date_precision: EventRecord["datePrecision"];
          title: string;
          description: string;
          importance: number;
          location: string | null;
          image_url: string | null;
          created_at: string;
          updated_at: string;
          source_ids: number[] | null;
          tag_ids: number[] | null;
          timeline_id: number;
          timeline_slug: string;
          timeline_title: string;
          timeline_category: string;
          event_order: number;
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
            ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_tags.tag_id), NULL) AS tag_ids,
            timelines.id::int AS timeline_id,
            timelines.slug AS timeline_slug,
            timelines.title AS timeline_title,
            timelines.category AS timeline_category,
            timeline_events.event_order::int AS event_order
          FROM events
          INNER JOIN timeline_events ON timeline_events.event_id = events.id
          INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
          LEFT JOIN event_sources ON event_sources.event_id = events.id
          LEFT JOIN event_tags ON event_tags.event_id = events.id
          WHERE events.id = ${id}
          GROUP BY events.id, timelines.id, timeline_events.event_order
          ORDER BY timeline_events.event_order ASC, timelines.id ASC
          LIMIT 1
        `);

    const row = rows[0];
    if (!row) {
      return null;
    }

    const sourceIds = Array.from(new Set(row.source_ids || []));
    const tagIds = Array.from(new Set(row.tag_ids || []));

    const [sources, tags] = await Promise.all([
      sourceIds.length
        ? sql<{ id: number; publisher: string; url: string; credibility_score: string }[]>`
            SELECT id, publisher, url, credibility_score::text
            FROM sources
            WHERE id IN ${sql(sourceIds)}
          `
        : Promise.resolve([]),
      tagIds.length
        ? sql<{ id: number; slug: string; name: string }[]>`
            SELECT id, slug, name
            FROM tags
            WHERE id IN ${sql(tagIds)}
          `
        : Promise.resolve([])
    ]);

    return {
      event: {
        id: row.id,
        date: row.date,
        datePrecision: row.date_precision,
        legacyDate: "legacy_date" in row ? row.legacy_date : row.date,
        displayDate: "display_date" in row ? row.display_date : null,
        sortYear: "sort_year" in row ? row.sort_year : null,
        sortMonth: "sort_month" in row ? row.sort_month : null,
        sortDay: "sort_day" in row ? row.sort_day : null,
        title: row.title,
        description: row.description,
        importance: row.importance,
        location: row.location,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sources: sources.map((source) => ({
          id: source.id,
          publisher: source.publisher,
          url: source.url,
          credibilityScore: Number(source.credibility_score)
        })),
        tags,
        timelineLinks: [
          {
            timelineId: row.timeline_id,
            slug: row.timeline_slug,
            title: row.timeline_title,
            eventOrder: row.event_order
          }
        ]
      },
      timeline: {
        id: row.timeline_id,
        slug: row.timeline_slug,
        title: row.timeline_title,
        category: row.timeline_category
      }
    };
  },

  async create(input: EventInput): Promise<EventRecord> {
    const sql = getWriteSql("event create");

    return sql.begin(async (tx) => {
      const query = tx as unknown as Sql;
      await assertTimelineExists(query, input.timelineId);
      const historical = parseHistoricalDateInput(input.date, input.datePrecision);
      const hasHistoricalColumns = await hasHistoricalChronologyColumns(query);

      const [event] = await (hasHistoricalColumns
        ? query<{
            id: number;
            date: string;
            legacy_date: string;
            display_date: string | null;
            sort_year: number | null;
            sort_month: number | null;
            sort_day: number | null;
            date_precision: EventRecord["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
          }[]>`
            INSERT INTO events (date, date_precision, sort_year, sort_month, sort_day, display_date, title, description, importance, location, image_url)
            VALUES (
              ${castLegacyDateExpression(query, historical.legacyDate)},
              ${historical.datePrecision},
              ${historical.sortYear},
              ${historical.sortMonth},
              ${historical.sortDay},
              ${historical.displayDate},
              ${input.title},
              ${input.description},
              ${input.importance},
              ${input.location},
              ${input.imageUrl}
            )
            RETURNING
              id,
              COALESCE(display_date, date::text) AS date,
              date::text AS legacy_date,
              display_date,
              sort_year,
              sort_month,
              sort_day,
              date_precision,
              title,
              description,
              importance,
              location,
              image_url,
              created_at::text AS created_at,
              updated_at::text AS updated_at
          `
        : query<{
            id: number;
            date: string;
            date_precision: EventRecord["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
          }[]>`
            INSERT INTO events (date, date_precision, title, description, importance, location, image_url)
            VALUES (${castLegacyDateExpression(query, historical.legacyDate)}, ${historical.datePrecision}, ${input.title}, ${input.description}, ${input.importance}, ${input.location}, ${input.imageUrl})
            RETURNING id, date::text AS date, date_precision, title, description, importance, location, image_url, created_at::text AS created_at, updated_at::text AS updated_at
          `);

      if (!event) {
        throw new ApiError(500, "EVENT_INSERT_FAILED", "Event insert failed.");
      }

      const sourceIds = await resolveSourceIds(query, input.sources);

      await query`
        INSERT INTO timeline_events (timeline_id, event_id, event_order)
        VALUES (${input.timelineId}, ${event.id}, ${input.eventOrder})
      `;

      await Promise.all([
        insertEventSources(query, event.id, sourceIds),
        insertEventTags(query, event.id, input.tagIds)
      ]);

      return {
        id: event.id,
        date: event.date,
        datePrecision: event.date_precision,
        legacyDate: "legacy_date" in event ? event.legacy_date : historical.legacyDate,
        displayDate: "display_date" in event ? event.display_date : historical.displayDate,
        sortYear: "sort_year" in event ? event.sort_year : historical.sortYear,
        sortMonth: "sort_month" in event ? event.sort_month : historical.sortMonth,
        sortDay: "sort_day" in event ? event.sort_day : historical.sortDay,
        title: event.title,
        description: event.description,
        importance: event.importance,
        location: event.location,
        imageUrl: event.image_url,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        sources: [],
        tags: []
      };
    });
  },

  async update(id: number, input: EventInput): Promise<EventRecord | null> {
    const sql = getWriteSql("event update");

    return sql.begin(async (tx) => {
      const query = tx as unknown as Sql;
      await assertTimelineExists(query, input.timelineId);
      const historical = parseHistoricalDateInput(input.date, input.datePrecision);
      const hasHistoricalColumns = await hasHistoricalChronologyColumns(query);

      const [event] = await (hasHistoricalColumns
        ? query<{
            id: number;
            date: string;
            legacy_date: string;
            display_date: string | null;
            sort_year: number | null;
            sort_month: number | null;
            sort_day: number | null;
            date_precision: EventRecord["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
          }[]>`
            UPDATE events
            SET
              date = ${castLegacyDateExpression(query, historical.legacyDate)},
              date_precision = ${historical.datePrecision},
              sort_year = ${historical.sortYear},
              sort_month = ${historical.sortMonth},
              sort_day = ${historical.sortDay},
              display_date = ${historical.displayDate},
              title = ${input.title},
              description = ${input.description},
              importance = ${input.importance},
              location = ${input.location},
              image_url = ${input.imageUrl}
            WHERE id = ${id}
            RETURNING
              id,
              COALESCE(display_date, date::text) AS date,
              date::text AS legacy_date,
              display_date,
              sort_year,
              sort_month,
              sort_day,
              date_precision,
              title,
              description,
              importance,
              location,
              image_url,
              created_at::text AS created_at,
              updated_at::text AS updated_at
          `
        : query<{
            id: number;
            date: string;
            date_precision: EventRecord["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
          }[]>`
            UPDATE events
            SET
              date = ${castLegacyDateExpression(query, historical.legacyDate)},
              date_precision = ${historical.datePrecision},
              title = ${input.title},
              description = ${input.description},
              importance = ${input.importance},
              location = ${input.location},
              image_url = ${input.imageUrl}
            WHERE id = ${id}
            RETURNING id, date::text AS date, date_precision, title, description, importance, location, image_url, created_at::text AS created_at, updated_at::text AS updated_at
          `);

      if (!event) {
        return null;
      }

      const sourceIds = await resolveSourceIds(query, input.sources);

      const linkUpdate = await query`
        UPDATE timeline_events
        SET timeline_id = ${input.timelineId}, event_order = ${input.eventOrder}
        WHERE event_id = ${id}
      `;

      if (linkUpdate.count !== 1) {
        throw new ApiError(409, "EVENT_LINK_MISSING", "Event timeline link is missing.");
      }

      await Promise.all([
        query`DELETE FROM event_sources WHERE event_id = ${id}`,
        query`DELETE FROM event_tags WHERE event_id = ${id}`
      ]);

      await Promise.all([
        insertEventSources(query, id, sourceIds),
        insertEventTags(query, id, input.tagIds)
      ]);

      return {
        id: event.id,
        date: event.date,
        datePrecision: event.date_precision,
        legacyDate: "legacy_date" in event ? event.legacy_date : historical.legacyDate,
        displayDate: "display_date" in event ? event.display_date : historical.displayDate,
        sortYear: "sort_year" in event ? event.sort_year : historical.sortYear,
        sortMonth: "sort_month" in event ? event.sort_month : historical.sortMonth,
        sortDay: "sort_day" in event ? event.sort_day : historical.sortDay,
        title: event.title,
        description: event.description,
        importance: event.importance,
        location: event.location,
        imageUrl: event.image_url,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        sources: [],
        tags: []
      };
    });
  },

  async delete(id: number): Promise<boolean> {
    const sql = getWriteSql("event delete");

    const result = await sql`DELETE FROM events WHERE id = ${id}`;
    return result.count > 0;
  }
};
