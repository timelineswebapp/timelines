import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";
import type { Sql } from "postgres";
import { parseHistoricalDateInput } from "@/src/lib/historical-date";
import type {
  DatePrecision,
  RelationshipRecoveryHistoryItem,
  RelationshipRecoveryReport,
  RelationshipRecoveryReportRow
} from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";
import { ApiError } from "@/src/server/api/responses";
import { getWriteSql } from "@/src/server/db/client";

type RecoveryMode = RelationshipRecoveryReport["mode"];
type CsvRow = Record<string, string>;
type RelationshipKey = `${number}:${number}`;

type SourceInput = {
  publisher: string;
  url: string;
  credibilityScore: number;
};

type ParsedCsvEvent = {
  file: string;
  rowNumber: number;
  timelineSlug: string;
  title: string;
  chronologyKey: string;
  tags: string[];
  sources: SourceInput[];
};

type EventMatch = {
  eventId: number;
  timelineId: number;
  timelineSlug: string;
};

type ExistingEventRow = {
  event_id: number;
  timeline_id: number;
  timeline_slug: string;
  title: string;
  legacy_date: string;
  display_date: string | null;
  date_precision: DatePrecision;
  sort_year: number | null;
  sort_month: number | null;
  sort_day: number | null;
};

type ExistingTagRow = {
  id: number;
  slug: string;
  name: string;
};

type ExistingSourceRow = {
  id: number;
  url: string;
  publisher: string;
};

type RecoveryReportRow = {
  id: number;
  mode: RecoveryMode;
  generated_at: string;
  matched_rows: number;
  unmatched_rows: number;
  ambiguous_rows: number;
  tag_links_pending: number;
  source_links_pending: number;
  inserted_tag_links: number;
  inserted_source_links: number;
};

const REPORT_ROW_LIMIT = 500;
const DATA_DIRECTORY = path.join(process.cwd(), "data");
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

function addReportRow(report: RelationshipRecoveryReport, row: RelationshipRecoveryReportRow) {
  if (report.rows.length < REPORT_ROW_LIMIT) {
    report.rows.push(row);
  }
}

function toHistoryItem(row: RecoveryReportRow): RelationshipRecoveryHistoryItem {
  return {
    id: row.id,
    mode: row.mode,
    generatedAt: row.generated_at,
    matchedRows: row.matched_rows,
    unmatchedRows: row.unmatched_rows,
    ambiguousRows: row.ambiguous_rows,
    tagLinksPending: row.tag_links_pending,
    sourceLinksPending: row.source_links_pending,
    insertedTagLinks: row.inserted_tag_links,
    insertedSourceLinks: row.inserted_source_links
  };
}

