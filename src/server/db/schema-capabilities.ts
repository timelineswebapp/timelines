import type { Sql } from "postgres";

let historicalChronologySupport: boolean | null = null;
let historicalChronologySupportPromise: Promise<boolean> | null = null;
let timelineOrderingModeSupport: boolean | null = null;
let timelineOrderingModeSupportPromise: Promise<boolean> | null = null;

export async function hasHistoricalChronologyColumns(sql: Sql | null): Promise<boolean> {
  if (!sql) {
    return false;
  }

  if (historicalChronologySupport !== null) {
    return historicalChronologySupport;
  }

  if (historicalChronologySupportPromise) {
    return historicalChronologySupportPromise;
  }

  historicalChronologySupportPromise = sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'events'
      AND column_name IN ('sort_year', 'sort_month', 'sort_day', 'display_date')
  `
    .then((rows) => (rows[0]?.count || 0) === 4)
    .catch(() => false)
    .then((supported) => {
      historicalChronologySupport = supported;
      historicalChronologySupportPromise = null;
      return supported;
    });

  return historicalChronologySupportPromise;
}

export async function hasTimelineOrderingModeColumn(sql: Sql | null): Promise<boolean> {
  if (!sql) {
    return false;
  }

  if (timelineOrderingModeSupport !== null) {
    return timelineOrderingModeSupport;
  }

  if (timelineOrderingModeSupportPromise) {
    return timelineOrderingModeSupportPromise;
  }

  timelineOrderingModeSupportPromise = sql<{ count: number }[]>`
    SELECT COUNT(*)::int AS count
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'timelines'
      AND column_name = 'ordering_mode'
  `
    .then((rows) => (rows[0]?.count || 0) === 1)
    .catch(() => false)
    .then((supported) => {
      timelineOrderingModeSupport = supported;
      timelineOrderingModeSupportPromise = null;
      return supported;
    });

  return timelineOrderingModeSupportPromise;
}
