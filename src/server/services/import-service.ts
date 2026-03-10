import Papa from "papaparse";
import type { ImportExecutionResult, ImportPreview, TimelineImportRow } from "@/src/lib/types";
import { getSql } from "@/src/server/db/client";
import { memoryStore } from "@/src/server/dev/memory-store";
import { eventRepository } from "@/src/server/repositories/event-repository";
import { importPreviewSchema, importRowSchema } from "@/src/server/validation/schemas";
import { timelineRepository } from "@/src/server/repositories/timeline-repository";

function parseRows(format: "csv" | "json", content: string): TimelineImportRow[] {
  if (format === "json") {
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("JSON import content must be an array.");
    }

    return parsed.map((row) => importRowSchema.parse(row));
  }

  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    throw new Error(result.errors[0]?.message || "CSV parsing failed.");
  }

  return result.data.map((row) =>
    importRowSchema.parse({
      date: row.date,
      datePrecision: row.datePrecision,
      title: row.title,
      description: row.description,
      importance: row.importance,
      location: row.location || null,
      imageUrl: row.imageUrl || null
    })
  );
}

async function getTimelineEventSignatures(timelineId: number): Promise<Set<string>> {
  const sql = getSql();
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
    return new Set(
      (timeline?.events || []).map((event) => `${event.date}:${event.title.trim().toLowerCase()}`)
    );
  }

  const rows = await sql<{ date: string; title: string }[]>`
    SELECT events.date::text AS date, events.title
    FROM timeline_events
    INNER JOIN events ON events.id = timeline_events.event_id
    WHERE timeline_events.timeline_id = ${timelineId}
  `;

  return new Set(rows.map((row) => `${row.date}:${row.title.trim().toLowerCase()}`));
}

export const importService = {
  async preview(rawInput: unknown): Promise<ImportPreview> {
    const input = importPreviewSchema.parse(rawInput);
    const rows = parseRows(input.format, input.content);
    const timeline = await timelineRepository.getById(input.timelineId);
    if (!timeline) {
      throw new Error("Timeline not found.");
    }

    const existingSignatures = await getTimelineEventSignatures(input.timelineId);
    const seen = new Set<string>();
    let duplicates = 0;
    const preview = rows.slice(0, 5).map((row) => ({
      date: row.date,
      title: row.title,
      description: row.description
    }));

    for (const row of rows) {
      const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
      if (seen.has(signature) || existingSignatures.has(signature)) {
        duplicates += 1;
      }
      seen.add(signature);
    }

    return {
      format: input.format,
      valid: true,
      totals: {
        rows: rows.length,
        duplicates,
        accepted: rows.length - duplicates
      },
      errors: [],
      preview
    };
  },

  async execute(rawInput: unknown): Promise<ImportExecutionResult> {
    const input = importPreviewSchema.parse(rawInput);
    const rows = parseRows(input.format, input.content);
    const timeline = await timelineRepository.getById(input.timelineId);
    if (!timeline) {
      throw new Error("Timeline not found.");
    }

    const seen = new Set<string>();
    const existingSignatures = await getTimelineEventSignatures(input.timelineId);
    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
      if (seen.has(signature) || existingSignatures.has(signature)) {
        skipped += 1;
        continue;
      }

      seen.add(signature);
      existingSignatures.add(signature);

      await eventRepository.create({
        timelineId: input.timelineId,
        eventOrder: timeline.eventCount + created + 1,
        date: row.date,
        datePrecision: row.datePrecision,
        title: row.title,
        description: row.description,
        importance: row.importance,
        location: row.location || null,
        imageUrl: row.imageUrl || null,
        sourceIds: [],
        tagIds: []
      });
      created += 1;
    }

    return { created, skipped };
  }
};