function normalizeTitle(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function chronologyKey(input: {
  sortYear: number;
  sortMonth: number | null;
  sortDay: number | null;
  datePrecision: DatePrecision;
  title: string;
}) {
  return [
    input.sortYear,
    input.sortMonth ?? "",
    input.sortDay ?? "",
    input.datePrecision,
    normalizeTitle(input.title)
  ].join("|");
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

function normalizeCsvRow(row: CsvRow) {
  const normalized = {} as Record<(typeof CANONICAL_CSV_HEADERS)[number], string | undefined>;
  for (const header of CANONICAL_CSV_HEADERS) {
    normalized[header] = getCsvValue(row, CSV_FIELD_ALIASES[header]);
  }
  return normalized;
}

function normalizeImportTags(rawTags: string | undefined): string[] {
  const value = rawTags?.trim();
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of value.split(/[;,|]/)) {
    const tag = part.trim();
    const slug = slugify(tag);
    if (!tag || !slug || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    tags.push(tag);
  }
  return tags;
}

function normalizeImportSourceUrl(rawUrl: string | undefined) {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}

function inferPublisherFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function normalizeImportSource(input: {
  source_publisher?: string;
  source_url?: string;
  source_credibility?: string;
}): SourceInput[] {
  const url = normalizeImportSourceUrl(input.source_url);
  if (!url) {
    return [];
  }

  const publisher = input.source_publisher?.trim() || inferPublisherFromUrl(url);
  const rawCredibility = input.source_credibility?.trim();
  const credibilityScore = rawCredibility ? Number(rawCredibility) : 0.8;

  return [
    {
      publisher,
      url,
      credibilityScore: Number.isFinite(credibilityScore) ? credibilityScore : 0.8
    }
  ];
}

async function listCsvFiles(inputPath: string): Promise<string[]> {
  const inputStat = await stat(inputPath);
  if (inputStat.isFile()) {
    return inputPath.toLowerCase().endsWith(".csv") ? [inputPath] : [];
  }

  if (!inputStat.isDirectory()) {
    throw new ApiError(500, "RECOVERY_INPUT_INVALID", `Relationship recovery input path is invalid: ${inputPath}`);
  }

  const entries = await readdir(inputPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(inputPath, entry.name);
      if (entry.isDirectory()) {
        return listCsvFiles(fullPath);
      }
      return entry.isFile() && entry.name.toLowerCase().endsWith(".csv") ? [fullPath] : [];
    })
  );

  return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function parseCsvFile(filePath: string): Promise<{
  events: ParsedCsvEvent[];
  invalidRows: RelationshipRecoveryReportRow[];
  totalRows: number;
}> {
  const content = await readFile(filePath, "utf8");
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new ApiError(400, "RECOVERY_CSV_PARSE_FAILED", `CSV parse failed for ${path.basename(filePath)}: ${firstError?.message || "Unknown error"}`);
  }

  const events: ParsedCsvEvent[] = [];
  const invalidRows: RelationshipRecoveryReportRow[] = [];
  const relativeFile = path.relative(process.cwd(), filePath) || filePath;

  result.data.forEach((row, index) => {
    const rowNumber = index + 2;
    const normalized = normalizeCsvRow(row);
    const title = normalized.title?.trim() || "";
    const timelineSlug = slugify(normalized.timeline_slug || normalized.timeline_title || "");
    const date = normalized.date?.trim() || "";

    try {
      if (!timelineSlug) {
        throw new Error("Missing timeline_slug or timeline_title.");
      }
      if (!title) {
        throw new Error("Missing title.");
      }
      if (!date) {
        throw new Error("Missing date.");
      }

      const chronology = parseHistoricalDateInput(date, normalized.date_precision?.trim() as DatePrecision | undefined);
      events.push({
        file: relativeFile,
        rowNumber,
        timelineSlug,
        title,
        chronologyKey: chronologyKey({
          sortYear: chronology.sortYear,
          sortMonth: chronology.sortMonth,
          sortDay: chronology.sortDay,
          datePrecision: chronology.datePrecision,
          title
        }),
        tags: normalizeImportTags(normalized.tags),
        sources: normalizeImportSource({
          source_publisher: normalized.source_publisher,
          source_url: normalized.source_url,
          source_credibility: normalized.source_credibility
        })
      });
    } catch (error) {
      invalidRows.push({
        file: relativeFile,
        rowNumber,
        timelineSlug,
        title,
        status: "invalid",
        eventId: null,
        tags: [],
        sources: [],
        message: error instanceof Error ? error.message : "Invalid CSV row."
      });
    }
  });

  return {
    events,
    invalidRows,
    totalRows: result.data.length
  };
}

async function loadRelationshipHealth(sql: Sql): Promise<RelationshipRecoveryReport["totals"]["database"]> {
  const [row] = await sql<RelationshipRecoveryReport["totals"]["database"][]>`
    SELECT
      (SELECT COUNT(*)::int FROM events) AS events,
      (SELECT COUNT(*)::int FROM timeline_events) AS "timelineEvents",
      (SELECT COUNT(*)::int FROM tags) AS tags,
      (SELECT COUNT(*)::int FROM sources) AS sources,
      (SELECT COUNT(*)::int FROM event_tags) AS "eventTags",
      (SELECT COUNT(*)::int FROM event_sources) AS "eventSources"
  `;

  return row || {
    events: 0,
    timelineEvents: 0,
    tags: 0,
    sources: 0,
    eventTags: 0,
    eventSources: 0
  };
}

