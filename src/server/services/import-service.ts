import Papa from "papaparse";
import type { Sql } from "postgres";
import type {
  ImportReason,
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
  timelineGroups: ParsedTimelineGroup[];
  events: ParsedEventRow[];
};

type ParsedTimelineMetadata = {
  title: string;
  slug: string;
  description: string;
  category: string;
};

type ParsedEventRow = TimelineImportRow & {
  sourceRow: number;
};

type ParsedTimelineGroup = {
  timeline: ParsedTimelineMetadata;
  events: ParsedEventRow[];
};

type CsvRow = Record<string, string>;

const CANONICAL_CSV_HEADERS = [
  "timeline_title",
  "timeline_slug",
  "timeline_description",
  "category",
  "event_order",
  "date",
  "date_precision",
  "title",
  "description",
  "importance",
  "location",
  "image_url",
  "source_publisher",
  "source_url",
  "source_credibility",
  "tags"
] as const;

const CSV_FIELD_ALIASES = {
  timeline_title: ["timeline_title", "timelineTitle"],
  timeline_slug: ["timeline_slug", "timelineSlug"],
  timeline_description: ["timeline_description", "timelineDescription"],
  category: ["category", "timeline_category", "timelineCategory"],
  event_order: ["event_order", "eventOrder"],
  date: ["date"],
  date_precision: ["date_precision", "datePrecision"],
  title: ["title"],
  description: ["description"],
  importance: ["importance"],
  location: ["location"],
  image_url: ["image_url", "imageUrl"],
  source_publisher: ["source_publisher", "sourcePublisher"],
  source_url: ["source_url", "sourceUrl"],
  source_credibility: ["source_credibility", "sourceCredibility"],
  tags: ["tags"]
} as const;

type TimelineSummaryForImport = {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  eventCount: number;
};

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

function normalizeCsvRow(row: CsvRow) {
  const normalized = {} as Record<(typeof CANONICAL_CSV_HEADERS)[number], string | undefined>;
  const normalizedHeaderKeys = {} as Record<(typeof CANONICAL_CSV_HEADERS)[number], string>;

  for (const header of CANONICAL_CSV_HEADERS) {
    const { value, alias } = getCsvValueWithAlias(row, CSV_FIELD_ALIASES[header]);
    normalized[header] = value;
    normalizedHeaderKeys[header] = alias;
  }

  return {
    row: normalized,
    normalizedHeaderKeys
  };
}

function validateCsvHeaderCount(fields: string[] | undefined) {
  const actualHeaderCount = fields?.length ?? 0;
  if (actualHeaderCount !== CANONICAL_CSV_HEADERS.length) {
    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      `CSV header count mismatch: expected ${CANONICAL_CSV_HEADERS.length} columns but parsed ${actualHeaderCount}.`,
      {
        expectedFieldCount: CANONICAL_CSV_HEADERS.length,
        actualHeaderCount,
        parsedHeaders: fields || [],
        canonicalHeaders: [...CANONICAL_CSV_HEADERS]
      }
    );
  }
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

function isValidSqlDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parts = value.split("-").map(Number);
  if (parts.length !== 3) {
    return false;
  }

  const [yearPart, monthPart, dayPart] = parts;
  if (
    typeof yearPart !== "number" ||
    typeof monthPart !== "number" ||
    typeof dayPart !== "number"
  ) {
    return false;
  }

  const date = new Date(Date.UTC(yearPart, monthPart - 1, dayPart));

  return (
    Number.isInteger(yearPart) &&
    Number.isInteger(monthPart) &&
    Number.isInteger(dayPart) &&
    date.getUTCFullYear() === yearPart &&
    date.getUTCMonth() === monthPart - 1 &&
    date.getUTCDate() === dayPart
  );
}

function isDateValidationError(error: unknown): error is Error {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "Day precision dates must use YYYY-MM-DD.",
    "Month precision dates must use YYYY-MM-01.",
    "Year precision dates must use YYYY-01-01.",
    "Approximate precision dates must use a valid SQL date in YYYY-MM-DD format.",
    "Date must be in YYYY-MM-DD, YYYY-MM, or YYYY format."
  ].includes(error.message);
}

function extractValidationFields(error: unknown) {
  if (!(error instanceof Error) || !("issues" in error)) {
    return undefined;
  }

  return (error as { issues?: Array<{ path?: string[]; message?: string }> }).issues?.map((issue) => ({
    field: issue.path?.join(".") || "unknown",
    message: issue.message || "Invalid value"
  }));
}

