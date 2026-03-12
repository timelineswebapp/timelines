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
import { compareHistoricalSort, parseHistoricalDateInput } from "@/src/lib/historical-date";
import { slugify } from "@/src/lib/utils";
import { ApiError } from "@/src/server/api/responses";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { hasHistoricalChronologyColumns } from "@/src/server/db/schema-capabilities";
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

function isBceImportRow(row: TimelineImportRow) {
  return typeof row.sortYear === "number" && row.sortYear < 0;
}

function logImportExecutionError(
  stage: string,
  context: Record<string, unknown>,
  error: unknown
) {
  const sqlError = error as Partial<{
    message: string;
    code: string;
    detail: string;
    hint: string;
    where: string;
    schema_name: string;
    table_name: string;
    column_name: string;
    dataType: string;
    constraint_name: string;
  }>;

  console.error(
    JSON.stringify({
      level: "error",
      component: "import_service",
      message: "Historical import execution failed.",
      stage,
      context,
      error: {
        message: error instanceof Error ? error.message : "Unknown error",
        code: sqlError.code,
        detail: sqlError.detail,
        hint: sqlError.hint,
        where: sqlError.where,
        schema: sqlError.schema_name,
        table: sqlError.table_name,
        column: sqlError.column_name,
        dataType: sqlError.dataType,
        constraint: sqlError.constraint_name
      }
    })
  );
}

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

  try {
    return parseHistoricalDateInput(value).datePrecision;
  } catch {
    return null;
  }
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
    return {
      ...normalizeRow(row),
      sourceRow: rowNumber
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const fields = extractValidationFields(error);
    if (fields) {
      throw new ApiError(400, "VALIDATION_FAILED", "Import row validation failed.", {
        row: rowNumber,
        fields
      });
    }

    if (error instanceof Error) {
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

function groupTimelineRows(rows: Array<{ timeline: ParsedTimelineMetadata; event: ParsedEventRow }>): ParsedTimelineGroup[] {
  const groups = new Map<string, ParsedTimelineGroup>();

  for (const row of rows) {
    const existing = groups.get(row.timeline.slug);
    if (!existing) {
      groups.set(row.timeline.slug, {
        timeline: row.timeline,
        events: [row.event]
      });
      continue;
    }

    if (
      existing.timeline.title !== row.timeline.title ||
      existing.timeline.description !== row.timeline.description ||
      existing.timeline.category !== row.timeline.category
    ) {
      throw new ApiError(
        400,
        "VALIDATION_FAILED",
        `Row ${row.event.sourceRow}: timeline metadata conflicts with earlier rows for slug '${row.timeline.slug}'.`,
        {
          row: row.event.sourceRow,
          timelineSlug: row.timeline.slug
        }
      );
    }

    existing.events.push(row.event);
  }

  return Array.from(groups.values());
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

function normalizeRow(row: unknown): TimelineImportRow {
  const parsed = importRowSchema.parse(row);
  const normalized = parseHistoricalDateInput(parsed.date, parsed.datePrecision);

  return {
    date: normalized.displayDate,
    datePrecision: normalized.datePrecision,
    legacyDate: normalized.legacyDate,
    displayDate: normalized.displayDate,
    sortYear: normalized.sortYear,
    sortMonth: normalized.sortMonth,
    sortDay: normalized.sortDay,
    title: parsed.title,
    description: parsed.description,
    importance: parsed.importance,
    location: parsed.location || null,
    imageUrl: parsed.imageUrl || null
  };
}

function getChronologySignature(input: {
  title: string;
  date: string;
  datePrecision: TimelineImportRow["datePrecision"];
  legacyDate?: string | null;
  sortYear?: number | null;
  sortMonth?: number | null;
  sortDay?: number | null;
}) {
  const titleKey = input.title.trim().toLowerCase();
  const chronology =
    typeof input.sortYear === "number" && input.sortYear !== 0
      ? {
          sortYear: input.sortYear,
          sortMonth: input.sortMonth ?? null,
          sortDay: input.sortDay ?? null,
          datePrecision: input.datePrecision
        }
      : parseHistoricalDateInput(input.legacyDate || input.date, input.datePrecision);

  return [
    chronology.sortYear,
    chronology.sortMonth ?? "",
    chronology.sortDay ?? "",
    chronology.datePrecision,
    titleKey
  ].join("|");
}

function legacyDateValue(row: TimelineImportRow) {
  return row.legacyDate || row.date;
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
      timelineGroups: [
        {
          timeline: normalizeTimelineMetadata(payload.timeline, "JSON timeline metadata validation failed."),
          events: payload.events.map((row, index) => normalizeStructuredRow(row, index + 1))
        }
      ],
      events: []
    };
  }

  if (Array.isArray(parsed)) {
    return {
      timelineGroups: [],
      events: parsed.map((row, index) => normalizeStructuredRow(row, index + 1))
    };
  }

  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { events?: unknown }).events)) {
    return {
      timelineGroups: [],
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

  const events: ParsedEventRow[] = result.data.map((row, index) => {
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
      return {
        ...normalizeRow(normalizedRow),
        sourceRow: index + 2
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      const fields = extractValidationFields(error);
      if (fields) {
        throw new ApiError(400, "VALIDATION_FAILED", "CSV row validation failed.", {
          row: index + 2,
          parsedDate: normalizedRow.date || null,
          parsedDatePrecision: normalizedRow.datePrecision || null,
          normalizedHeaderKeys,
          fields
        });
      }

      if (error instanceof Error) {
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

      throwCsvValidationError(error instanceof Error ? error.message : "CSV row validation failed.", {
        row: index,
        code: "CSV_ROW_INVALID"
      });
    }
  });

  if (importType === "timeline_with_events") {
    return {
      timelineGroups: groupTimelineRows(
        result.data.map((row, index) => {
          const { row: normalizedCsvRow } = normalizeCsvRow(row);
          return {
            timeline: normalizeTimelineMetadata(
              {
                title: normalizedCsvRow.timeline_title,
                slug: normalizedCsvRow.timeline_slug,
                description: normalizedCsvRow.timeline_description,
                category: normalizedCsvRow.category
              },
              "CSV timeline metadata validation failed."
            ),
            event: events[index] as ParsedEventRow
          };
        })
      ),
      events: []
    };
  }

  return {
    timelineGroups: [],
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
      timelineGroups: [
        {
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
        }
      ],
      events: []
    };
  }

  return {
    timelineGroups: [],
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
      (timeline?.events || []).map((event) =>
        getChronologySignature({
          title: event.title,
          date: event.date,
          datePrecision: event.datePrecision,
          legacyDate: event.legacyDate || null,
          sortYear: event.sortYear ?? null,
          sortMonth: event.sortMonth ?? null,
          sortDay: event.sortDay ?? null
        })
      )
    );
  }

  const supportsHistorical = await hasHistoricalChronologyColumns(sql);
  if (supportsHistorical) {
    const rows = await sql<{
      date: string;
      legacy_date: string;
      date_precision: TimelineImportRow["datePrecision"];
      title: string;
      sort_year: number | null;
      sort_month: number | null;
      sort_day: number | null;
    }[]>`
      SELECT
        COALESCE(events.display_date, events.date::text) AS date,
        events.date::text AS legacy_date,
        events.date_precision,
        events.title,
        events.sort_year,
        events.sort_month,
        events.sort_day
      FROM timeline_events
      INNER JOIN events ON events.id = timeline_events.event_id
      WHERE timeline_events.timeline_id = ${timelineId}
    `;

    return new Set(
      rows.map((row) =>
        getChronologySignature({
          title: row.title,
          date: row.date,
          datePrecision: row.date_precision,
          legacyDate: row.legacy_date,
          sortYear: row.sort_year,
          sortMonth: row.sort_month,
          sortDay: row.sort_day
        })
      )
    );
  }

  const rows = await sql<{ date: string; date_precision: TimelineImportRow["datePrecision"]; title: string }[]>`
    SELECT events.date::text AS date, events.date_precision, events.title
    FROM timeline_events
    INNER JOIN events ON events.id = timeline_events.event_id
    WHERE timeline_events.timeline_id = ${timelineId}
  `;

  return new Set(
    rows.map((row) =>
      getChronologySignature({
        title: row.title,
        date: row.date,
        datePrecision: row.date_precision
      })
    )
  );
}

