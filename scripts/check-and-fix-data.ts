import { loadEnvConfig } from "@next/env";
import type { Sql } from "postgres";
import { compareHistoricalSort, parseHistoricalDateInput } from "@/src/lib/historical-date";
import { slugify } from "@/src/lib/utils";

loadEnvConfig(process.cwd());

type Mode = "audit" | "write";

type EventChronologyRow = {
  id: number;
  title: string;
  legacy_date: string;
  date_precision: "year" | "month" | "day" | "approximate";
  sort_year: number | null;
  sort_month: number | null;
  sort_day: number | null;
  display_date: string | null;
};

type TimelineEventOrderRow = EventChronologyRow & {
  timeline_id: number;
  timeline_slug: string;
  event_order: number;
};

type Report = {
  mode: Mode;
  counts: {
    timelines: number;
    events: number;
    sources: number;
    tags: number;
    timelineRequests: number;
  };
  fixes: {
    resequencedTimelines: Array<{
      timelineId: number;
      timelineSlug: string;
      updatedRows: number;
    }>;
    chronologyCanonicalizedEvents: Array<{
      eventId: number;
      title: string;
      fromLegacyDate: string;
      toLegacyDate: string;
      fromDisplayDate: string | null;
      toDisplayDate: string;
      precision: string;
    }>;
    touchedTimelines: Array<{
      timelineId: number;
      slug: string;
    }>;
  };
  findings: {
    orphanEvents: Array<{
      eventId: number;
      title: string;
      date: string;
    }>;
    duplicateEventsPerTimeline: Array<{
      timelineId: number;
      timelineSlug: string;
      chronologyKey: string;
      title: string;
      count: number;
    }>;
    chronologyDriftEvents: Array<{
      eventId: number;
      title: string;
      legacyDate: string;
      displayDate: string | null;
      expectedLegacyDate: string;
      expectedDisplayDate: string;
      expectedSortYear: number;
      expectedSortMonth: number | null;
      expectedSortDay: number | null;
    }>;
    chronologyParseFailures: Array<{
      eventId: number;
      title: string;
      sourceValue: string;
      precision: string;
      message: string;
    }>;
    unusedSources: Array<{
      sourceId: number;
      publisher: string;
      url: string;
    }>;
    unusedTags: Array<{
      tagId: number;
      slug: string;
      name: string;
    }>;
    timelineSlugMismatches: Array<{
      timelineId: number;
      title: string;
      slug: string;
      expectedSlug: string;
    }>;
    tagSlugMismatches: Array<{
      tagId: number;
      name: string;
      slug: string;
      expectedSlug: string;
    }>;
    blankStrings: Array<{
      table: string;
      id: number;
      field: string;
    }>;
  };
};

function getMode(): Mode {
  return process.argv.includes("--write") ? "write" : "audit";
}

function chronologySourceValue(row: EventChronologyRow) {
  return row.display_date?.trim() || row.legacy_date;
}

function chronologySignature(row: EventChronologyRow) {
  const parsed = parseHistoricalDateInput(chronologySourceValue(row), row.date_precision);
  return [
    parsed.sortYear,
    parsed.sortMonth ?? "",
    parsed.sortDay ?? "",
    parsed.datePrecision,
    row.title.trim().toLowerCase()
  ].join("|");
}