function normalizeStructuredRow(row: unknown, rowNumber: number): ParsedEventRow {
  try {
    return normalizeRow(row);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isDateValidationError(error)) {
      const candidate = row as Partial<TimelineImportRow> | null;
      const normalizedPrecision = candidate?.datePrecision || inferPrecisionFromDate(candidate?.date);
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Row ${rowNumber}: date='${candidate?.date || ""}', precision='${candidate?.datePrecision || ""}', normalized precision='${normalizedPrecision || "unknown"}'`,
        {
          row: rowNumber,
          parsedDate: candidate?.date || null,
          parsedDatePrecision: candidate?.datePrecision || null,
          normalizedPrecision,
          fields: [
            {
              field: "date",
              message: error.message
            }
          ]
        }
      );
    }

    const fields = extractValidationFields(error);
    if (fields) {
      throw new ApiError(400, "VALIDATION_FAILED", "Import row validation failed.", {
        row: rowNumber,
        fields
      });
    }

    throw new ApiError(
      400,
      "VALIDATION_FAILED",
      error instanceof Error ? error.message : "Import row validation failed.",
      {
        row: rowNumber
      }
    );
  }
}

function normalizeTimelineMetadata(input: unknown, message: string): ParsedTimelineMetadata {
  try {
    const parsed = importTimelineSchema.parse(input);
    return {
      title: parsed.title,
      slug: parsed.slug || slugify(parsed.title),
      description: parsed.description,
      category: parsed.category
    };
  } catch (error) {
    const fields = extractValidationFields(error);
    throw new ApiError(400, "VALIDATION_FAILED", message, {
      fields
    });
  }
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

  if (rawPrecision) {
    if (rawPrecision === "day") {
      if (!isValidSqlDate(value)) {
        throw new Error("Day precision dates must use YYYY-MM-DD.");
      }

      return {
        date: value,
        datePrecision: "day" as const
      };
    }

    if (rawPrecision === "month") {
      if (!isValidSqlDate(value) || !/^\d{4}-\d{2}-01$/.test(value)) {
        throw new Error("Month precision dates must use YYYY-MM-01.");
      }

      return {
        date: value,
        datePrecision: "month" as const
      };
    }

    if (rawPrecision === "year") {
      if (!isValidSqlDate(value) || !/^\d{4}-01-01$/.test(value)) {
        throw new Error("Year precision dates must use YYYY-01-01.");
      }

      return {
        date: value,
        datePrecision: "year" as const
      };
    }

    if (!isValidSqlDate(value)) {
      throw new Error("Approximate precision dates must use a valid SQL date in YYYY-MM-DD format.");
    }

    return {
      date: value,
      datePrecision: "approximate" as const
    };
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return {
      date: value,
      datePrecision: "day" as const
    };
  }

  if (/^\d{4}-\d{2}$/.test(value)) {
    return {
      date: `${value}-01`,
      datePrecision: "month" as const
    };
  }

  if (/^\d{4}$/.test(value)) {
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new ApiError(400, "VALIDATION_FAILED", "Invalid JSON import payload.");
  }

  if (importType === "timeline_with_events") {
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Timeline import JSON must be an object with `timeline` and `events`.");
    }

    const payload = parsed as { timeline?: unknown; events?: unknown };
    if (!Array.isArray(payload.events)) {
      throw new ApiError(400, "VALIDATION_FAILED", "Timeline import JSON must include an `events` array.");
    }

    return {
      timeline: normalizeTimelineMetadata(payload.timeline, "JSON timeline metadata validation failed."),
      events: payload.events.map((row, index) => normalizeStructuredRow(row, index + 1))
    };
  }

  if (Array.isArray(parsed)) {
    return {
      timeline: null,
      events: parsed.map((row, index) => normalizeStructuredRow(row, index + 1))
    };
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
    return {
      timeline: null,
      events: (parsed as { events: unknown[] }).events.map((row, index) => normalizeStructuredRow(row, index + 1))
    };
  }

  throw new ApiError(400, "VALIDATION_FAILED", "Event import JSON must be an array of events or an object with an `events` array.");
}

function parseCsvImport(importType: ImportType, content: string): ParsedImportData {
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true
  });

  validateCsvHeaderCount(result.meta.fields);

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
    const { row: normalizedCsvRow, normalizedHeaderKeys } = normalizeCsvRow(row);
    const normalizedRow = {
      date: normalizedCsvRow.date,
      datePrecision: normalizedCsvRow.date_precision,
      title: normalizedCsvRow.title,
      description: normalizedCsvRow.description,
      importance: normalizedCsvRow.importance,
      location: normalizedCsvRow.location || null,
      imageUrl: normalizedCsvRow.image_url || null
    };

    try {
      return normalizeRow(normalizedRow);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (isDateValidationError(error)) {
        const normalizedPrecision = normalizedRow.datePrecision || inferPrecisionFromDate(normalizedRow.date);
        throw new ApiError(
          400,
          "VALIDATION_FAILED",
          `Row ${index + 2}: date='${normalizedRow.date || ""}', precision='${normalizedRow.datePrecision || ""}', normalized precision='${normalizedPrecision || "unknown"}'`,
          {
            row: index + 2,
            parsedDate: normalizedRow.date || null,
            parsedDatePrecision: normalizedRow.datePrecision || null,
            normalizedPrecision,
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
    const { row: normalizedFirstRow } = normalizeCsvRow(firstRow);
    const timelineTitle = normalizedFirstRow.timeline_title;
    const timelineSlug = normalizedFirstRow.timeline_slug;
    const timelineDescription = normalizedFirstRow.timeline_description;
    const timelineCategory = normalizedFirstRow.category;

    return {
      timeline: (() => {
        const metadata = normalizeTimelineMetadata(
          {
            title: timelineTitle,
            slug: timelineSlug,
            description: timelineDescription,
            category: timelineCategory
          },
          "CSV timeline metadata validation failed."
        );

        return metadata;
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
    throw new ApiError(400, "VALIDATION_FAILED", "Text import must not be empty.");
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

  const events = eventLines.map((line, index) => {
    const [date, titlePart, descriptionPart, precisionPart] = line.split("|").map((part) => part.trim());
    return normalizeStructuredRow({
      date,
      datePrecision: precisionPart || undefined,
      title: titlePart,
      description: descriptionPart,
      importance: 3
    }, index + 1);
  });

  if (importType === "timeline_with_events") {
    return {
      timeline: normalizeTimelineMetadata(
        {
          title,
          slug: undefined,
          description,
          category
        },
        "Text timeline metadata validation failed."
      ),
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

async function getTimelineSummaryById(sql: Sql | null, timelineId: number): Promise<TimelineSummaryForImport | null> {
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
    if (!timeline) {
      return null;
    }

    return {
      id: timeline.id,
      title: timeline.title,
      slug: timeline.slug,
      description: timeline.description,
      category: timeline.category,
      eventCount: timeline.events.length
    };
  }

  const [row] = await sql<{
    id: number;
    title: string;
    slug: string;
    description: string;
    category: string;
    event_count: number;
  }[]>`
    SELECT
      timelines.id,
      timelines.title,
      timelines.slug,
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
        slug: row.slug,
        description: row.description,
        category: row.category,
        eventCount: row.event_count
      }
    : null;
}