async function saveRecoveryReport(sql: Sql, report: RelationshipRecoveryReport): Promise<RelationshipRecoveryReport> {
  const [row] = await sql<{ id: number; generated_at: string }[]>`
    INSERT INTO relationship_recovery_reports (
      mode,
      generated_at,
      matched_rows,
      unmatched_rows,
      ambiguous_rows,
      tag_links_pending,
      source_links_pending,
      inserted_tag_links,
      inserted_source_links,
      report
    )
    VALUES (
      ${report.mode},
      ${report.generatedAt},
      ${report.totals.matchedRows},
      ${report.totals.unmatchedRows},
      ${report.totals.ambiguousRows},
      ${report.totals.tagLinksToInsert},
      ${report.totals.sourceLinksToInsert},
      ${report.totals.tagLinksInserted},
      ${report.totals.sourceLinksInserted},
      CAST(${JSON.stringify(report)} AS jsonb)
    )
    RETURNING id, generated_at::text
  `;

  if (!row) {
    throw new ApiError(500, "RECOVERY_REPORT_SAVE_FAILED", "Relationship recovery report could not be saved.");
  }

  return {
    ...report,
    id: row.id,
    generatedAt: row.generated_at
  };
}

async function loadExistingEvents(sql: Sql): Promise<Map<string, EventMatch[]>> {
  const rows = await sql<ExistingEventRow[]>`
    SELECT
      events.id AS event_id,
      timelines.id AS timeline_id,
      timelines.slug AS timeline_slug,
      events.title,
      events.date::text AS legacy_date,
      events.display_date,
      events.date_precision,
      events.sort_year,
      events.sort_month,
      events.sort_day
    FROM timeline_events
    INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
    INNER JOIN events ON events.id = timeline_events.event_id
  `;

  const index = new Map<string, EventMatch[]>();
  for (const row of rows) {
    const parsed =
      typeof row.sort_year === "number"
        ? {
            sortYear: row.sort_year,
            sortMonth: row.sort_month,
            sortDay: row.sort_day,
            datePrecision: row.date_precision
          }
        : parseHistoricalDateInput(row.display_date || row.legacy_date, row.date_precision);
    const key = `${row.timeline_slug}|${chronologyKey({
      sortYear: parsed.sortYear,
      sortMonth: parsed.sortMonth,
      sortDay: parsed.sortDay,
      datePrecision: parsed.datePrecision,
      title: row.title
    })}`;
    const bucket = index.get(key) || [];
    bucket.push({
      eventId: row.event_id,
      timelineId: row.timeline_id,
      timelineSlug: row.timeline_slug
    });
    index.set(key, bucket);
  }

  return index;
}

async function loadExistingTags(sql: Sql): Promise<Map<string, ExistingTagRow>> {
  const rows = await sql<ExistingTagRow[]>`
    SELECT id, slug, name
    FROM tags
  `;
  return new Map(rows.map((row) => [row.slug, row]));
}

async function loadExistingSources(sql: Sql): Promise<Map<string, ExistingSourceRow>> {
  const rows = await sql<ExistingSourceRow[]>`
    SELECT id, lower(url) AS url, publisher
    FROM sources
  `;
  return new Map(rows.map((row) => [row.url.toLowerCase(), row]));
}

async function loadExistingRelationshipKeys(sql: Sql, table: "event_tags" | "event_sources", idColumn: "tag_id" | "source_id") {
  const rows = await sql<{ event_id: number; related_id: number }[]>`
    SELECT event_id, ${sql(idColumn)} AS related_id
    FROM ${sql(table)}
  `;
  return new Set<RelationshipKey>(rows.map((row) => `${row.event_id}:${row.related_id}` as RelationshipKey));
}

