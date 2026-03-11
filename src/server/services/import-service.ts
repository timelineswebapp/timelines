import Papa from "papaparse";
import type { Sql } from "postgres";
import type {
  ImportExecutionResult,
  ImportPreview,
  ImportType,
  TimelineDetail,
  TimelineImportRow
} from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";
import { ApiError } from "@/src/server/api/responses";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { memoryStore, touchTimelineSummary } from "@/src/server/dev/memory-store";
import { importPreviewSchema, importRowSchema, importTimelineSchema } from "@/src/server/validation/schemas";

type ParsedImportData = {
  timeline: {
    title: string;
    description: string;
    category: string;
  } | null;
  events: TimelineImportRow[];
};

type CsvRow = Record<string, string>;

const CSV_FIELD_ALIASES = {
  date: ["date"],
  datePrecision: ["datePrecision", "date_precision"],
  title: ["title"],
  description: ["description"],
  importance: ["importance"],
  location: ["location"],
  imageUrl: ["imageUrl", "image_url"],
  timelineTitle: ["timelineTitle", "timeline_title"],
  timelineDescription: ["timelineDescription", "timeline_description"],
  timelineCategory: ["timelineCategory", "timeline_category", "category"]
} as const;

function getCsvValue(row: CsvRow, aliases: readonly string[]): string | undefined {
  for (const alias of aliases) {
    const value = row[alias];
    if (typeof value === "string") {
      return value;
    }
  }

  return undefined;
}

function getCsvValueWithAlias(row: CsvRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    const value = row[alias];
    if (typeof value === "string") {
      return {
        value,
        alias
      };
    }
  }

  return {
    value: undefined,
    alias: aliases[0] ?? "unknown"
  };
}

function inferPrecisionFromDate(rawDate?: string): TimelineImportRow["datePrecision"] | null {
  const value = rawDate?.trim();
  if (!value) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "day";
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return "month";
  }

  if (/^\d{4}$/.test(value)) {
    return "year";
  }

  return null;
}

function isDateValidationError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "Day precision dates must use YYYY-MM-DD.",
    "Month precision dates must use YYYY-MM.",
    "Year precision dates must use YYYY.",
    "Date must be in YYYY-MM-DD, YYYY-MM, or YYYY format."
  ].includes(error.message);
}

function throwCsvValidationError(
  message: string,
  details?: {
    row?: number;
    code?: string;
    field?: string;
  }
): never {
  throw new ApiError(
    400,
    "VALIDATION_FAILED",
    message,
    details
      ? {
          ...details,
          row: typeof details.row === "number" ? details.row + 2 : undefined
        }
      : undefined
  );
}

function normalizeDate(rawDate: string, rawPrecision?: TimelineImportRow["datePrecision"]) {
  const value = rawDate.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (rawPrecision && rawPrecision !== "day") {
      throw new Error("Day precision dates must use YYYY-MM-DD.");
    }

    return {
      date: value,
      datePrecision: "day" as const
    };
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    if (rawPrecision && rawPrecision !== "month") {
      throw new Error("Month precision dates must use YYYY-MM.");
    }

    return {
      date: `${value}-01`,
      datePrecision: "month" as const
    };
  }

  if (/^\d{4}$/.test(value)) {
    if (rawPrecision && rawPrecision !== "year") {
      throw new Error("Year precision dates must use YYYY.");
    }

    return {
      date: `${value}-01-01`,
      datePrecision: "year" as const
    };
  }

  throw new Error("Date must be in YYYY-MM-DD, YYYY-MM, or YYYY format.");
}

function normalizeRow(row: unknown): TimelineImportRow {
  const parsed = importRowSchema.parse(row);
  const normalized = normalizeDate(parsed.date, parsed.datePrecision);

  return {
    date: normalized.date,
    datePrecision: normalized.datePrecision,
    title: parsed.title,
    description: parsed.description,
    importance: parsed.importance,
    location: parsed.location || null,
    imageUrl: parsed.imageUrl || null
  };
}

