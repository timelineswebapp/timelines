import type { EventRecord } from "@/src/lib/types";
import { getSql } from "@/src/server/db/client";
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

export const eventRepository = {
  async list(): Promise<EventRecord[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().flatMap((timeline) => timeline.events);
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
    }[]>`
      SELECT id, date::text AS date, date_precision, title, description, importance, location, image_url, created_at::text AS created_at, updated_at::text AS updated_at
      FROM events
      ORDER BY date DESC, id DESC
      LIMIT 200
    `;

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
      sources: [],
      tags: []
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

    const [event] = await sql<{
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
      throw new Error("Event insert failed.");
    }

    await sql`
      INSERT INTO timeline_events (timeline_id, event_id, event_order)
      VALUES (${input.timelineId}, ${event.id}, ${input.eventOrder})
    `;

    for (const sourceId of input.sourceIds) {
      await sql`
        INSERT INTO event_sources (event_id, source_id)
        VALUES (${event.id}, ${sourceId})
        ON CONFLICT DO NOTHING
      `;
    }

    for (const tagId of input.tagIds) {
      await sql`
        INSERT INTO event_tags (event_id, tag_id)
        VALUES (${event.id}, ${tagId})
        ON CONFLICT DO NOTHING
      `;
    }

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

    const [event] = await sql<{
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

    await sql`
      UPDATE timeline_events
      SET timeline_id = ${input.timelineId}, event_order = ${input.eventOrder}
      WHERE event_id = ${id}
    `;
    await sql`DELETE FROM event_sources WHERE event_id = ${id}`;
    await sql`DELETE FROM event_tags WHERE event_id = ${id}`;

    for (const sourceId of input.sourceIds) {
      await sql`
        INSERT INTO event_sources (event_id, source_id)
        VALUES (${id}, ${sourceId})
      `;
    }

    for (const tagId of input.tagIds) {
      await sql`
        INSERT INTO event_tags (event_id, tag_id)
        VALUES (${id}, ${tagId})
      `;
    }

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