async function getTimelineSummaryBySlug(sql: Sql | null, slug: string): Promise<TimelineSummaryForImport | null> {
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((candidate) => candidate.slug === slug);
    if (!timeline) {
      return null;
    }

    return {
      id: timeline.id,
      title: timeline.title,
      slug: timeline.slug,
      description: timeline.description,
      category: timeline.category,
      eventCount: timeline.events.length
    };
  }

  const [row] = await sql<{
    id: number;
    title: string;
    slug: string;
    description: string;
    category: string;
    event_count: number;
  }[]>`
    SELECT
      timelines.id,
      timelines.title,
      timelines.slug,
      timelines.description,
      timelines.category,
      COUNT(timeline_events.event_id)::int AS event_count
    FROM timelines
    LEFT JOIN timeline_events ON timeline_events.timeline_id = timelines.id
    WHERE timelines.slug = ${slug}
    GROUP BY timelines.id
    LIMIT 1
  `;

  return row
    ? {
        id: row.id,
        title: row.title,
        slug: row.slug,
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
  let skippedTimelinesCount = 0;
  const reasons: ImportReason[] = [];

  if (importType === "timeline_with_events") {
    if (!parsed.timeline) {
      throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
    }

    const existingTimeline = await getTimelineSummaryBySlug(null, parsed.timeline.slug);
    if (existingTimeline) {
      skippedTimelinesCount = 1;
      reasons.push({
        type: "timeline_skipped",
        timelineSlug: existingTimeline.slug,
        message: `Timeline slug '${existingTimeline.slug}' already exists. Reusing existing timeline.`
      });
      targetTimeline = memoryStore.getTimelines().find((candidate) => candidate.id === existingTimeline.id);
      if (!targetTimeline) {
        throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
      }
    } else {
      targetTimeline = {
        id: memoryStore.nextTimelineId(),
        title: parsed.timeline.title,
        slug: parsed.timeline.slug,
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
    }
  } else {
    targetTimeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
    if (!targetTimeline) {
      throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
    }
  }

  const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(null, targetTimeline.id));
  let created = 0;
  let duplicateCount = 0;
  const startOrder = targetTimeline.events.length;

  for (const [index, row] of parsed.events.entries()) {
    const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
    if (duplicateSet.has(signature)) {
      duplicateCount += 1;
      reasons.push({
        type: "event_skipped",
        timelineSlug: targetTimeline.slug,
        row: index + 2,
        date: row.date,
        title: row.title,
        message: `Event '${row.title}' on ${row.date} already exists under timeline '${targetTimeline.slug}'.`
      });
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
    duplicatesSkipped: duplicateCount,
    timelineCreated,
    importedTimelinesCount: timelineCreated ? 1 : 0,
    importedEventsCount: created,
    skippedTimelinesCount,
    skippedEventsCount: duplicateCount,
    reasons
  };
}

async function executeDatabaseImport(parsed: ParsedImportData, importType: ImportType, skipDuplicates: boolean, existingTimelineId?: number | null): Promise<ImportExecutionResult> {
  const sql = getWriteSql("import");

  return sql.begin(async (tx) => {
    const query = tx as unknown as Sql;
    let timelineId = existingTimelineId || 0;
    let existingTimelineEventCount = 0;
    let timelineCreated = false;
    let timelineSlug = "";
    let skippedTimelinesCount = 0;
    const reasons: ImportReason[] = [];

    if (importType === "timeline_with_events") {
      if (!parsed.timeline) {
        throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
      }

      const existingTimeline = await getTimelineSummaryBySlug(query, parsed.timeline.slug);
      if (existingTimeline) {
        timelineId = existingTimeline.id;
        existingTimelineEventCount = existingTimeline.eventCount;
        timelineSlug = existingTimeline.slug;
        skippedTimelinesCount = 1;
        reasons.push({
          type: "timeline_skipped",
          timelineSlug,
          message: `Timeline slug '${timelineSlug}' already exists. Reusing existing timeline.`
        });
      } else {
        const [timelineRow] = await query<{ id: number }[]>`
          INSERT INTO timelines (title, slug, description, category)
          VALUES (${parsed.timeline.title}, ${parsed.timeline.slug}, ${parsed.timeline.description}, ${parsed.timeline.category})
          RETURNING id
        `;

        if (!timelineRow) {
          throw new ApiError(500, "TIMELINE_INSERT_FAILED", "Timeline insert failed.");
        }

        timelineId = timelineRow.id;
        timelineSlug = parsed.timeline.slug;
        timelineCreated = true;
      }
    } else {
      const summary = await getTimelineSummaryById(query, ensureExistingTimelineId({ timelineId: existingTimelineId }, importType));
      if (!summary) {
        throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
      }
      timelineId = summary.id;
      existingTimelineEventCount = summary.eventCount;
      timelineSlug = summary.slug;
    }

    const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(query, timelineId));

    let created = 0;
    let duplicateCount = 0;
    for (const [index, row] of parsed.events.entries()) {
      const signature = `${row.date}:${row.title.trim().toLowerCase()}`;
      if (duplicateSet.has(signature)) {
        duplicateCount += 1;
        reasons.push({
          type: "event_skipped",
          timelineSlug,
          row: index + 2,
          date: row.date,
          title: row.title,
          message: `Event '${row.title}' on ${row.date} already exists under timeline '${timelineSlug}'.`
        });
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

    if (timelineCreated && created < 1) {
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
      duplicatesSkipped: duplicateCount,
      timelineCreated,
      importedTimelinesCount: timelineCreated ? 1 : 0,
      importedEventsCount: created,
      skippedTimelinesCount,
      skippedEventsCount: duplicateCount,
      reasons
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
      const existingTimeline = await getTimelineSummaryBySlug(getSql(), parsed.timeline.slug);

      timelineContext = existingTimeline
        ? {
            mode: "existing" as const,
            timelineId: existingTimeline.id,
            title: existingTimeline.title,
            slug: existingTimeline.slug,
            description: existingTimeline.description,
            category: existingTimeline.category
          }
        : {
            mode: "create" as const,
            timelineId: null,
            title: parsed.timeline.title,
            slug: parsed.timeline.slug,
            description: parsed.timeline.description,
            category: parsed.timeline.category
          };
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
        slug: summary.slug,
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