async function main() {
  const mode = getMode();
  const { closeSql, getWriteSql } = await import("@/src/server/db/client");
  const sql = getWriteSql("data integrity audit");

  const report: Report = {
    mode,
    counts: {
      timelines: 0,
      events: 0,
      sources: 0,
      tags: 0,
      timelineRequests: 0
    },
    fixes: {
      resequencedTimelines: [],
      chronologyCanonicalizedEvents: [],
      touchedTimelines: []
    },
    findings: {
      orphanEvents: [],
      duplicateEventsPerTimeline: [],
      chronologyDriftEvents: [],
      chronologyParseFailures: [],
      unusedSources: [],
      unusedTags: [],
      timelineSlugMismatches: [],
      tagSlugMismatches: [],
      blankStrings: []
    }
  };

  const [counts] = await sql<{
    timelines: number;
    events: number;
    sources: number;
    tags: number;
    timeline_requests: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM timelines) AS timelines,
      (SELECT COUNT(*)::int FROM events) AS events,
      (SELECT COUNT(*)::int FROM sources) AS sources,
      (SELECT COUNT(*)::int FROM tags) AS tags,
      (SELECT COUNT(*)::int FROM timeline_requests) AS timeline_requests
  `;

  report.counts = {
    timelines: counts?.timelines || 0,
    events: counts?.events || 0,
    sources: counts?.sources || 0,
    tags: counts?.tags || 0,
    timelineRequests: counts?.timeline_requests || 0
  };

  const [
    orphanEvents,
    unusedSources,
    unusedTags,
    timelines,
    tags,
    blankTimelineRows,
    blankEventRows,
    blankSourceRows,
    blankTagRows,
    chronologyRows,
    timelineEventRows
  ] = await Promise.all([
    sql<{ event_id: number; title: string; date: string }[]>`
      SELECT events.id AS event_id, events.title, COALESCE(events.display_date, events.date::text) AS date
      FROM events
      LEFT JOIN timeline_events ON timeline_events.event_id = events.id
      WHERE timeline_events.event_id IS NULL
      ORDER BY events.id ASC
    `,
    sql<{ source_id: number; publisher: string; url: string }[]>`
      SELECT sources.id AS source_id, sources.publisher, sources.url
      FROM sources
      LEFT JOIN event_sources ON event_sources.source_id = sources.id
      WHERE event_sources.source_id IS NULL
      ORDER BY sources.id ASC
    `,
    sql<{ tag_id: number; slug: string; name: string }[]>`
      SELECT tags.id AS tag_id, tags.slug, tags.name
      FROM tags
      LEFT JOIN event_tags ON event_tags.tag_id = tags.id
      WHERE event_tags.tag_id IS NULL
      ORDER BY tags.id ASC
    `,
    sql<{ id: number; title: string; slug: string }[]>`
      SELECT id, title, slug
      FROM timelines
      ORDER BY id ASC
    `,
    sql<{ id: number; name: string; slug: string }[]>`
      SELECT id, name, slug
      FROM tags
      ORDER BY id ASC
    `,
    sql<{ id: number; title_blank: boolean; slug_blank: boolean; description_blank: boolean; category_blank: boolean }[]>`
      SELECT
        id,
        btrim(title) = '' AS title_blank,
        btrim(slug) = '' AS slug_blank,
        btrim(description) = '' AS description_blank,
        btrim(category) = '' AS category_blank
      FROM timelines
      WHERE btrim(title) = '' OR btrim(slug) = '' OR btrim(description) = '' OR btrim(category) = ''
    `,
    sql<{ id: number; title_blank: boolean; description_blank: boolean }[]>`
      SELECT
        id,
        btrim(title) = '' AS title_blank,
        btrim(description) = '' AS description_blank
      FROM events
      WHERE btrim(title) = '' OR btrim(description) = ''
    `,
    sql<{ id: number; publisher_blank: boolean; url_blank: boolean }[]>`
      SELECT
        id,
        btrim(publisher) = '' AS publisher_blank,
        btrim(url) = '' AS url_blank
      FROM sources
      WHERE btrim(publisher) = '' OR btrim(url) = ''
    `,
    sql<{ id: number; name_blank: boolean; slug_blank: boolean }[]>`
      SELECT
        id,
        btrim(name) = '' AS name_blank,
        btrim(slug) = '' AS slug_blank
      FROM tags
      WHERE btrim(name) = '' OR btrim(slug) = ''
    `,
    sql<EventChronologyRow[]>`
      SELECT
        id,
        title,
        date::text AS legacy_date,
        date_precision,
        sort_year,
        sort_month,
        sort_day,
        display_date
      FROM events
      ORDER BY id ASC
    `,
    sql<TimelineEventOrderRow[]>`
      SELECT
        timeline_events.timeline_id,
        timelines.slug AS timeline_slug,
        timeline_events.event_order,
        events.id,
        events.title,
        events.date::text AS legacy_date,
        events.date_precision,
        events.sort_year,
        events.sort_month,
        events.sort_day,
        events.display_date
      FROM timeline_events
      INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
      INNER JOIN events ON events.id = timeline_events.event_id
      ORDER BY timeline_events.timeline_id ASC, timeline_events.event_order ASC, events.id ASC
    `
  ]);

  report.findings.orphanEvents = orphanEvents.map((row) => ({
    eventId: row.event_id,
    title: row.title,
    date: row.date
  }));

  report.findings.unusedSources = unusedSources.map((row) => ({
    sourceId: row.source_id,
    publisher: row.publisher,
    url: row.url
  }));

  report.findings.unusedTags = unusedTags.map((row) => ({
    tagId: row.tag_id,
    slug: row.slug,
    name: row.name
  }));

  report.findings.timelineSlugMismatches = timelines
    .map((timeline) => ({
      timelineId: timeline.id,
      title: timeline.title,
      slug: timeline.slug,
      expectedSlug: slugify(timeline.title)
    }))
    .filter((timeline) => timeline.slug !== timeline.expectedSlug);

  report.findings.tagSlugMismatches = tags
    .map((tag) => ({
      tagId: tag.id,
      name: tag.name,
      slug: tag.slug,
      expectedSlug: slugify(tag.name)
    }))
    .filter((tag) => tag.slug !== tag.expectedSlug);

  for (const row of blankTimelineRows) {
    if (row.title_blank) {
      report.findings.blankStrings.push({ table: "timelines", id: row.id, field: "title" });
    }
    if (row.slug_blank) {
      report.findings.blankStrings.push({ table: "timelines", id: row.id, field: "slug" });
    }
    if (row.description_blank) {
      report.findings.blankStrings.push({ table: "timelines", id: row.id, field: "description" });
    }
    if (row.category_blank) {
      report.findings.blankStrings.push({ table: "timelines", id: row.id, field: "category" });
    }
  }

  for (const row of blankEventRows) {
    if (row.title_blank) {
      report.findings.blankStrings.push({ table: "events", id: row.id, field: "title" });
    }
    if (row.description_blank) {
      report.findings.blankStrings.push({ table: "events", id: row.id, field: "description" });
    }
  }

  for (const row of blankSourceRows) {
    if (row.publisher_blank) {
      report.findings.blankStrings.push({ table: "sources", id: row.id, field: "publisher" });
    }
    if (row.url_blank) {
      report.findings.blankStrings.push({ table: "sources", id: row.id, field: "url" });
    }
  }

  for (const row of blankTagRows) {
    if (row.name_blank) {
      report.findings.blankStrings.push({ table: "tags", id: row.id, field: "name" });
    }
    if (row.slug_blank) {
      report.findings.blankStrings.push({ table: "tags", id: row.id, field: "slug" });
    }
  }

  const chronologyByEventId = new Map<number, ReturnType<typeof parseHistoricalDateInput>>();

  for (const row of chronologyRows) {
    const sourceValue = chronologySourceValue(row);

    try {
      const parsed = parseHistoricalDateInput(sourceValue, row.date_precision);
      chronologyByEventId.set(row.id, parsed);

      if (
        row.legacy_date !== parsed.legacyDate ||
        row.display_date !== parsed.displayDate ||
        row.sort_year !== parsed.sortYear ||
        row.sort_month !== parsed.sortMonth ||
        row.sort_day !== parsed.sortDay
      ) {
        report.findings.chronologyDriftEvents.push({
          eventId: row.id,
          title: row.title,
          legacyDate: row.legacy_date,
          displayDate: row.display_date,
          expectedLegacyDate: parsed.legacyDate,
          expectedDisplayDate: parsed.displayDate,
          expectedSortYear: parsed.sortYear,
          expectedSortMonth: parsed.sortMonth,
          expectedSortDay: parsed.sortDay
        });
      }
    } catch (error) {
      report.findings.chronologyParseFailures.push({
        eventId: row.id,
        title: row.title,
        sourceValue,
        precision: row.date_precision,
        message: error instanceof Error ? error.message : "Unknown chronology parse failure"
      });
    }
  }

  const duplicateMap = new Map<string, {
    timelineId: number;
    timelineSlug: string;
    chronologyKey: string;
    title: string;
    count: number;
  }>();

  for (const row of timelineEventRows) {
    const parsed = chronologyByEventId.get(row.id);
    if (!parsed) {
      continue;
    }

    const chronologyKey = [
      parsed.sortYear,
      parsed.sortMonth ?? "",
      parsed.sortDay ?? "",
      parsed.datePrecision,
      row.title.trim().toLowerCase()
    ].join("|");

    const key = `${row.timeline_id}:${chronologyKey}`;
    const existing = duplicateMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      duplicateMap.set(key, {
        timelineId: row.timeline_id,
        timelineSlug: row.timeline_slug,
        chronologyKey,
        title: row.title,
        count: 1
      });
    }
  }

  report.findings.duplicateEventsPerTimeline = [...duplicateMap.values()].filter((row) => row.count > 1);

  const timelineSequenceMismatches = new Map<number, {
    timelineSlug: string;
    rows: Array<{ eventId: number; expectedOrder: number }>;
  }>();

  const rowsByTimeline = new Map<number, TimelineEventOrderRow[]>();
  for (const row of timelineEventRows) {
    const bucket = rowsByTimeline.get(row.timeline_id) || [];
    bucket.push(row);
    rowsByTimeline.set(row.timeline_id, bucket);
  }

  for (const [timelineId, rows] of rowsByTimeline.entries()) {
    const sortedRows = [...rows].sort((left, right) => {
      if (left.event_order !== right.event_order) {
        return left.event_order - right.event_order;
      }

      const chronologyDelta = compareHistoricalSort(
        {
          id: left.id,
          title: left.title,
          date: chronologySourceValue(left),
          displayDate: left.display_date,
          datePrecision: left.date_precision,
          sortYear: left.sort_year,
          sortMonth: left.sort_month,
          sortDay: left.sort_day
        },
        {
          id: right.id,
          title: right.title,
          date: chronologySourceValue(right),
          displayDate: right.display_date,
          datePrecision: right.date_precision,
          sortYear: right.sort_year,
          sortMonth: right.sort_month,
          sortDay: right.sort_day
        }
      );

      if (chronologyDelta !== 0) {
        return chronologyDelta;
      }

      return left.id - right.id;
    });

    const mismatchedRows = sortedRows
      .map((row, index) => ({
        eventId: row.id,
        expectedOrder: index + 1,
        actualOrder: row.event_order
      }))
      .filter((row) => row.expectedOrder !== row.actualOrder);

    if (mismatchedRows.length > 0) {
      timelineSequenceMismatches.set(timelineId, {
        timelineSlug: rows[0]?.timeline_slug || "unknown",
        rows: mismatchedRows.map((row) => ({
          eventId: row.eventId,
          expectedOrder: row.expectedOrder
        }))
      });
    }
  }

  if (mode === "write") {
    const touchedTimelineMap = new Map<number, string>();

    await sql.begin(async (tx) => {
      const transaction = tx as unknown as Sql;

      for (const drift of report.findings.chronologyDriftEvents) {
        await transaction`
          UPDATE events
          SET
            date = CAST(CAST(${drift.expectedLegacyDate} AS TEXT) AS DATE),
            sort_year = ${drift.expectedSortYear},
            sort_month = ${drift.expectedSortMonth},
            sort_day = ${drift.expectedSortDay},
            display_date = ${drift.expectedDisplayDate}
          WHERE id = ${drift.eventId}
        `;

        report.fixes.chronologyCanonicalizedEvents.push({
          eventId: drift.eventId,
          title: drift.title,
          fromLegacyDate: drift.legacyDate,
          toLegacyDate: drift.expectedLegacyDate,
          fromDisplayDate: drift.displayDate,
          toDisplayDate: drift.expectedDisplayDate,
          precision: chronologyRows.find((row) => row.id === drift.eventId)?.date_precision || "unknown"
        });

        const linkedTimelines = await transaction<{ id: number; slug: string }[]>`
          SELECT timelines.id, timelines.slug
          FROM timeline_events
          INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
          WHERE timeline_events.event_id = ${drift.eventId}
        `;

        for (const timeline of linkedTimelines) {
          touchedTimelineMap.set(timeline.id, timeline.slug);
        }
      }

      for (const [timelineId, mismatch] of timelineSequenceMismatches.entries()) {
        await transaction`
          UPDATE timeline_events
          SET event_order = event_order + 1000000
          WHERE timeline_id = ${timelineId}
        `;

        for (const row of mismatch.rows) {
          await transaction`
            UPDATE timeline_events
            SET event_order = ${row.expectedOrder}
            WHERE timeline_id = ${timelineId}
              AND event_id = ${row.eventId}
          `;
        }

        report.fixes.resequencedTimelines.push({
          timelineId,
          timelineSlug: mismatch.timelineSlug,
          updatedRows: mismatch.rows.length
        });
        touchedTimelineMap.set(timelineId, mismatch.timelineSlug);
      }

      if (touchedTimelineMap.size > 0) {
        const touchedIds = [...touchedTimelineMap.keys()];
        await transaction`
          UPDATE timelines
          SET updated_at = NOW()
          WHERE id IN ${transaction(touchedIds)}
        `;

        report.fixes.touchedTimelines = [...touchedTimelineMap.entries()].map(([timelineId, slug]) => ({
          timelineId,
          slug
        }));
      }
    });
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .then(async () => {
    const { closeSql } = await import("@/src/server/db/client");
    await closeSql();
  })
  .catch(async (error) => {
    console.error(error);
    const { closeSql } = await import("@/src/server/db/client");
    await closeSql();
    process.exitCode = 1;
  });