async function resolveTagId(
  sql: Sql,
  mode: RecoveryMode,
  tagsBySlug: Map<string, ExistingTagRow>,
  name: string
): Promise<{ id: number | null; created: boolean }> {
  const slug = slugify(name);
  if (!slug) {
    return { id: null, created: false };
  }

  const existing = tagsBySlug.get(slug);
  if (existing) {
    return { id: existing.id, created: false };
  }

  if (mode === "preview") {
    const syntheticId = -1 * (tagsBySlug.size + 1);
    tagsBySlug.set(slug, { id: syntheticId, slug, name });
    return { id: syntheticId, created: true };
  }

  const [row] = await sql<ExistingTagRow[]>`
    INSERT INTO tags (slug, name)
    VALUES (${slug}, ${name})
    ON CONFLICT (slug) DO NOTHING
    RETURNING id, slug, name
  `;

  const resolved = row || (await sql<ExistingTagRow[]>`
    SELECT id, slug, name
    FROM tags
    WHERE slug = ${slug}
    LIMIT 1
  `)[0];

  if (!resolved) {
    throw new ApiError(500, "RECOVERY_TAG_RESOLUTION_FAILED", `Failed to resolve tag '${name}'.`);
  }

  tagsBySlug.set(slug, resolved);
  return { id: resolved.id, created: Boolean(row) };
}

async function resolveSourceId(
  sql: Sql,
  mode: RecoveryMode,
  sourcesByUrl: Map<string, ExistingSourceRow>,
  source: SourceInput
): Promise<{ id: number | null; created: boolean }> {
  const key = source.url.trim().toLowerCase();
  const existing = sourcesByUrl.get(key);
  if (existing) {
    return { id: existing.id, created: false };
  }

  if (mode === "preview") {
    const syntheticId = -1 * (sourcesByUrl.size + 1);
    sourcesByUrl.set(key, { id: syntheticId, url: key, publisher: source.publisher });
    return { id: syntheticId, created: true };
  }

  const [row] = await sql<{ id: number; url: string; publisher: string }[]>`
    INSERT INTO sources (publisher, url, credibility_score)
    VALUES (${source.publisher}, ${source.url}, ${source.credibilityScore})
    ON CONFLICT (url) DO NOTHING
    RETURNING id, lower(url) AS url, publisher
  `;

  const resolved = row || (await sql<{ id: number; url: string; publisher: string }[]>`
    SELECT id, lower(url) AS url, publisher
    FROM sources
    WHERE lower(url) = ${key}
    LIMIT 1
  `)[0];

  if (!resolved) {
    throw new ApiError(500, "RECOVERY_SOURCE_RESOLUTION_FAILED", `Failed to resolve source '${source.url}'.`);
  }

  sourcesByUrl.set(key, resolved);
  return { id: resolved.id, created: Boolean(row) };
}

async function insertRelationship(
  sql: Sql,
  mode: RecoveryMode,
  relationshipKeys: Set<RelationshipKey>,
  table: "event_tags" | "event_sources",
  idColumn: "tag_id" | "source_id",
  eventId: number,
  relatedId: number
) {
  const key: RelationshipKey = `${eventId}:${relatedId}`;
  if (relationshipKeys.has(key)) {
    return { inserted: false, preExisting: true };
  }

  if (mode === "preview") {
    relationshipKeys.add(key);
    return { inserted: false, preExisting: false };
  }

  const result = await sql`
    INSERT INTO ${sql(table)} (event_id, ${sql(idColumn)})
    VALUES (${eventId}, ${relatedId})
    ON CONFLICT DO NOTHING
  `;
  relationshipKeys.add(key);
  return { inserted: result.count > 0, preExisting: false };
}

