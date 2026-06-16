import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import Papa from "papaparse";
import type { Sql } from "postgres";
import { parseHistoricalDateInput } from "@/src/lib/historical-date";
import type { DatePrecision } from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";

loadEnvConfig(process.cwd());

type Mode = "dry-run" | "apply";
type CsvRow = Record<string, string>;

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
  normalizedTitle: string;
  date: string;
  datePrecision: DatePrecision;
  sortYear: number;
  sortMonth: number | null;
  sortDay: number | null;
  chronologyKey: string;
  tags: string[];
  sources: SourceInput[];
};

type EventMatch = {
  eventId: number;
  timelineId: number;
  timelineSlug: string;
};

type RelationshipKey = `${number}:${number}`;

type ReportRow = {
  file: string;
  rowNumber: number;
  timelineSlug: string;
  title: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  eventId: number | null;
  tags: string[];
  sources: string[];
  message: string | null;
};

type Report = {
  mode: Mode;
  inputPath: string;
  generatedAt: string;
  totals: {
    files: number;
    csvRows: number;
    validRows: number;
    invalidRows: number;
    matchedRows: number;
    unmatchedRows: number;
    ambiguousRows: number;
    uniqueTagsSeen: number;
    uniqueSourcesSeen: number;
    tagsToCreate: number;
    sourcesToCreate: number;
    tagLinksPreExisting: number;
    tagLinksToInsert: number;
    tagLinksInserted: number;
    sourceLinksPreExisting: number;
    sourceLinksToInsert: number;
    sourceLinksInserted: number;
  };
  output: {
    jsonReport: string;
    csvReport: string;
  };
  rows: ReportRow[];
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

function getArgValue(name: string): string | null {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) {
    return inline.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : null;
}

function getMode(): Mode {
  return process.argv.includes("--apply") ? "apply" : "dry-run";
}

function getInputPath(): string {
  const input = getArgValue("--input");
  if (!input) {
    throw new Error("Missing --input <csv-file-or-folder>.");
  }
  return path.resolve(input);
}

function getReportDir(): string {
  return path.resolve(getArgValue("--report-dir") || "reports");
}

async function listCsvFiles(inputPath: string): Promise<string[]> {
  const inputStat = await stat(inputPath);
  if (inputStat.isFile()) {
    if (inputPath.toLowerCase().endsWith(".csv")) {
      return [inputPath];
    }
    throw new Error(`Input file is not a CSV: ${inputPath}`);
  }

  if (!inputStat.isDirectory()) {
    throw new Error(`Input path is neither file nor directory: ${inputPath}`);
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

function normalizeImportTags(rawTags: string | undefined): string[] {
  const value = rawTags?.trim();
  if (!value) {
    return [];
  }

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const part of value.split(/[;,|]/)) {
    const tag = part.trim();
    if (!tag) {
      continue;
    }

    const slug = slugify(tag);
    if (!slug || seen.has(slug)) {
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

async function parseCsvFile(filePath: string): Promise<{ events: ParsedCsvEvent[]; invalidRows: ReportRow[]; totalRows: number }> {
  const content = await readFile(filePath, "utf8");
  const result = Papa.parse<CsvRow>(content, {
    header: true,
    skipEmptyLines: true
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(`CSV parse failed for ${filePath}: ${firstError?.message || "Unknown error"}`);
  }

  const events: ParsedCsvEvent[] = [];
  const invalidRows: ReportRow[] = [];

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
      const parsed: ParsedCsvEvent = {
        file: filePath,
        rowNumber,
        timelineSlug,
        title,
        normalizedTitle: normalizeTitle(title),
        date,
        datePrecision: chronology.datePrecision,
        sortYear: chronology.sortYear,
        sortMonth: chronology.sortMonth,
        sortDay: chronology.sortDay,
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
      };
      events.push(parsed);
    } catch (error) {
      invalidRows.push({
        file: filePath,
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
  mode: Mode,
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

  if (mode === "dry-run") {
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
    throw new Error(`Failed to resolve tag '${name}'.`);
  }

  tagsBySlug.set(slug, resolved);
  return { id: resolved.id, created: Boolean(row) };
}

async function resolveSourceId(
  sql: Sql,
  mode: Mode,
  sourcesByUrl: Map<string, ExistingSourceRow>,
  source: SourceInput
): Promise<{ id: number | null; created: boolean }> {
  const key = source.url.trim().toLowerCase();
  const existing = sourcesByUrl.get(key);
  if (existing) {
    return { id: existing.id, created: false };
  }

  if (mode === "dry-run") {
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
    throw new Error(`Failed to resolve source '${source.url}'.`);
  }

  sourcesByUrl.set(key, resolved);
  return { id: resolved.id, created: Boolean(row) };
}

async function insertRelationship(
  sql: Sql,
  mode: Mode,
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

  if (mode === "dry-run") {
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

function toCsvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

async function writeReport(report: Report) {
  await mkdir(path.dirname(report.output.jsonReport), { recursive: true });
  await writeFile(report.output.jsonReport, `${JSON.stringify(report, null, 2)}\n`);

  const headers = ["file", "rowNumber", "timelineSlug", "title", "status", "eventId", "tags", "sources", "message"] as const;
  const lines = [
    headers.join(","),
    ...report.rows.map((row) => headers.map((header) => toCsvCell(row[header])).join(","))
  ];
  await writeFile(report.output.csvReport, `${lines.join("\n")}\n`);
}

async function main() {
  const mode = getMode();
  const inputPath = getInputPath();
  const reportDir = getReportDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonReport = path.join(reportDir, `event-relationship-backfill-${timestamp}.json`);
  const csvReport = path.join(reportDir, `event-relationship-backfill-${timestamp}.csv`);
  const { closeSql, getWriteSql } = await import("@/src/server/db/client");
  const sql = getWriteSql("event relationship backfill");

  const report: Report = {
    mode,
    inputPath,
    generatedAt: new Date().toISOString(),
    totals: {
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
    output: {
      jsonReport,
      csvReport
    },
    rows: []
  };

  try {
    const files = await listCsvFiles(inputPath);
    if (files.length === 0) {
      throw new Error(`No CSV files found under ${inputPath}.`);
    }
    report.totals.files = files.length;

    const parsedFiles = await Promise.all(files.map((file) => parseCsvFile(file)));
    const csvEvents = parsedFiles.flatMap((file) => file.events);
    report.rows.push(...parsedFiles.flatMap((file) => file.invalidRows));
    report.totals.csvRows = parsedFiles.reduce((sum, file) => sum + file.totalRows, 0);
    report.totals.validRows = csvEvents.length;
    report.totals.invalidRows = report.rows.length;

    const uniqueTagsSeen = new Set(csvEvents.flatMap((event) => event.tags.map((tag) => slugify(tag))));
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
          report.rows.push({
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
          report.rows.push({
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

          const relationship = await insertRelationship(
            query,
            mode,
            eventTagKeys,
            "event_tags",
            "tag_id",
            match.eventId,
            resolved.id
          );
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

          const relationship = await insertRelationship(
            query,
            mode,
            eventSourceKeys,
            "event_sources",
            "source_id",
            match.eventId,
            resolved.id
          );
          if (relationship.preExisting) {
            report.totals.sourceLinksPreExisting += 1;
          } else {
            report.totals.sourceLinksToInsert += 1;
          }
          if (relationship.inserted) {
            report.totals.sourceLinksInserted += 1;
          }
        }

        report.rows.push({
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
      await sql.begin(async (tx) => execute(tx as unknown as Sql));
    } else {
      await execute(sql);
      report.totals.tagLinksInserted = 0;
      report.totals.sourceLinksInserted = 0;
    }

    await writeReport(report);
    console.log(JSON.stringify({ totals: report.totals, output: report.output }, null, 2));
  } finally {
    await closeSql();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
