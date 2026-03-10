import type { EventRecord } from "@/src/lib/types";
import type { Sql } from "postgres";
import { getSql } from "@/src/server/db/client";
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
  sourceIds: number[];
  tagIds: number[];
};

function reorderEvents(events: EventRecord[]) {
  return [...events].sort((left, right) => left.date.localeCompare(right.date));
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

    const rows = await sql<{
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
    `;

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

  async create(input: EventInput): Promise<EventRecord> {
    const sql = getSql();
    if (!sql) {
      const timelines = memoryStore.getTimelines();
      const timeline = timelines.find((item) => item.id === input.timelineId);
      if (!timeline) {
        throw new Error("Timeline not found.");
      }

      const event = attachTaxonomyToEvent(
        {
          id: memoryStore.nextEventId(),
          date: input.date,
          datePrecision: input.datePrecision,
          title: input.title,
          description: input.description,
          importance: input.importance,
          location: input.location,
          imageUrl: input.imageUrl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          sources: [],
          tags: []
        },
        input.sourceIds,
        input.tagIds,
        memoryStore.getSources(),
        memoryStore.getTags()
      );

      timeline.events = reorderEvents([...timeline.events, event]);
      touchTimelineSummary(timeline);
      return event;
    }

    return sql.begin(async (tx) => {
      const query = tx as unknown as Sql;
      await assertTimelineExists(query, input.timelineId);

      const [event] = await query<{
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
        VALUES (${input.date}, ${input.datePrecision}, ${input.title}, ${input.description}, ${input.importance}, ${input.location}, ${input.imageUrl})
        RETURNING id, date::text AS date, date_precision, title, description, importance, location, image_url, created_at::text AS created_at, updated_at::text AS updated_at
      `;

      if (!event) {
        throw new ApiError(500, "EVENT_INSERT_FAILED", "Event insert failed.");
      }

      await query`
        INSERT INTO timeline_events (timeline_id, event_id, event_order)
        VALUES (${input.timelineId}, ${event.id}, ${input.eventOrder})
      `;

      await Promise.all([
        insertEventSources(query, event.id, input.sourceIds),
        insertEventTags(query, event.id, input.tagIds)
      ]);

      return {
        id: event.id,
        date: event.date,
        datePrecision: event.date_precision,
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
    const sql = getSql();
    if (!sql) {
      const timelines = memoryStore.getTimelines();
      const currentTimeline = timelines.find((timeline) => timeline.events.some((event) => event.id === id));
      const targetTimeline = timelines.find((timeline) => timeline.id === input.timelineId);

      if (!currentTimeline || !targetTimeline) {
        return null;
      }

      const existingEvent = currentTimeline.events.find((event) => event.id === id);
      if (!existingEvent) {
        return null;
      }

      const updatedEvent = attachTaxonomyToEvent(
        {
          ...existingEvent,
          date: input.date,
          datePrecision: input.datePrecision,
          title: input.title,
          description: input.description,
          importance: input.importance,
          location: input.location,
          imageUrl: input.imageUrl,
          updatedAt: new Date().toISOString()
        },
        input.sourceIds,
        input.tagIds,
        memoryStore.getSources(),
        memoryStore.getTags()
      );

      currentTimeline.events = currentTimeline.events.filter((event) => event.id !== id);
      targetTimeline.events = reorderEvents([...targetTimeline.events, updatedEvent]);
      touchTimelineSummary(currentTimeline);
      touchTimelineSummary(targetTimeline);
      return updatedEvent;
    }

    return sql.begin(async (tx) => {
      const query = tx as unknown as Sql;
      await assertTimelineExists(query, input.timelineId);

      const [event] = await query<{
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
          date = ${input.date},
          date_precision = ${input.datePrecision},
          title = ${input.title},
          description = ${input.description},
          importance = ${input.importance},
          location = ${input.location},
          image_url = ${input.imageUrl}
        WHERE id = ${id}
        RETURNING id, date::text AS date, date_precision, title, description, importance, location, image_url, created_at::text AS created_at, updated_at::text AS updated_at
      `;

      if (!event) {
        return null;
      }

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
        insertEventSources(query, id, input.sourceIds),
        insertEventTags(query, id, input.tagIds)
      ]);

      return {
        id: event.id,
        date: event.date,
        datePrecision: event.date_precision,
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
    const sql = getSql();
    if (!sql) {
      const timelines = memoryStore.getTimelines();
      const timeline = timelines.find((item) => item.events.some((event) => event.id === id));
      if (!timeline) {
        return false;
      }
      timeline.events = timeline.events.filter((event) => event.id !== id);
      touchTimelineSummary(timeline);
      return true;
    }

    const result = await sql`DELETE FROM events WHERE id = ${id}`;
    return result.count > 0;
  }
};
