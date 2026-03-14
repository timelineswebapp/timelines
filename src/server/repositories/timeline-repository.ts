import type { CategoryDetail, CategoryEntry, TimelineDetail, TimelineSummary } from "@/src/lib/types";
import { slugify } from "@/src/lib/utils";
import { ApiError } from "@/src/server/api/responses";
import { getSql, getWriteSql } from "@/src/server/db/client";
import { hasHistoricalChronologyColumns } from "@/src/server/db/schema-capabilities";
import { getMemoryCategoryEntries, memoryStore, touchTimelineSummary } from "@/src/server/dev/memory-store";

interface TimelineRow {
  id: number;
  title: string;
  slug: string;
  description: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface TimelineSitemapRow {
  slug: string;
  updated_at: string;
}

interface CategoryAggregateRow {
  category: string;
  count: number;
  updated_at: string;
}

interface SlugHistoryRow {
  timeline_id: number;
  slug: string;
}

interface TimelineChronologyBoundsRow {
  timeline_id: number;
  min_sort_year: number | null;
  max_sort_year: number | null;
}

type TimelineRouteResolution = {
  timeline: TimelineDetail | null;
  redirectSlug: string | null;
};

type TimelineYearBounds = {
  minYear: number | null;
  maxYear: number | null;
};

function summaryFromRow(row: TimelineRow, tags: TimelineSummary["tags"], eventCount: number, highlightedEventTitles: string[]): TimelineSummary {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category: row.category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags,
    eventCount,
    highlightedEventTitles
  };
}

function normalizeTimelineSummary(summary: TimelineDetail | TimelineSummary): TimelineSummary {
  const { events: _events, relatedTimelines: _relatedTimelines, ...rest } = summary as TimelineDetail;
  return rest as TimelineSummary;
}

function tokenizeRelatedText(value: string) {
  return Array.from(
    new Set(
      value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length >= 4)
    )
  );
}

function buildCategoryEntries(rows: CategoryAggregateRow[]): Array<CategoryEntry & { rawNames: string[] }> {
  const buckets = new Map<string, CategoryEntry & { rawNames: string[] }>();

  for (const row of rows) {
    const slug = slugify(row.category);
    if (!slug) {
      continue;
    }

    const existing = buckets.get(slug);
    if (!existing) {
      buckets.set(slug, {
        slug,
        name: row.category,
        count: row.count,
        updatedAt: row.updated_at,
        rawNames: [row.category]
      });
      continue;
    }

    existing.count += row.count;
    existing.rawNames.push(row.category);
    if (row.updated_at > existing.updatedAt) {
      existing.updatedAt = row.updated_at;
      existing.name = row.category;
    }
  }

  return Array.from(buckets.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.name.localeCompare(right.name);
  });
}

function getTimelineYearBounds(timeline: TimelineDetail): TimelineYearBounds {
  const sortYears = timeline.events
    .map((event) => event.sortYear)
    .filter((year): year is number => typeof year === "number" && Number.isFinite(year));

  if (sortYears.length === 0) {
    return {
      minYear: null,
      maxYear: null
    };
  }

  return {
    minYear: Math.min(...sortYears),
    maxYear: Math.max(...sortYears)
  };
}

function chronologySignal(
  currentBounds: TimelineYearBounds,
  candidateBounds: TimelineYearBounds | undefined
) {
  if (
    currentBounds.minYear === null
    || currentBounds.maxYear === null
    || !candidateBounds
    || candidateBounds.minYear === null
    || candidateBounds.maxYear === null
  ) {
    return 0;
  }

  if (candidateBounds.minYear <= currentBounds.maxYear && candidateBounds.maxYear >= currentBounds.minYear) {
    return 1.5;
  }

  const gap = Math.min(
    Math.abs((candidateBounds.minYear ?? 0) - currentBounds.maxYear),
    Math.abs((candidateBounds.maxYear ?? 0) - currentBounds.minYear)
  );

  return gap <= 75 ? 0.75 : 0;
}

