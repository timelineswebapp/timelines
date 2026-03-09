import { clsx } from "clsx";

export function cn(...parts: Array<string | false | null | undefined>): string {
  return clsx(parts);
}

export function formatDisplayDate(date: string, precision: "year" | "month" | "day" | "approximate"): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  if (precision === "year") {
    return new Intl.DateTimeFormat("en", { year: "numeric", timeZone: "UTC" }).format(parsed);
  }

  if (precision === "month") {
    return new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }).format(parsed);
  }

  return new Intl.DateTimeFormat("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(parsed);
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
