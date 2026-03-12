import { clsx } from "clsx";
import { formatHistoricalDisplayDate } from "@/src/lib/historical-date";
import type { DatePrecision } from "@/src/lib/types";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return clsx(parts);
}

export function formatDisplayDate(
  date: string,
  precision: DatePrecision,
  options?: {
    displayDate?: string | null;
    sortYear?: number | null;
    sortMonth?: number | null;
    sortDay?: number | null;
  }
): string {
  return formatHistoricalDisplayDate({
    date,
    datePrecision: precision,
    displayDate: options?.displayDate,
    sortYear: options?.sortYear,
    sortMonth: options?.sortMonth,
    sortDay: options?.sortDay
  });
}

export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function slugify(value: string): string {
  return normalizeQuery(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function truncate(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }

  return `${value.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}