function buildPreviewRows(
  rows: Array<{ event: ParsedEventRow; duplicateSet: Set<string>; timeline: ParsedTimelineMetadata }>
) {
  return rows.slice(0, 8).map(({ event, duplicateSet, timeline }) => ({
    date: event.date,
    title: event.title,
    description: event.description,
    duplicate: duplicateSet.has(getChronologySignature(event)),
    timelineSlug: timeline.slug,
    timelineTitle: timeline.title
  }));
}

function buildDuplicateSet(events: ParsedEventRow[], existingSignatures: Set<string>) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of events) {
    const signature = getChronologySignature(row);
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
  const reasons: ImportReason[] = [];
  const timelineResults: ImportExecutionResult["timelineResults"] = [];
  const affectedTimelineSlugs: string[] = [];
  let primaryTimelineId = 0;
  let primaryTimelineCreated = false;
  let importedTimelinesCount = 0;
  let importedEventsCount = 0;
  let skippedTimelinesCount = 0;
  let skippedEventsCount = 0;

  if (importType === "timeline_with_events") {
    for (const group of parsed.timelineGroups) {
      let targetTimeline: TimelineDetail | undefined;
      let timelineCreated = false;

      const existingTimeline = await getTimelineSummaryBySlug(null, group.timeline.slug);
      if (existingTimeline) {
        skippedTimelinesCount += 1;
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
          title: group.timeline.title,
          slug: group.timeline.slug,
          description: group.timeline.description,
          category: group.timeline.category,
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
        importedTimelinesCount += 1;
      }

      const duplicateSet = buildDuplicateSet(group.events, await getTimelineEventSignatures(null, targetTimeline.id));
      let created = 0;
      const startOrder = targetTimeline.events.length;

      for (const row of group.events) {
        const signature = getChronologySignature(row);
        if (duplicateSet.has(signature)) {
          skippedEventsCount += 1;
          reasons.push({
            type: "event_skipped",
            timelineSlug: targetTimeline.slug,
            row: row.sourceRow,
            date: row.displayDate || row.date,
            title: row.title,
            message: `Event '${row.title}' on ${row.displayDate || row.date} already exists under timeline '${targetTimeline.slug}'.`
          });
          continue;
        }

        targetTimeline.events.push({
          id: memoryStore.nextEventId(),
          date: row.displayDate || row.date,
          datePrecision: row.datePrecision,
          legacyDate: row.legacyDate || null,
          displayDate: row.displayDate || row.date,
          sortYear: row.sortYear ?? null,
          sortMonth: row.sortMonth ?? null,
          sortDay: row.sortDay ?? null,
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

      if (timelineCreated && created < 1) {
        throw new ApiError(409, "NO_EVENTS_IMPORTED", "No events were persisted for the imported timeline.");
      }

      importedEventsCount += created;
      targetTimeline.events.sort(compareHistoricalSort);
      touchTimelineSummary(targetTimeline);
      affectedTimelineSlugs.push(targetTimeline.slug);
      timelineResults.push({
        timelineId: targetTimeline.id,
        title: targetTimeline.title,
        slug: targetTimeline.slug,
        importedEventsCount: created,
        skippedEventsCount: duplicateSet.size,
        timelineCreated
      });

      if (!primaryTimelineId) {
        primaryTimelineId = targetTimeline.id;
        primaryTimelineCreated = timelineCreated;
      }
    }

    return {
      message: "Timelines and events successfully imported",
      timelineId: primaryTimelineId,
      eventsCreatedCount: importedEventsCount,
      duplicatesSkipped: skippedEventsCount,
      timelineCreated: primaryTimelineCreated,
      importedTimelinesCount,
      importedEventsCount,
      skippedTimelinesCount,
      skippedEventsCount,
      affectedTimelineSlugs,
      timelineResults,
      reasons
    };
  }

  let targetTimeline: TimelineDetail | undefined;
  targetTimeline = memoryStore.getTimelines().find((candidate) => candidate.id === timelineId);
  if (!targetTimeline) {
    throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
  }

  const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(null, targetTimeline.id));
  let created = 0;
  let duplicateCount = 0;
  const startOrder = targetTimeline.events.length;

  for (const row of parsed.events) {
    const signature = getChronologySignature(row);
    if (duplicateSet.has(signature)) {
      duplicateCount += 1;
      reasons.push({
        type: "event_skipped",
        timelineSlug: targetTimeline.slug,
        row: row.sourceRow,
        date: row.displayDate || row.date,
        title: row.title,
        message: `Event '${row.title}' on ${row.displayDate || row.date} already exists under timeline '${targetTimeline.slug}'.`
      });
      continue;
    }

    targetTimeline.events.push({
      id: memoryStore.nextEventId(),
      date: row.displayDate || row.date,
      datePrecision: row.datePrecision,
      legacyDate: row.legacyDate || null,
      displayDate: row.displayDate || row.date,
      sortYear: row.sortYear ?? null,
      sortMonth: row.sortMonth ?? null,
      sortDay: row.sortDay ?? null,
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

  targetTimeline.events.sort(compareHistoricalSort);
  touchTimelineSummary(targetTimeline);

  return {
    message: "Timeline and events successfully imported",
    timelineId: targetTimeline.id,
    eventsCreatedCount: created,
    duplicatesSkipped: duplicateCount,
    timelineCreated: false,
    importedTimelinesCount: 0,
    importedEventsCount: created,
    skippedTimelinesCount: 0,
    skippedEventsCount: duplicateCount,
    affectedTimelineSlugs: [targetTimeline.slug],
    timelineResults: [
      {
        timelineId: targetTimeline.id,
        title: targetTimeline.title,
        slug: targetTimeline.slug,
        importedEventsCount: created,
        skippedEventsCount: duplicateCount,
        timelineCreated: false
      }
    ],
    reasons
  };
}

async function executeDatabaseImport(parsed: ParsedImportData, importType: ImportType, skipDuplicates: boolean, existingTimelineId?: number | null): Promise<ImportExecutionResult> {
  const sql = getWriteSql("import");

  try {
    return await sql.begin(async (tx) => {
      const query = tx as unknown as Sql;
      const supportsHistorical = await hasHistoricalChronologyColumns(query);
      const reasons: ImportReason[] = [];
      const timelineResults: ImportExecutionResult["timelineResults"] = [];
      const affectedTimelineSlugs: string[] = [];
      let primaryTimelineId = 0;
      let primaryTimelineCreated = false;
      let importedTimelinesCount = 0;
      let importedEventsCount = 0;
      let skippedTimelinesCount = 0;
      let skippedEventsCount = 0;

    if (importType === "timeline_with_events") {
      for (const group of parsed.timelineGroups) {
        let timelineId = 0;
        let existingTimelineEventCount = 0;
        let timelineCreated = false;
        let timelineSlug = group.timeline.slug;
        const existingTimeline = await getTimelineSummaryBySlug(query, group.timeline.slug);

        if (existingTimeline) {
          timelineId = existingTimeline.id;
          existingTimelineEventCount = existingTimeline.eventCount;
          timelineSlug = existingTimeline.slug;
          skippedTimelinesCount += 1;
          reasons.push({
            type: "timeline_skipped",
            timelineSlug,
            message: `Timeline slug '${timelineSlug}' already exists. Reusing existing timeline.`
          });
        } else {
          const [timelineRow] = await query<{ id: number }[]>`
            INSERT INTO timelines (title, slug, description, category)
            VALUES (${group.timeline.title}, ${group.timeline.slug}, ${group.timeline.description}, ${group.timeline.category})
            RETURNING id
          `;

          if (!timelineRow) {
            throw new ApiError(500, "TIMELINE_INSERT_FAILED", "Timeline insert failed.");
          }

          timelineId = timelineRow.id;
          timelineCreated = true;
          importedTimelinesCount += 1;
        }

        const duplicateSet = buildDuplicateSet(group.events, await getTimelineEventSignatures(query, timelineId));
        let created = 0;
        let groupDuplicateCount = 0;

        for (const row of group.events) {
          const signature = getChronologySignature(row);
          if (duplicateSet.has(signature)) {
            groupDuplicateCount += 1;
            skippedEventsCount += 1;
            reasons.push({
              type: "event_skipped",
              timelineSlug,
              row: row.sourceRow,
              date: row.displayDate || row.date,
              title: row.title,
              message: `Event '${row.title}' on ${row.displayDate || row.date} already exists under timeline '${timelineSlug}'.`
            });
            continue;
          }

          const legacyDate = legacyDateValue(row);
          let eventRow: { id: number } | undefined;
          try {
            [eventRow] = supportsHistorical
              ? await query<{ id: number }[]>`
                  INSERT INTO events (
                    date,
                    date_precision,
                    sort_year,
                    sort_month,
                    sort_day,
                    display_date,
                    title,
                    description,
                    importance,
                    location,
                    image_url
                  )
                  VALUES (
                    CAST(${legacyDate} AS DATE),
                    ${row.datePrecision},
                    ${row.sortYear ?? null},
                    ${row.sortMonth ?? null},
                    ${row.sortDay ?? null},
                    ${row.displayDate || row.date},
                    ${row.title},
                    ${row.description},
                    ${row.importance},
                    ${row.location || null},
                    ${row.imageUrl || null}
                  )
                  RETURNING id
                `
              : await query<{ id: number }[]>`
                  INSERT INTO events (date, date_precision, title, description, importance, location, image_url)
                  VALUES (CAST(${legacyDate} AS DATE), ${row.datePrecision}, ${row.title}, ${row.description}, ${row.importance}, ${row.location || null}, ${row.imageUrl || null})
                  RETURNING id
                `;
          } catch (error) {
            if (isBceImportRow(row)) {
              logImportExecutionError("timeline_with_events.insert_event", {
                timelineId,
                timelineSlug,
                sourceRow: row.sourceRow,
                legacyDate,
                displayDate: row.displayDate || row.date,
                datePrecision: row.datePrecision,
                sortYear: row.sortYear ?? null,
                sortMonth: row.sortMonth ?? null,
                sortDay: row.sortDay ?? null,
                supportsHistorical
              }, error);
            }
            throw error;
          }

          if (!eventRow) {
            throw new ApiError(500, "EVENT_INSERT_FAILED", "Event insert failed.");
          }

          try {
            await query`
              INSERT INTO timeline_events (timeline_id, event_id, event_order)
              VALUES (${timelineId}, ${eventRow.id}, ${existingTimelineEventCount + created + 1})
            `;
          } catch (error) {
            if (isBceImportRow(row)) {
              logImportExecutionError("timeline_with_events.insert_timeline_event", {
                timelineId,
                timelineSlug,
                eventId: eventRow.id,
                eventOrder: existingTimelineEventCount + created + 1,
                sourceRow: row.sourceRow,
                legacyDate,
                displayDate: row.displayDate || row.date,
                datePrecision: row.datePrecision
              }, error);
            }
            throw error;
          }
          created += 1;
        }

        if (timelineCreated && created < 1) {
          throw new ApiError(409, "NO_EVENTS_IMPORTED", "No events were persisted for the imported timeline.");
        }

        importedEventsCount += created;
        affectedTimelineSlugs.push(timelineSlug);
        timelineResults.push({
          timelineId,
          title: group.timeline.title,
          slug: timelineSlug,
          importedEventsCount: created,
          skippedEventsCount: groupDuplicateCount,
          timelineCreated
        });

        await query`
          UPDATE timelines
          SET updated_at = NOW()
          WHERE id = ${timelineId}
        `;

        if (!primaryTimelineId) {
          primaryTimelineId = timelineId;
          primaryTimelineCreated = timelineCreated;
        }
      }

      return {
        message: "Timelines and events successfully imported",
        timelineId: primaryTimelineId,
        eventsCreatedCount: importedEventsCount,
        duplicatesSkipped: skippedEventsCount,
        timelineCreated: primaryTimelineCreated,
        importedTimelinesCount,
        importedEventsCount,
        skippedTimelinesCount,
        skippedEventsCount,
        affectedTimelineSlugs,
        timelineResults,
        reasons
      };
    }

    const summary = await getTimelineSummaryById(query, ensureExistingTimelineId({ timelineId: existingTimelineId }, importType));
    if (!summary) {
      throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
    }

    const duplicateSet = buildDuplicateSet(parsed.events, await getTimelineEventSignatures(query, summary.id));
    let created = 0;
    let duplicateCount = 0;
    for (const row of parsed.events) {
      const signature = getChronologySignature(row);
      if (duplicateSet.has(signature)) {
        duplicateCount += 1;
        skippedEventsCount += 1;
        reasons.push({
          type: "event_skipped",
          timelineSlug: summary.slug,
          row: row.sourceRow,
          date: row.displayDate || row.date,
          title: row.title,
          message: `Event '${row.title}' on ${row.displayDate || row.date} already exists under timeline '${summary.slug}'.`
        });
        continue;
      }

      const legacyDate = legacyDateValue(row);
      let eventRow: { id: number } | undefined;
      try {
        [eventRow] = supportsHistorical
          ? await query<{ id: number }[]>`
              INSERT INTO events (
                date,
                date_precision,
                sort_year,
                sort_month,
                sort_day,
                display_date,
                title,
                description,
                importance,
                location,
                image_url
              )
              VALUES (
                CAST(${legacyDate} AS DATE),
                ${row.datePrecision},
                ${row.sortYear ?? null},
                ${row.sortMonth ?? null},
                ${row.sortDay ?? null},
                ${row.displayDate || row.date},
                ${row.title},
                ${row.description},
                ${row.importance},
                ${row.location || null},
                ${row.imageUrl || null}
              )
              RETURNING id
            `
          : await query<{ id: number }[]>`
              INSERT INTO events (date, date_precision, title, description, importance, location, image_url)
              VALUES (CAST(${legacyDate} AS DATE), ${row.datePrecision}, ${row.title}, ${row.description}, ${row.importance}, ${row.location || null}, ${row.imageUrl || null})
              RETURNING id
            `;
      } catch (error) {
        if (isBceImportRow(row)) {
          logImportExecutionError("events_into_existing_timeline.insert_event", {
            timelineId: summary.id,
            timelineSlug: summary.slug,
            sourceRow: row.sourceRow,
            legacyDate,
            displayDate: row.displayDate || row.date,
            datePrecision: row.datePrecision,
            sortYear: row.sortYear ?? null,
            sortMonth: row.sortMonth ?? null,
            sortDay: row.sortDay ?? null,
            supportsHistorical
          }, error);
        }
        throw error;
      }

      if (!eventRow) {
        throw new ApiError(500, "EVENT_INSERT_FAILED", "Event insert failed.");
      }

      try {
        await query`
          INSERT INTO timeline_events (timeline_id, event_id, event_order)
          VALUES (${summary.id}, ${eventRow.id}, ${summary.eventCount + created + 1})
        `;
      } catch (error) {
        if (isBceImportRow(row)) {
          logImportExecutionError("events_into_existing_timeline.insert_timeline_event", {
            timelineId: summary.id,
            timelineSlug: summary.slug,
            eventId: eventRow.id,
            eventOrder: summary.eventCount + created + 1,
            sourceRow: row.sourceRow,
            legacyDate,
            displayDate: row.displayDate || row.date,
            datePrecision: row.datePrecision
          }, error);
        }
        throw error;
      }
      created += 1;
    }

    await query`
      UPDATE timelines
      SET updated_at = NOW()
      WHERE id = ${summary.id}
    `;

    return {
      message: "Timeline and events successfully imported",
      timelineId: summary.id,
      eventsCreatedCount: created,
      duplicatesSkipped: duplicateCount,
      timelineCreated: false,
      importedTimelinesCount: 0,
      importedEventsCount: created,
      skippedTimelinesCount: 0,
      skippedEventsCount: duplicateCount,
      affectedTimelineSlugs: [summary.slug],
      timelineResults: [
        {
          timelineId: summary.id,
          title: summary.title,
          slug: summary.slug,
          importedEventsCount: created,
          skippedEventsCount: duplicateCount,
          timelineCreated: false
        }
      ],
      reasons
    };
    });
  } catch (error) {
    if (
      parsed.timelineGroups.some((group) => group.events.some(isBceImportRow)) ||
      parsed.events.some(isBceImportRow)
    ) {
      logImportExecutionError("execute_database_import.transaction", {
        importType,
        existingTimelineId: existingTimelineId ?? null,
        timelineGroups: parsed.timelineGroups.length,
        directEvents: parsed.events.length
      }, error);
    }
    throw error;
  }
}

export const importService = {
  async preview(rawInput: unknown): Promise<ImportPreview> {
    const input = importPreviewSchema.parse(rawInput);
    const parsed = parseImportContent(input.format, input.importType, input.content);

    if (input.importType === "timeline_with_events") {
      if (parsed.timelineGroups.length === 0) {
        throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
      }
      const timelineContexts = await Promise.all(
        parsed.timelineGroups.map(async (group) => {
          const existingTimeline = await getTimelineSummaryBySlug(getSql(), group.timeline.slug);
          const duplicateSet = buildDuplicateSet(
            group.events,
            existingTimeline ? await getTimelineEventSignatures(getSql(), existingTimeline.id) : new Set()
          );

          return {
            timeline: existingTimeline
              ? {
                  mode: "existing" as const,
                  timelineId: existingTimeline.id,
                  title: existingTimeline.title,
                  slug: existingTimeline.slug,
                  description: existingTimeline.description,
                  category: existingTimeline.category,
                  rows: group.events.length,
                  duplicates: duplicateSet.size,
                  accepted: group.events.length - duplicateSet.size
                }
              : {
                  mode: "create" as const,
                  timelineId: null,
                  title: group.timeline.title,
                  slug: group.timeline.slug,
                  description: group.timeline.description,
                  category: group.timeline.category,
                  rows: group.events.length,
                  duplicates: duplicateSet.size,
                  accepted: group.events.length - duplicateSet.size
                },
            previewRows: buildPreviewRows(group.events.map((event) => ({
              event,
              duplicateSet,
              timeline: group.timeline
            })))
          };
        })
      );

      const allPreviewRows = timelineContexts.flatMap((item) => item.previewRows).slice(0, 8);
      const primaryTimeline = timelineContexts[0]?.timeline;
      if (!primaryTimeline) {
        throw new ApiError(400, "VALIDATION_FAILED", "Import preview did not produce any timelines.");
      }

      return {
        format: input.format,
        importType: input.importType,
        valid: true,
        timeline: primaryTimeline,
        timelines: timelineContexts.map((item) => item.timeline),
        totals: {
          rows: parsed.timelineGroups.reduce((sum, group) => sum + group.events.length, 0),
          duplicates: timelineContexts.reduce((sum, item) => sum + item.timeline.duplicates, 0),
          accepted: timelineContexts.reduce((sum, item) => sum + item.timeline.accepted, 0),
          timelines: timelineContexts.length
        },
        errors: [],
        preview: allPreviewRows,
        skipDuplicates: input.skipDuplicates
      };
    }

    const timelineId = ensureExistingTimelineId(input, input.importType);
    const summary = await getTimelineSummaryById(getSql(), timelineId);
    if (!summary) {
      throw new ApiError(404, "TIMELINE_NOT_FOUND", "Timeline not found.");
    }

    const timelineContext = {
      mode: "existing" as const,
      timelineId: summary.id,
      title: summary.title,
      slug: summary.slug,
      description: summary.description,
      category: summary.category,
      rows: parsed.events.length,
      duplicates: 0,
      accepted: 0
    };

    const duplicateSet = buildDuplicateSet(
      parsed.events,
      await getTimelineEventSignatures(getSql(), timelineContext.timelineId)
    );
    timelineContext.duplicates = duplicateSet.size;
    timelineContext.accepted = parsed.events.length - duplicateSet.size;

    return {
      format: input.format,
      importType: input.importType,
      valid: true,
      timeline: timelineContext,
      timelines: [timelineContext],
      totals: {
        rows: parsed.events.length,
        duplicates: duplicateSet.size,
        accepted: parsed.events.length - duplicateSet.size,
        timelines: 1
      },
      errors: [],
      preview: buildPreviewRows(
        parsed.events.map((event) => ({
          event,
          duplicateSet,
          timeline: {
            title: summary.title,
            slug: summary.slug,
            description: summary.description,
            category: summary.category
          }
        }))
      ),
      skipDuplicates: input.skipDuplicates
    };
  },

  async execute(rawInput: unknown): Promise<ImportExecutionResult> {
    const input = importPreviewSchema.parse(rawInput);
    const parsed = parseImportContent(input.format, input.importType, input.content);

    if (input.importType === "timeline_with_events" && parsed.timelineGroups.length === 0) {
      throw new ApiError(400, "TIMELINE_METADATA_REQUIRED", "Timeline metadata is required.");
    }

    return executeDatabaseImport(parsed, input.importType, input.skipDuplicates, input.timelineId ?? null);
  }
};
