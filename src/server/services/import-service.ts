import Papa from "papaparse";
import type { ImportPreview, TimelineImportRow } from "@/src/lib/types";
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

export const importService = {
  async preview(rawInput: unknown): Promise<ImportPreview> {
    const input = importPreviewSchema.parse(rawInput);
    const rows = parseRows(input.format, input.content);
    const timeline = await timelineRepository.getById(input.timelineId);
    if (!timeline) {
      throw new Error("Timeline not found.");
    }

    const seen = new Set<string>();
    let duplicates = 0;
    const preview = rows.slice(0, 5).map((row) => ({
      date: row.date,
      title: row.title,
      description: row.description
    }));

    for (const row of rows) {
      const signature = `${row.date}:${row.title.toLowerCase()}`;
      if (seen.has(signature) || timeline.highlightedEventTitles.some((title) => title.toLowerCase() === row.title.toLowerCase())) {
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
  }
};