function scoreSemanticCandidate(
  current: TimelineDetail,
  candidate: TimelineSummary,
  currentBounds: TimelineYearBounds,
  boundsMap: Map<number, TimelineYearBounds>
) {
  const currentTagSlugs = new Set(current.tags.map((tag) => tag.slug));
  const candidateTagSlugs = new Set(candidate.tags.map((tag) => tag.slug));
  const sharedTags = Array.from(candidateTagSlugs).filter((slug) => currentTagSlugs.has(slug)).length;

  const currentTokens = tokenizeRelatedText(`${current.title} ${current.description} ${current.highlightedEventTitles.join(" ")}`);
  const candidateTokens = new Set(tokenizeRelatedText(`${candidate.title} ${candidate.description} ${candidate.highlightedEventTitles.join(" ")}`));
  const sharedTokens = currentTokens.filter((token) => candidateTokens.has(token)).length;

  let score = 0;
  score += sharedTags * 5;
  score += sharedTokens * 0.6;
  score += chronologySignal(currentBounds, boundsMap.get(candidate.id));

  if (candidate.category === current.category) {
    score += 0.75;
  }

  return score;
}

function selectSemanticRelatedSummaries(
  current: TimelineDetail,
  candidates: TimelineSummary[],
  boundsMap: Map<number, TimelineYearBounds>,
  limit = 4
) {
  const currentBounds = getTimelineYearBounds(current);

  return candidates
    .filter((candidate) => candidate.id !== current.id)
    .map((candidate) => ({
      candidate,
      score: scoreSemanticCandidate(current, candidate, currentBounds, boundsMap)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.candidate.updatedAt !== left.candidate.updatedAt) {
        return right.candidate.updatedAt.localeCompare(left.candidate.updatedAt);
      }

      return right.candidate.id - left.candidate.id;
    })
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

async function getTimelineTags(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((item) => item.id === timelineId);
    return timeline?.tags || [];
  }

  return sql<{
    id: number;
    slug: string;
    name: string;
  }[]>`
    SELECT DISTINCT tags.id, tags.slug, tags.name
    FROM timeline_events
    INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
    INNER JOIN tags ON tags.id = event_tags.tag_id
    WHERE timeline_events.timeline_id = ${timelineId}
    ORDER BY tags.name ASC
  `;
}

async function getTimelineEventHighlights(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    const timeline = memoryStore.getTimelines().find((item) => item.id === timelineId);
    return timeline?.events.slice(0, 3).map((event) => event.title) || [];
  }

  const rows = await sql<{ title: string }[]>`
    SELECT events.title
    FROM timeline_events
    INNER JOIN events ON events.id = timeline_events.event_id
    WHERE timeline_events.timeline_id = ${timelineId}
    ORDER BY timeline_events.event_order ASC
    LIMIT 3
  `;

  return rows.map((row) => row.title);
}