async function buildRecoveryReport(mode: RecoveryMode): Promise<RelationshipRecoveryReport> {
  const sql = getWriteSql("relationship recovery");
  const inputPath = DATA_DIRECTORY;
  const report: RelationshipRecoveryReport = {
    id: null,
    mode,
    inputPath: path.relative(process.cwd(), inputPath) || inputPath,
    generatedAt: new Date().toISOString(),
    totals: {
      database: await loadRelationshipHealth(sql),
      files: 0,
      csvRows: 0,
      validRows: 0,
      invalidRows: 0,
      matchedRows: 0,
      unmatchedRows: 0,
      ambiguousRows: 0,
      uniqueTagsSeen: 0,
      uniqueSourcesSeen: 0,
      tagsToCreate: 0,
      sourcesToCreate: 0,
      tagLinksPreExisting: 0,
      tagLinksToInsert: 0,
      tagLinksInserted: 0,
      sourceLinksPreExisting: 0,
      sourceLinksToInsert: 0,
      sourceLinksInserted: 0
    },
    rows: []
  };

  const files = await listCsvFiles(inputPath);
  if (files.length === 0) {
    throw new ApiError(500, "RECOVERY_INPUT_EMPTY", "No CSV recovery artifacts were found.");
  }

  report.totals.files = files.length;
  const parsedFiles = await Promise.all(files.map((file) => parseCsvFile(file)));
  const csvEvents = parsedFiles.flatMap((file) => file.events);
  report.totals.csvRows = parsedFiles.reduce((sum, file) => sum + file.totalRows, 0);
  report.totals.validRows = csvEvents.length;

  for (const invalidRow of parsedFiles.flatMap((file) => file.invalidRows)) {
    report.totals.invalidRows += 1;
    addReportRow(report, invalidRow);
  }

  const uniqueTagsSeen = new Set(csvEvents.flatMap((event) => event.tags.map((tag) => slugify(tag)).filter(Boolean)));
  const uniqueSourcesSeen = new Set(csvEvents.flatMap((event) => event.sources.map((source) => source.url.toLowerCase())));
  report.totals.uniqueTagsSeen = uniqueTagsSeen.size;
  report.totals.uniqueSourcesSeen = uniqueSourcesSeen.size;

  const execute = async (query: Sql) => {
    const [eventIndex, tagsBySlug, sourcesByUrl, eventTagKeys, eventSourceKeys] = await Promise.all([
      loadExistingEvents(query),
      loadExistingTags(query),
      loadExistingSources(query),
      loadExistingRelationshipKeys(query, "event_tags", "tag_id"),
      loadExistingRelationshipKeys(query, "event_sources", "source_id")
    ]);

    for (const csvEvent of csvEvents) {
      const key = `${csvEvent.timelineSlug}|${csvEvent.chronologyKey}`;
      const matches = eventIndex.get(key) || [];

      if (matches.length === 0) {
        report.totals.unmatchedRows += 1;
        addReportRow(report, {
          file: csvEvent.file,
          rowNumber: csvEvent.rowNumber,
          timelineSlug: csvEvent.timelineSlug,
          title: csvEvent.title,
          status: "unmatched",
          eventId: null,
          tags: csvEvent.tags,
          sources: csvEvent.sources.map((source) => source.url),
          message: `No event matched key '${key}'.`
        });
        continue;
      }

      if (matches.length > 1) {
        report.totals.ambiguousRows += 1;
        addReportRow(report, {
          file: csvEvent.file,
          rowNumber: csvEvent.rowNumber,
          timelineSlug: csvEvent.timelineSlug,
          title: csvEvent.title,
          status: "ambiguous",
          eventId: null,
          tags: csvEvent.tags,
          sources: csvEvent.sources.map((source) => source.url),
          message: `Matched ${matches.length} events for key '${key}'.`
        });
        continue;
      }

      const match = matches[0];
      if (!match) {
        continue;
      }
      report.totals.matchedRows += 1;

      for (const tag of csvEvent.tags) {
        const existingTagCount = tagsBySlug.size;
        const resolved = await resolveTagId(query, mode, tagsBySlug, tag);
        if (!resolved.id) {
          continue;
        }
        if (resolved.created && tagsBySlug.size > existingTagCount) {
          report.totals.tagsToCreate += 1;
        }

        const relationship = await insertRelationship(query, mode, eventTagKeys, "event_tags", "tag_id", match.eventId, resolved.id);
        if (relationship.preExisting) {
          report.totals.tagLinksPreExisting += 1;
        } else {
          report.totals.tagLinksToInsert += 1;
        }
        if (relationship.inserted) {
          report.totals.tagLinksInserted += 1;
        }
      }

      for (const source of csvEvent.sources) {
        const existingSourceCount = sourcesByUrl.size;
        const resolved = await resolveSourceId(query, mode, sourcesByUrl, source);
        if (!resolved.id) {
          continue;
        }
        if (resolved.created && sourcesByUrl.size > existingSourceCount) {
          report.totals.sourcesToCreate += 1;
        }

        const relationship = await insertRelationship(query, mode, eventSourceKeys, "event_sources", "source_id", match.eventId, resolved.id);
        if (relationship.preExisting) {
          report.totals.sourceLinksPreExisting += 1;
        } else {
          report.totals.sourceLinksToInsert += 1;
        }
        if (relationship.inserted) {
          report.totals.sourceLinksInserted += 1;
        }
      }

      addReportRow(report, {
        file: csvEvent.file,
        rowNumber: csvEvent.rowNumber,
        timelineSlug: csvEvent.timelineSlug,
        title: csvEvent.title,
        status: "matched",
        eventId: match.eventId,
        tags: csvEvent.tags,
        sources: csvEvent.sources.map((source) => source.url),
        message: null
      });
    }
  };

  if (mode === "apply") {
    return await sql.begin(async (tx) => {
      await execute(tx as unknown as Sql);
      report.totals.database = await loadRelationshipHealth(tx as unknown as Sql);
      return saveRecoveryReport(tx as unknown as Sql, report);
    });
  }

  await execute(sql);
  return saveRecoveryReport(sql, report);
}

