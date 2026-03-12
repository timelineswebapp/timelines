import { loadEnvConfig } from "@next/env";
import type { Sql } from "postgres";
import { slugify } from "@/src/lib/utils";

loadEnvConfig(process.cwd());

type Mode = "audit" | "write";

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
    canonicalizedEventDates: Array<{
      eventId: number;
      title: string;
      from: string;
      to: string;
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
      date: string;
      title: string;
      count: number;
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
      canonicalizedEventDates: [],
      touchedTimelines: []
    },
    findings: {
      orphanEvents: [],
      duplicateEventsPerTimeline: [],
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
    duplicateEvents,
    unusedSources,
    unusedTags,
    timelines,
    tags,
    blankTimelineRows,
    blankEventRows,
    blankSourceRows,
    blankTagRows,
    nonCanonicalEvents,
    sequenceMismatches
  ] = await Promise.all([
    sql<{ event_id: number; title: string; date: string }[]>`
      SELECT events.id AS event_id, events.title, events.date::text AS date
      FROM events
      LEFT JOIN timeline_events ON timeline_events.event_id = events.id
      WHERE timeline_events.event_id IS NULL
      ORDER BY events.id ASC
    `,
    sql<{
      timeline_id: number;
      timeline_slug: string;
      date: string;
      title: string;
      count: number;
    }[]>`
      SELECT
        timelines.id AS timeline_id,
        timelines.slug AS timeline_slug,
        events.date::text AS date,
        events.title,
        COUNT(*)::int AS count
      FROM timeline_events
      INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
      INNER JOIN events ON events.id = timeline_events.event_id
      GROUP BY timelines.id, timelines.slug, events.date, events.title
      HAVING COUNT(*) > 1
      ORDER BY timelines.slug ASC, events.date ASC, events.title ASC
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
    sql<{ id: number; title: string; date: string; date_precision: string; canonical_date: string }[]>`
      SELECT
        id,
        title,
        date::text AS date,
        date_precision,
        CASE
          WHEN date_precision = 'year' THEN to_char(date, 'YYYY') || '-01-01'
          WHEN date_precision = 'month' THEN to_char(date, 'YYYY-MM') || '-01'
          ELSE date::text
        END AS canonical_date
      FROM events
      WHERE
        (date_precision = 'year' AND to_char(date, 'MM-DD') <> '01-01')
        OR (date_precision = 'month' AND to_char(date, 'DD') <> '01')
      ORDER BY id ASC
    `,
    sql<{ timeline_id: number; timeline_slug: string; mismatched_rows: number }[]>`
      WITH ordered AS (
        SELECT
          timeline_events.timeline_id,
          timelines.slug AS timeline_slug,
          timeline_events.event_id,
          timeline_events.event_order,
          row_number() OVER (
            PARTITION BY timeline_events.timeline_id
            ORDER BY timeline_events.event_order ASC, events.date ASC, timeline_events.event_id ASC
          ) AS expected_order
        FROM timeline_events
        INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
        INNER JOIN events ON events.id = timeline_events.event_id
      )
      SELECT
        timeline_id,
        timeline_slug,
        COUNT(*)::int AS mismatched_rows
      FROM ordered
      WHERE event_order <> expected_order
      GROUP BY timeline_id, timeline_slug
      ORDER BY timeline_slug ASC
    `
  ]);

  report.findings.orphanEvents = orphanEvents.map((row) => ({
    eventId: row.event_id,
    title: row.title,
    date: row.date
  }));

  report.findings.duplicateEventsPerTimeline = duplicateEvents.map((row) => ({
    timelineId: row.timeline_id,
    timelineSlug: row.timeline_slug,
    date: row.date,
    title: row.title,
    count: row.count
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

  if (mode === "write") {
    const touchedTimelineMap = new Map<number, string>();

    await sql.begin(async (tx) => {
      const transaction = tx as unknown as Sql;

      for (const mismatch of sequenceMismatches) {
        const orderedRows = await transaction<{ event_id: number; expected_order: number }[]>`
          SELECT
            timeline_events.event_id,
            row_number() OVER (
              PARTITION BY timeline_events.timeline_id
              ORDER BY timeline_events.event_order ASC, events.date ASC, timeline_events.event_id ASC
            )::int AS expected_order
          FROM timeline_events
          INNER JOIN events ON events.id = timeline_events.event_id
          WHERE timeline_events.timeline_id = ${mismatch.timeline_id}
          ORDER BY expected_order ASC
        `;

        await transaction`
          UPDATE timeline_events
          SET event_order = event_order + 1000000
          WHERE timeline_id = ${mismatch.timeline_id}
        `;

        for (const row of orderedRows) {
          await transaction`
            UPDATE timeline_events
            SET event_order = ${row.expected_order}
            WHERE timeline_id = ${mismatch.timeline_id}
              AND event_id = ${row.event_id}
          `;
        }

        report.fixes.resequencedTimelines.push({
          timelineId: mismatch.timeline_id,
          timelineSlug: mismatch.timeline_slug,
          updatedRows: mismatch.mismatched_rows
        });

        touchedTimelineMap.set(mismatch.timeline_id, mismatch.timeline_slug);
      }

      for (const event of nonCanonicalEvents) {
        await transaction`
          UPDATE events
          SET date = ${event.canonical_date}
          WHERE id = ${event.id}
        `;

        report.fixes.canonicalizedEventDates.push({
          eventId: event.id,
          title: event.title,
          from: event.date,
          to: event.canonical_date,
          precision: event.date_precision
        });

        const linkedTimelines = await transaction<{ id: number; slug: string }[]>`
          SELECT timelines.id, timelines.slug
          FROM timeline_events
          INNER JOIN timelines ON timelines.id = timeline_events.timeline_id
          WHERE timeline_events.event_id = ${event.id}
        `;

        for (const timeline of linkedTimelines) {
          touchedTimelineMap.set(timeline.id, timeline.slug);
        }
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