async function getTimelineEventCount(timelineId: number) {
  const sql = getSql();
  if (!sql) {
    return memoryStore.getTimelines().find((item) => item.id === timelineId)?.events.length || 0;
  }

  const [row] = await sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM timeline_events
    WHERE timeline_id = ${timelineId}
  `;

  return row?.count || 0;
}

async function getCategoryRows() {
  const sql = getSql();
  if (!sql) {
    return getMemoryCategoryEntries().map((entry) => ({
      category: entry.name,
      count: entry.count,
      updated_at: entry.updatedAt
    }));
  }

  return sql<CategoryAggregateRow[]>`
    SELECT category, COUNT(*)::int AS count, MAX(updated_at)::text AS updated_at
    FROM timelines
    GROUP BY category
    ORDER BY MAX(updated_at) DESC, category ASC
  `;
}

async function getChronologyBoundsMap(timelineIds: number[]) {
  const sql = getSql();
  if (!sql) {
    const map = new Map<number, TimelineYearBounds>();

    for (const timeline of memoryStore.getTimelines()) {
      if (!timelineIds.includes(timeline.id)) {
        continue;
      }

      map.set(timeline.id, getTimelineYearBounds(timeline));
    }

    return map;
  }

  if (timelineIds.length === 0) {
    return new Map<number, TimelineYearBounds>();
  }

  const rows = await sql<TimelineChronologyBoundsRow[]>`
    SELECT
      timeline_events.timeline_id::int AS timeline_id,
      MIN(COALESCE(events.sort_year, CAST(SUBSTRING(events.date::text FROM 1 FOR 4) AS INTEGER)))::int AS min_sort_year,
      MAX(COALESCE(events.sort_year, CAST(SUBSTRING(events.date::text FROM 1 FOR 4) AS INTEGER)))::int AS max_sort_year
    FROM timeline_events
    INNER JOIN events ON events.id = timeline_events.event_id
    WHERE timeline_events.timeline_id IN ${sql(timelineIds)}
    GROUP BY timeline_events.timeline_id
  `;

  return rows.reduce<Map<number, TimelineYearBounds>>((accumulator, row) => {
    accumulator.set(row.timeline_id, {
      minYear: row.min_sort_year,
      maxYear: row.max_sort_year
    });
    return accumulator;
  }, new Map());
}

async function assertSlugAvailable(sql: ReturnType<typeof getWriteSql>, slug: string, excludeTimelineId?: number) {
  const [currentSlugRow] = await sql<{ id: number }[]>`
    SELECT id
    FROM timelines
    WHERE slug = ${slug}
      ${excludeTimelineId ? sql`AND id <> ${excludeTimelineId}` : sql``}
    LIMIT 1
  `;

  if (currentSlugRow) {
    throw new ApiError(409, "SLUG_CONFLICT", "Timeline slug is already in use.");
  }

  const [historicalSlugRow] = await sql<SlugHistoryRow[]>`
    SELECT timeline_id, slug
    FROM timeline_slug_history
    WHERE slug = ${slug}
      ${excludeTimelineId ? sql`AND timeline_id <> ${excludeTimelineId}` : sql``}
    LIMIT 1
  `;

  if (historicalSlugRow) {
    throw new ApiError(409, "SLUG_CONFLICT", "Timeline slug is reserved by redirect history.");
  }
}

export const timelineRepository = {
  async listSummaries(limit = 12): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelineSummaries().slice(0, limit);
    }

    const rows = await sql<
      (TimelineRow & {
        tags: TimelineSummary["tags"] | null;
        event_count: number | null;
        highlighted_event_titles: string[] | null;
      })[]
    >`
      SELECT
        timelines.id,
        timelines.title,
        timelines.slug,
        timelines.description,
        timelines.category,
        timelines.created_at::text AS created_at,
        timelines.updated_at::text AS updated_at,
        COALESCE(tags.tags, '[]'::jsonb) AS tags,
        COALESCE(counts.event_count, 0) AS event_count,
        COALESCE(highlights.highlighted_event_titles, ARRAY[]::text[]) AS highlighted_event_titles
      FROM timelines
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS event_count
        FROM timeline_events
        WHERE timeline_id = timelines.id
      ) counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT events.title
          FROM timeline_events
          INNER JOIN events ON events.id = timeline_events.event_id
          WHERE timeline_events.timeline_id = timelines.id
          ORDER BY timeline_events.event_order ASC
          LIMIT 3
        ) AS highlighted_event_titles
      ) highlights ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('id', timeline_tags.id, 'slug', timeline_tags.slug, 'name', timeline_tags.name)
            ORDER BY timeline_tags.name ASC
          ),
          '[]'::jsonb
        ) AS tags
        FROM (
          SELECT DISTINCT tags.id, tags.slug, tags.name
          FROM timeline_events
          INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
          INNER JOIN tags ON tags.id = event_tags.tag_id
          WHERE timeline_events.timeline_id = timelines.id
        ) AS timeline_tags
      ) tags ON TRUE
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) =>
      summaryFromRow(
        row,
        row.tags || [],
        row.event_count || 0,
        row.highlighted_event_titles || []
      )
    );
  },

  async listCategoryEntries(): Promise<CategoryEntry[]> {
    const rows = await getCategoryRows();
    return buildCategoryEntries(rows).map(({ rawNames: _rawNames, ...entry }) => entry);
  },

  async listByCategoryNames(categories: string[], limit = 200): Promise<TimelineSummary[]> {
    const normalizedCategories = Array.from(new Set(categories.map((category) => category.trim()).filter(Boolean)));
    if (normalizedCategories.length === 0) {
      return [];
    }

    const sql = getSql();
    if (!sql) {
      return memoryStore
        .getTimelineSummaries()
        .filter((timeline) => normalizedCategories.includes(timeline.category))
        .slice(0, limit);
    }

    const rows = await sql<
      (TimelineRow & {
        tags: TimelineSummary["tags"] | null;
        event_count: number | null;
        highlighted_event_titles: string[] | null;
      })[]
    >`
      SELECT
        timelines.id,
        timelines.title,
        timelines.slug,
        timelines.description,
        timelines.category,
        timelines.created_at::text AS created_at,
        timelines.updated_at::text AS updated_at,
        COALESCE(tags.tags, '[]'::jsonb) AS tags,
        COALESCE(counts.event_count, 0) AS event_count,
        COALESCE(highlights.highlighted_event_titles, ARRAY[]::text[]) AS highlighted_event_titles
      FROM timelines
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS event_count
        FROM timeline_events
        WHERE timeline_id = timelines.id
      ) counts ON TRUE
      LEFT JOIN LATERAL (
        SELECT ARRAY(
          SELECT events.title
          FROM timeline_events
          INNER JOIN events ON events.id = timeline_events.event_id
          WHERE timeline_events.timeline_id = timelines.id
          ORDER BY timeline_events.event_order ASC
          LIMIT 3
        ) AS highlighted_event_titles
      ) highlights ON TRUE
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object('id', timeline_tags.id, 'slug', timeline_tags.slug, 'name', timeline_tags.name)
            ORDER BY timeline_tags.name ASC
          ),
          '[]'::jsonb
        ) AS tags
        FROM (
          SELECT DISTINCT tags.id, tags.slug, tags.name
          FROM timeline_events
          INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
          INNER JOIN tags ON tags.id = event_tags.tag_id
          WHERE timeline_events.timeline_id = timelines.id
        ) AS timeline_tags
      ) tags ON TRUE
      WHERE timelines.category IN ${sql(normalizedCategories)}
      ORDER BY timelines.updated_at DESC, timelines.id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) =>
      summaryFromRow(
        row,
        row.tags || [],
        row.event_count || 0,
        row.highlighted_event_titles || []
      )
    );
  },

  async getByCategorySlug(slug: string): Promise<CategoryDetail | null> {
    const categoryEntries = buildCategoryEntries(await getCategoryRows());
    const matchedCategory = categoryEntries.find((entry) => entry.slug === slug);
    if (!matchedCategory) {
      return null;
    }

    const timelines = await timelineRepository.listByCategoryNames(matchedCategory.rawNames, 200);

    return {
      category: {
        slug: matchedCategory.slug,
        name: matchedCategory.name,
        count: matchedCategory.count,
        updatedAt: matchedCategory.updatedAt
      },
      timelines
    };
  },

  async listStaticSlugs(limit = 50): Promise<string[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().slice(0, limit).map((timeline) => timeline.slug);
    }

    const rows = await sql<{ slug: string }[]>`
      SELECT slug
      FROM timelines
      ORDER BY updated_at DESC, id DESC
      LIMIT ${limit}
    `;

    return rows.map((row) => row.slug);
  },

  async listSitemapEntries(): Promise<Array<{ slug: string; updatedAt: string }>> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().map((timeline) => ({
        slug: timeline.slug,
        updatedAt: timeline.updatedAt
      }));
    }

    const rows = await sql<TimelineSitemapRow[]>`
      SELECT slug, updated_at::text AS updated_at
      FROM timelines
      ORDER BY updated_at DESC, id DESC
    `;

    return rows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at
    }));
  },

  async listRegistryExport(): Promise<Array<{
    timelineTitle: string;
    timelineSlug: string;
    category: string;
    eventCount: number;
    lastUpdated: string;
  }>> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelines().map((timeline) => ({
        timelineTitle: timeline.title,
        timelineSlug: timeline.slug,
        category: timeline.category,
        eventCount: timeline.events.length,
        lastUpdated: timeline.updatedAt
      }));
    }

    return sql<{
      timelineTitle: string;
      timelineSlug: string;
      category: string;
      eventCount: number;
      lastUpdated: string;
    }[]>`
      SELECT
        timelines.title AS "timelineTitle",
        timelines.slug AS "timelineSlug",
        timelines.category,
        COUNT(timeline_events.event_id)::int AS "eventCount",
        timelines.updated_at::text AS "lastUpdated"
      FROM timelines
      LEFT JOIN timeline_events ON timeline_events.timeline_id = timelines.id
      GROUP BY timelines.id
      ORDER BY timelines.updated_at DESC, timelines.id DESC
    `;
  },

  async resolveBySlug(slug: string): Promise<TimelineRouteResolution> {
    const sql = getSql();
    if (!sql) {
      const timeline = memoryStore.getTimelines().find((item) => item.slug === slug);
      if (timeline) {
        return {
          timeline: await timelineRepository.getBySlug(timeline.slug),
          redirectSlug: null
        };
      }

      const historical = memoryStore.getSlugHistory().find((entry) => entry.slug === slug);
      if (!historical) {
        return {
          timeline: null,
          redirectSlug: null
        };
      }

      const resolvedTimeline = memoryStore.getTimelines().find((item) => item.id === historical.timelineId) || null;
      return {
        timeline: resolvedTimeline ? await timelineRepository.getBySlug(resolvedTimeline.slug) : null,
        redirectSlug: resolvedTimeline?.slug || null
      };
    }

    const [timelineRow] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
      FROM timelines
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (timelineRow) {
      return {
        timeline: await timelineRepository.getBySlug(timelineRow.slug),
        redirectSlug: null
      };
    }

    const [historicalSlugRow] = await sql<SlugHistoryRow[]>`
      SELECT timeline_id, slug
      FROM timeline_slug_history
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (!historicalSlugRow) {
      return {
        timeline: null,
        redirectSlug: null
      };
    }

    const [currentTimelineRow] = await sql<{ slug: string }[]>`
      SELECT slug
      FROM timelines
      WHERE id = ${historicalSlugRow.timeline_id}
      LIMIT 1
    `;

    if (!currentTimelineRow?.slug) {
      return {
        timeline: null,
        redirectSlug: null
      };
    }

    return {
      timeline: await timelineRepository.getBySlug(currentTimelineRow.slug),
      redirectSlug: currentTimelineRow.slug
    };
  },

  async getBySlug(slug: string): Promise<TimelineDetail | null> {
    const sql = getSql();
    if (!sql) {
      const timeline = memoryStore.getTimelines().find((item) => item.slug === slug);
      if (!timeline) {
        return null;
      }

      const summaries = memoryStore.getTimelineSummaries();
      const boundsMap = new Map<number, TimelineYearBounds>();
      for (const candidate of memoryStore.getTimelines()) {
        boundsMap.set(candidate.id, getTimelineYearBounds(candidate));
      }

      return {
        ...timeline,
        relatedTimelines: selectSemanticRelatedSummaries(timeline, summaries, boundsMap, 4)
      };
    }

    const [timelineRow] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
      FROM timelines
      WHERE slug = ${slug}
      LIMIT 1
    `;

    if (!timelineRow) {
      return null;
    }

    const hasHistoricalColumns = await hasHistoricalChronologyColumns(sql);

    const [tags, eventRows] = await Promise.all([
      getTimelineTags(timelineRow.id),
      hasHistoricalColumns
        ? sql<{
            id: number;
            date: string;
            legacy_date: string;
            display_date: string | null;
            sort_year: number | null;
            sort_month: number | null;
            sort_day: number | null;
            date_precision: TimelineDetail["events"][number]["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
            source_ids: number[] | null;
            tag_ids: number[] | null;
          }[]>`
            SELECT
              events.id,
              COALESCE(events.display_date, events.date::text) AS date,
              events.date::text AS legacy_date,
              events.display_date,
              events.sort_year,
              events.sort_month,
              events.sort_day,
              events.date_precision,
              events.title,
              events.description,
              events.importance,
              events.location,
              events.image_url,
              events.created_at::text AS created_at,
              events.updated_at::text AS updated_at,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_sources.source_id), NULL) AS source_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_tags.tag_id), NULL) AS tag_ids
            FROM timeline_events
            INNER JOIN events ON events.id = timeline_events.event_id
            LEFT JOIN event_sources ON event_sources.event_id = events.id
            LEFT JOIN event_tags ON event_tags.event_id = events.id
            WHERE timeline_events.timeline_id = ${timelineRow.id}
            GROUP BY events.id, timeline_events.event_order
            ORDER BY timeline_events.event_order ASC
          `
        : sql<{
            id: number;
            date: string;
            date_precision: TimelineDetail["events"][number]["datePrecision"];
            title: string;
            description: string;
            importance: number;
            location: string | null;
            image_url: string | null;
            created_at: string;
            updated_at: string;
            source_ids: number[] | null;
            tag_ids: number[] | null;
          }[]>`
            SELECT
              events.id,
              events.date::text AS date,
              events.date_precision,
              events.title,
              events.description,
              events.importance,
              events.location,
              events.image_url,
              events.created_at::text AS created_at,
              events.updated_at::text AS updated_at,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_sources.source_id), NULL) AS source_ids,
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT event_tags.tag_id), NULL) AS tag_ids
            FROM timeline_events
            INNER JOIN events ON events.id = timeline_events.event_id
            LEFT JOIN event_sources ON event_sources.event_id = events.id
            LEFT JOIN event_tags ON event_tags.event_id = events.id
            WHERE timeline_events.timeline_id = ${timelineRow.id}
            GROUP BY events.id, timeline_events.event_order
            ORDER BY timeline_events.event_order ASC
          `
    ]);

    const sourceIds = Array.from(new Set(eventRows.flatMap((row) => row.source_ids || [])));
    const tagIds = Array.from(new Set(eventRows.flatMap((row) => row.tag_ids || [])));

    const [sources, eventTags] = await Promise.all([
      sourceIds.length > 0
        ? sql<{ id: number; publisher: string; url: string; credibility_score: string }[]>`
            SELECT id, publisher, url, credibility_score::text
            FROM sources
            WHERE id IN ${sql(sourceIds)}
          `
        : Promise.resolve([]),
      tagIds.length > 0
        ? sql<{ id: number; slug: string; name: string }[]>`
            SELECT id, slug, name
            FROM tags
            WHERE id IN ${sql(tagIds)}
          `
        : Promise.resolve([])
    ]);

    const detail: TimelineDetail = {
      ...summaryFromRow(
        timelineRow,
        tags,
        eventRows.length,
        eventRows.slice(0, 3).map((row) => row.title)
      ),
      events: eventRows.map((row) => ({
        id: row.id,
        date: row.date,
        datePrecision: row.date_precision,
        legacyDate: "legacy_date" in row ? row.legacy_date : row.date,
        displayDate: "display_date" in row ? row.display_date : null,
        sortYear: "sort_year" in row ? row.sort_year : null,
        sortMonth: "sort_month" in row ? row.sort_month : null,
        sortDay: "sort_day" in row ? row.sort_day : null,
        title: row.title,
        description: row.description,
        importance: row.importance,
        location: row.location,
        imageUrl: row.image_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        sources: sources
          .filter((source) => (row.source_ids || []).includes(source.id))
          .map((source) => ({
            id: source.id,
            publisher: source.publisher,
            url: source.url,
            credibilityScore: Number(source.credibility_score)
          })),
        tags: eventTags.filter((tag) => (row.tag_ids || []).includes(tag.id))
        })),
      relatedTimelines: []
    };

    const currentTagSlugs = tags.slice(0, 4).map((tag) => tag.slug);
    const candidateBuckets = await Promise.all([
      timelineRepository.listSummaries(24),
      timelineRepository.listByCategoryNames([timelineRow.category], 12),
      timelineRepository.search(`${timelineRow.title} ${timelineRow.description}`, 12),
      ...currentTagSlugs.slice(0, 3).map((tagSlug) => timelineRepository.getByTag(tagSlug))
    ]);

    const uniqueCandidates = Array.from(
      candidateBuckets
        .flat()
        .reduce<Map<string, TimelineSummary>>((accumulator, candidate) => {
          if (candidate.id !== detail.id && !accumulator.has(candidate.slug)) {
            accumulator.set(candidate.slug, candidate);
          }

          return accumulator;
        }, new Map())
        .values()
    );

    const boundsMap = await getChronologyBoundsMap([detail.id, ...uniqueCandidates.map((candidate) => candidate.id)]);
    detail.relatedTimelines = selectSemanticRelatedSummaries(detail, uniqueCandidates, boundsMap, 4);

    return detail;
  },

  async getById(id: number): Promise<TimelineSummary | null> {
    const sql = getSql();
    if (!sql) {
      return memoryStore.getTimelineSummaries().find((item) => item.id === id) || null;
    }

    const [row] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
      FROM timelines
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!row) {
      return null;
    }

    const [tags, count, highlights] = await Promise.all([
      getTimelineTags(row.id),
      getTimelineEventCount(row.id),
      getTimelineEventHighlights(row.id)
    ]);

    return summaryFromRow(row, tags, count, highlights);
  },

  async getByTag(slug: string): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      return memoryStore
        .getTimelineSummaries()
        .filter((timeline) => timeline.tags.some((tag) => tag.slug === slug));
    }

    const rows = await sql<TimelineRow[]>`
      SELECT DISTINCT timelines.id, timelines.title, timelines.slug, timelines.description, timelines.category, timelines.created_at::text AS created_at, timelines.updated_at::text AS updated_at
      FROM timelines
      INNER JOIN timeline_events ON timeline_events.timeline_id = timelines.id
      INNER JOIN event_tags ON event_tags.event_id = timeline_events.event_id
      INNER JOIN tags ON tags.id = event_tags.tag_id
      WHERE tags.slug = ${slug}
      ORDER BY timelines.updated_at DESC
    `;

    return Promise.all(
      rows.map(async (row) => {
        const [tags, count, highlights] = await Promise.all([
          getTimelineTags(row.id),
          getTimelineEventCount(row.id),
          getTimelineEventHighlights(row.id)
        ]);

        return summaryFromRow(row, tags, count, highlights);
      })
    );
  },

  async search(query: string, limit: number): Promise<TimelineSummary[]> {
    const sql = getSql();
    if (!sql) {
      const normalized = query.toLowerCase();
      return memoryStore
        .getTimelineSummaries()
        .filter((timeline) => {
          const haystacks = [
            timeline.title,
            timeline.description,
            timeline.tags.map((tag) => tag.name).join(" "),
            ...memoryStore.getTimelines().find((candidate) => candidate.id === timeline.id)?.events.map((event) => `${event.title} ${event.description}`) || []
          ]
            .join(" ")
            .toLowerCase();

          return haystacks.includes(normalized);
        })
        .slice(0, limit);
    }

    const rows = await sql<{
      id: number;
      title: string;
      slug: string;
      description: string;
      category: string;
      created_at: string;
      updated_at: string;
      rank_score: number;
    }[]>`
      WITH search_query AS (
        SELECT websearch_to_tsquery('english', ${query}) AS q
      ),
      ranked_timelines AS (
        SELECT
          timelines.id,
          timelines.title,
          timelines.slug,
          timelines.description,
          timelines.category,
          timelines.created_at::text AS created_at,
          timelines.updated_at::text AS updated_at,
          MAX(
            GREATEST(
              ts_rank_cd(timelines.search_vector, search_query.q) * 1.5,
              COALESCE(ts_rank_cd(events.search_vector, search_query.q), 0),
              CASE
                WHEN to_tsvector('english', coalesce(tags.name, '') || ' ' || coalesce(tags.slug, '')) @@ search_query.q
                  THEN 0.8
                ELSE 0
              END
            )
          ) AS rank_score
        FROM timelines
        CROSS JOIN search_query
        LEFT JOIN timeline_events ON timeline_events.timeline_id = timelines.id
        LEFT JOIN events ON events.id = timeline_events.event_id
        LEFT JOIN event_tags ON event_tags.event_id = events.id
        LEFT JOIN tags ON tags.id = event_tags.tag_id
        WHERE
          timelines.search_vector @@ search_query.q
          OR events.search_vector @@ search_query.q
          OR to_tsvector('english', coalesce(tags.name, '') || ' ' || coalesce(tags.slug, '')) @@ search_query.q
        GROUP BY
          timelines.id,
          timelines.title,
          timelines.slug,
          timelines.description,
          timelines.category,
          timelines.created_at,
          timelines.updated_at
      )
      SELECT
        id,
        title,
        slug,
        description,
        category,
        created_at,
        updated_at,
        rank_score
      FROM ranked_timelines
      ORDER BY
        rank_score DESC,
        updated_at DESC,
        id DESC
      LIMIT ${limit}
    `;

    return Promise.all(
      rows.map(async (row) => {
        const [tags, count, highlights] = await Promise.all([
          getTimelineTags(row.id),
          getTimelineEventCount(row.id),
          getTimelineEventHighlights(row.id)
        ]);

        return summaryFromRow(row, tags, count, highlights);
      })
    );
  },

  async create(input: { title: string; slug: string; description: string; category: string }): Promise<TimelineSummary> {
    const sql = getWriteSql("timeline create");
    await assertSlugAvailable(sql, input.slug);

    const [row] = await sql<TimelineRow[]>`
      INSERT INTO timelines (title, slug, description, category)
      VALUES (${input.title}, ${input.slug}, ${input.description}, ${input.category})
      RETURNING id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
    `;

    if (!row) {
      throw new Error("Timeline insert failed.");
    }

    return summaryFromRow(row, [], 0, []);
  },

  async update(id: number, input: { title: string; slug: string; description: string; category: string }): Promise<TimelineSummary | null> {
    const sql = getWriteSql("timeline update");
    const [currentRow] = await sql<TimelineRow[]>`
      SELECT id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
      FROM timelines
      WHERE id = ${id}
      LIMIT 1
    `;

    if (!currentRow) {
      return null;
    }

    if (currentRow.slug !== input.slug) {
      await assertSlugAvailable(sql, input.slug, id);
      await sql`
        DELETE FROM timeline_slug_history
        WHERE timeline_id = ${id}
          AND slug = ${input.slug}
      `;
    }

    const [row] = await sql<TimelineRow[]>`
      UPDATE timelines
      SET title = ${input.title}, slug = ${input.slug}, description = ${input.description}, category = ${input.category}
      WHERE id = ${id}
      RETURNING id, title, slug, description, category, created_at::text AS created_at, updated_at::text AS updated_at
    `;

    if (!row) {
      return null;
    }

    if (currentRow.slug !== input.slug) {
      await sql`
        INSERT INTO timeline_slug_history (timeline_id, slug)
        VALUES (${id}, ${currentRow.slug})
        ON CONFLICT (slug) DO NOTHING
      `;
    }

    const [tags, count, highlights] = await Promise.all([
      getTimelineTags(row.id),
      getTimelineEventCount(row.id),
      getTimelineEventHighlights(row.id)
    ]);

    return summaryFromRow(row, tags, count, highlights);
  },

  async delete(id: number): Promise<boolean> {
    const sql = getWriteSql("timeline delete");

    const result = await sql`
      DELETE FROM timelines
      WHERE id = ${id}
    `;

    return result.count > 0;
  }
};