async function listRecoveryReports(): Promise<RelationshipRecoveryHistoryItem[]> {
  const sql = getWriteSql("relationship recovery history");
  const rows = await sql<RecoveryReportRow[]>`
    SELECT
      id,
      mode,
      generated_at::text,
      matched_rows,
      unmatched_rows,
      ambiguous_rows,
      tag_links_pending,
      source_links_pending,
      inserted_tag_links,
      inserted_source_links
    FROM relationship_recovery_reports
    ORDER BY generated_at DESC, id DESC
    LIMIT 100
  `;

  return rows.map(toHistoryItem);
}

async function getRecoveryReport(id: number): Promise<RelationshipRecoveryReport> {
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new ApiError(400, "INVALID_REPORT_ID", "Relationship recovery report id must be a positive integer.");
  }

  const sql = getWriteSql("relationship recovery report read");
  const [row] = await sql<{ id: number; generated_at: string; report: RelationshipRecoveryReport }[]>`
    SELECT id, generated_at::text, report
    FROM relationship_recovery_reports
    WHERE id = ${id}
    LIMIT 1
  `;

  if (!row) {
    throw new ApiError(404, "REPORT_NOT_FOUND", "Relationship recovery report not found.");
  }

  return {
    ...row.report,
    id: row.id,
    generatedAt: row.generated_at
  };
}

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function recoveryReportToCsv(report: RelationshipRecoveryReport): string {
  const header = ["file", "rowNumber", "timelineSlug", "title", "status", "eventId", "tags", "sources", "message"];
  return [
    header.map(csvCell).join(","),
    ...report.rows.map((row) =>
      [
        row.file,
        row.rowNumber,
        row.timelineSlug,
        row.title,
        row.status,
        row.eventId ?? "",
        row.tags,
        row.sources,
        row.message || ""
      ].map(csvCell).join(",")
    )
  ].join("\n");
}

export const relationshipRecoveryService = {
  preview: () => buildRecoveryReport("preview"),
  apply: () => buildRecoveryReport("apply"),
  listReports: listRecoveryReports,
  getReport: getRecoveryReport,
  reportToCsv: recoveryReportToCsv
};