function parseJsonImport(importType: ImportType, content: string): ParsedImportData {
  const parsed = JSON.parse(content) as unknown;

  if (importType === "timeline_with_events") {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Timeline import JSON must be an object with `timeline` and `events`.");
    }

    const payload = parsed as { timeline?: unknown; events?: unknown };
    if (!Array.isArray(payload.events)) {
      throw new Error("Timeline import JSON must include an `events` array.");
    }

    return {
      timeline: importTimelineSchema.parse(payload.timeline),
      events: payload.events.map((row) => normalizeRow(row))
    };
  }

  if (Array.isArray(parsed)) {
    return {
      timeline: null,
      events: parsed.map((row) => normalizeRow(row))
    };
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
    return {
      timeline: null,
      events: (parsed as { events: unknown[] }).events.map((row) => normalizeRow(row))
    };
  }

  throw new Error("Event import JSON must be an array of events or an object with an `events` array.");
}

function parseCsvImport(importType: ImportType, content: string): ParsedImportData {
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throwCsvValidationError(firstError?.message || "CSV parsing failed.", {
      row: typeof firstError?.row === "number" ? firstError.row : undefined,
      code: firstError?.code
    });
  }

  if (result.data.length === 0) {
    throwCsvValidationError("CSV import must include at least one data row.");
  }

  const firstRow = result.data[0];
  if (!firstRow) {
    throwCsvValidationError("CSV import must include at least one data row.");
  }

  const events = result.data.map((row, index) => {
    const dateField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.date);
    const datePrecisionField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.datePrecision);
    const titleField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.title);
    const descriptionField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.description);
    const importanceField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.importance);
    const locationField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.location);
    const imageUrlField = getCsvValueWithAlias(row, CSV_FIELD_ALIASES.imageUrl);
    const normalizedRow = {
      date: dateField.value,
      datePrecision: datePrecisionField.value,
      title: titleField.value,
      description: descriptionField.value,
      importance: importanceField.value,
      location: locationField.value || null,
      imageUrl: imageUrlField.value || null
    };
    const normalizedHeaderKeys = {
      date: dateField.alias,
      datePrecision: datePrecisionField.alias,
      title: titleField.alias,
      description: descriptionField.alias,
      importance: importanceField.alias,
      location: locationField.alias,
      imageUrl: imageUrlField.alias
    };

    try {
      return normalizeRow(normalizedRow);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (isDateValidationError(error)) {
        const inferredPrecision = inferPrecisionFromDate(normalizedRow.date);
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Row ${index + 2}: date='${normalizedRow.date || ""}', precision='${normalizedRow.datePrecision || ""}', normalized precision='${inferredPrecision || "unknown"}'`,
          {
            row: index + 2,
            parsedDate: normalizedRow.date || null,
            parsedDatePrecision: normalizedRow.datePrecision || null,
            normalizedPrecision: inferredPrecision,
            normalizedHeaderKeys,
            fields: [
              {
                field: "date",
                message: error.message
              }
            ]
          }
        );
      }

      if (error instanceof Error && "issues" in error) {
        throw new ApiError(400, "VALIDATION_FAILED", "CSV row validation failed.", {
          row: index + 2,
          parsedDate: normalizedRow.date || null,
          parsedDatePrecision: normalizedRow.datePrecision || null,
          normalizedHeaderKeys,
          fields: (error as { issues?: Array<{ path?: string[]; message?: string }> }).issues?.map((issue) => ({
            field: issue.path?.join(".") || "unknown",
            message: issue.message || "Invalid value"
          }))
        });
      }

      throwCsvValidationError(error instanceof Error ? error.message : "CSV row validation failed.", {
        row: index,
        code: "CSV_ROW_INVALID"
      });
    }
  });

  if (importType === "timeline_with_events") {
    const timelineTitle = getCsvValue(firstRow, CSV_FIELD_ALIASES.timelineTitle);
    const timelineDescription = getCsvValue(firstRow, CSV_FIELD_ALIASES.timelineDescription);
    const timelineCategory = getCsvValue(firstRow, CSV_FIELD_ALIASES.timelineCategory);

    return {
      timeline: (() => {
        try {
          return importTimelineSchema.parse({
            title: timelineTitle,
            description: timelineDescription,
            category: timelineCategory
          });
        } catch (error) {
          if (error instanceof Error && "issues" in error) {
            throw new ApiError(400, "VALIDATION_FAILED", "CSV timeline metadata validation failed.", {
              row: 2,
              fields: (error as { issues?: Array<{ path?: string[]; message?: string }> }).issues?.map((issue) => ({
                field: issue.path?.join(".") || "unknown",
                message: issue.message || "Invalid value"
              }))
            });
          }

          throw error;
        }
      })(),
      events
    };
  }

  return {
    timeline: null,
    events
  };
}

function parseTextImport(importType: ImportType, content: string): ParsedImportData {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error("Text import must not be empty.");
  }

  let title = "";
  let description = "";
  let category = "";
  const eventLines: string[] = [];

  for (const line of lines) {
    if (/^title:/i.test(line)) {
      title = line.replace(/^title:/i, "").trim();
      continue;
    }

    if (/^description:/i.test(line)) {
      description = line.replace(/^description:/i, "").trim();
      continue;
    }

    if (/^category:/i.test(line)) {
      category = line.replace(/^category:/i, "").trim();
      continue;
    }

    if (/^events:/i.test(line)) {
      continue;
    }

    eventLines.push(line);
  }

  const events = eventLines.map((line) => {
    const [date, titlePart, descriptionPart, precisionPart] = line.split("|").map((part) => part.trim());
    return normalizeRow({
      date,
      datePrecision: precisionPart || undefined,
      title: titlePart,
      description: descriptionPart,
      importance: 3
    });
  });

  if (importType === "timeline_with_events") {
    return {
      timeline: importTimelineSchema.parse({
        title,
        description,
        category
      }),
      events
    };
  }

  return {
    timeline: null,
    events
  };
}

function parseImportContent(format: "csv" | "json" | "text", importType: ImportType, content: string): ParsedImportData {
  if (format === "json") {
    return parseJsonImport(importType, content);
  }

  if (format === "csv") {
    return parseCsvImport(importType, content);
  }

  return parseTextImport(importType, content);
}

async function getTimelineSummaryById(sql: Sql | null, timelineId: number) {
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
    if (!timeline) {
      return null;
    }

    return {
      id: timeline.id,
      title: timeline.title,
      description: timeline.description,
      category: timeline.category,
      eventCount: timeline.events.length
    };
  }

  const [row] = await sql<{
    id: number;
    title: string;
    description: string;
    category: string;
    event_count: number;
  }[]>`
    SELECT
      timelines.id,
      timelines.title,
      timelines.description,
      timelines.category,
      COUNT(timeline_events.event_id)::int AS event_count
    FROM timelines
    LEFT JOIN timeline_events ON timeline_events.timeline_id = timelines.id
    WHERE timelines.id = ${timelineId}
    GROUP BY timelines.id
    LIMIT 1
  `;

  return row
    ? {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        eventCount: row.event_count
      }
    : null;
}

async function getTimelineEventSignatures(sql: Sql | null, timelineId: number): Promise<Set<string>> {
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

async function timelineSlugExists(sql: Sql | null, title: string): Promise<boolean> {
  const slug = slugify(title);

  if (!sql) {
    return memoryStore.getTimelines().some((timeline) => timeline.slug === slug);
  }

  const [row] = await sql<{ id: number }[]>`
    SELECT id
    FROM timelines
    WHERE slug = ${slug}
    LIMIT 1
  `;

  return Boolean(row);
}

function buildPreviewRows(events: TimelineImportRow[], duplicateSet: Set<string>) {
  return events.slice(0, 8).map((row) => ({
    date: row.date,
    title: row.title,
    description: row.description,
    duplicate: duplicateSet.has(`${row.date}:${row.title.trim().toLowerCase()}`)
  }));
}

function buildDuplicateSet(events: TimelineImportRow[], existingSignatures: Set<string>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of events) {
    const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
    if (seen.has(signature) || existingSignatures.has(signature)) {
      duplicates.add(signature);
    }
    seen.add(signature);
  }

  return duplicates;
}

function ensureExistingTimelineId(input: { timelineId?: number | null }, importType: ImportType): number {
  if (importType === "events_into_existing_timeline") {
    if (!input.timelineId) {
      throw new ApiError(400, "TIMELINE_ID_REQUIRED", "Timeline ID is required for event imports.");
    }

    return input.timelineId;
  }

  return 0;
}

async function executeMemoryImport(parsed: ParsedImportData, importType: ImportType, skipDuplicates: boolean, timelineId?: number | null): Promise<ImportExecutionResult> {
  let targetTimeline: TimelineDetail | undefined;
  let timelineCreated = false;

  if (importType === "timeline_with_events") {
    if (!parsed.timeline) {
      throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
    }

    if (await timelineSlugExists(null, parsed.timeline.title)) {
      throw new ApiError(409, "TIMELINE_EXISTS", "A timeline with the same slug already exists.");
    }

    targetTimeline = {
      id: memoryStore.nextTimelineId(),
      title: parsed.timeline.title,
      slug: slugify(parsed.timeline.title),
      description: parsed.timeline.description,
      category: parsed.timeline.category,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: [],
      eventCount: 0,
      highlightedEventTitles: [],
      events: [],
      relatedTimelines: []
    };
    memoryStore.setTimelines([...memoryStore.getTimelines(), targetTimeline]);
    timelineCreated = true;
  } else {
    targetTimeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
    if (!targetTimeline) {
      throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
    }
  }

  const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(null, targetTimeline.id));
  if (!skipDuplicates && duplicateSet.size > 0) {
    throw new ApiError(409, "DUPLICATES_FOUND", "Duplicate events detected.");
  }

  let created = 0;
  const startOrder = targetTimeline.events.length;

  for (const row of parsed.events) {
    const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
    if (duplicateSet.has(signature) && skipDuplicates) {
      continue;
    }

    targetTimeline.events.push({
      id: memoryStore.nextEventId(),
      date: row.date,
      datePrecision: row.datePrecision,
      title: row.title,
      description: row.description,
      importance: row.importance,
      location: row.location || null,
      imageUrl: row.imageUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sources: [],
      tags: [],
      timelineLinks: [
        {
          timelineId: targetTimeline.id,
          slug: targetTimeline.slug,
          title: targetTimeline.title,
          eventOrder: startOrder + created + 1
        }
      ]
    });
    created += 1;
  }

  targetTimeline.events.sort((left, right) => left.date.localeCompare(right.date));
  touchTimelineSummary(targetTimeline);

  return {
    message: "Timeline and events successfully imported",
    timelineId: targetTimeline.id,
    eventsCreatedCount: created,
    duplicatesSkipped: duplicateSet.size,
    timelineCreated
  };
}

async function executeDatabaseImport(parsed: ParsedImportData, importType: ImportType, skipDuplicates: boolean, existingTimelineId?: number | null): Promise<ImportExecutionResult> {
  const sql = getWriteSql("import");

  return sql.begin(async (tx) => {
    const query = tx as unknown as Sql;
    let timelineId = existingTimelineId || 0;
    let existingTimelineEventCount = 0;
    let timelineCreated = false;

    if (importType === "timeline_with_events") {
      if (!parsed.timeline) {
        throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
      }

      if (await timelineSlugExists(query, parsed.timeline.title)) {
        throw new ApiError(409, "TIMELINE_EXISTS", "A timeline with the same slug already exists.");
      }

      const [timelineRow] = await query<{ id: number }[]>`
        INSERT INTO timelines (title, slug, description, category)
        VALUES (${parsed.timeline.title}, ${slugify(parsed.timeline.title)}, ${parsed.timeline.description}, ${parsed.timeline.category})
        RETURNING id
      `;

      if (!timelineRow) {
        throw new ApiError(500, "TIMELINE_INSERT_FAILED", "Timeline insert failed.");
      }

      timelineId = timelineRow.id;
      timelineCreated = true;
    } else {
      const summary = await getTimelineSummaryById(query, ensureExistingTimelineId({ timelineId: existingTimelineId }, importType));
      if (!summary) {
        throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
      }
      timelineId = summary.id;
      existingTimelineEventCount = summary.eventCount;
    }

    const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(query, timelineId));
    if (!skipDuplicates && duplicateSet.size > 0) {
      throw new ApiError(409, "DUPLICATES_FOUND", "Duplicate events detected.");
    }

    let created = 0;
    for (const row of parsed.events) {
      const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
      if (duplicateSet.has(signature) && skipDuplicates) {
        continue;
      }

      const [eventRow] = await query<{ id: number }[]>`
        INSERT INTO events (date, date_precision, title, description, importance, location, image_url)
        VALUES (${row.date}, ${row.datePrecision}, ${row.title}, ${row.description}, ${row.importance}, ${row.location || null}, ${row.imageUrl || null})
        RETURNING id
      `;

      if (!eventRow) {
        throw new ApiError(500, "EVENT_INSERT_FAILED", "Event insert failed.");
      }

      await query`
        INSERT INTO timeline_events (timeline_id, event_id, event_order)
        VALUES (${timelineId}, ${eventRow.id}, ${existingTimelineEventCount + created + 1})
      `;
      created += 1;
    }

    if (importType === "timeline_with_events" && created < 1) {
      throw new ApiError(409, "NO_EVENTS_IMPORTED", "No events were persisted for the imported timeline.");
    }

    await query`
      UPDATE timelines
      SET updated_at = NOW()
      WHERE id = ${timelineId}
    `;

    return {
      message: "Timeline and events successfully imported",
      timelineId,
      eventsCreatedCount: created,
      duplicatesSkipped: duplicateSet.size,
      timelineCreated
    };
  });
}

export const importService = {
  async preview(rawInput: unknown): Promise<ImportPreview> {
    const input = importPreviewSchema.parse(rawInput);
    const parsed = parseImportContent(input.format, input.importType, input.content);

    let timelineContext;
    if (input.importType === "timeline_with_events") {
      if (!parsed.timeline) {
        throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
      }

      timelineContext = {
        mode: "create" as const,
        timelineId: null,
        title: parsed.timeline.title,
        description: parsed.timeline.description,
        category: parsed.timeline.category
      };

      if (await timelineSlugExists(getSql(), parsed.timeline.title)) {
        throw new ApiError(409, "TIMELINE_EXISTS", "A timeline with the same slug already exists.");
      }
    } else {
      const timelineId = ensureExistingTimelineId(input, input.importType);
      const summary = await getTimelineSummaryById(getSql(), timelineId);
      if (!summary) {
        throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
      }

      timelineContext = {
        mode: "existing" as const,
        timelineId: summary.id,
        title: summary.title,
        description: summary.description,
        category: summary.category
      };
    }

    const duplicateSet = buildDuplicateSet(
      parsed.events,
      timelineContext.mode === "existing"
        ? await getTimelineEventSignatures(getSql(), timelineContext.timelineId)
        : new Set()
    );

    return {
      format: input.format,
      importType: input.importType,
      valid: true,
      timeline: timelineContext,
      totals: {
        rows: parsed.events.length,
        duplicates: duplicateSet.size,
        accepted: parsed.events.length - duplicateSet.size
      },
      errors: [],
      preview: buildPreviewRows(parsed.events, duplicateSet),
      skipDuplicates: input.skipDuplicates
    };
  },

  async execute(rawInput: unknown): Promise<ImportExecutionResult> {
    const input = importPreviewSchema.parse(rawInput);
    const parsed = parseImportContent(input.format, input.importType, input.content);

    if (input.importType === "timeline_with_events" && !parsed.timeline) {
      throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
    }

    return executeDatabaseImport(parsed, input.importType, input.skipDuplicates, input.timelineId ?? null);
  }
};
