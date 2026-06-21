import { buildPublicUrl } from "@/src/lib/public-site";
import { slugify } from "@/src/lib/utils";

const FALLBACK_MILESTONE_SLUG = "milestone";

export function buildTimelinePath(slug: string): string {
  return `/timeline/${encodeURIComponent(slug)}`;
}

export function buildEventPath(timelineSlug: string, eventId: number): string {
  return `${buildTimelinePath(timelineSlug)}?event=${encodeURIComponent(String(eventId))}`;
}

export function buildMilestoneSlug(title: string): string {
  return slugify(title) || FALLBACK_MILESTONE_SLUG;
}

export function buildMilestonePath(eventId: number, titleOrSlug: string): string {
  const slug = buildMilestoneSlug(titleOrSlug);
  return `/milestone/${encodeURIComponent(String(eventId))}/${encodeURIComponent(slug)}`;
}

export function buildHistoricalObjectPath(slug: string): string {
  return `/object/${encodeURIComponent(slug)}`;
}

export function buildCanonicalTimelineUrl(slug: string): string {
  return buildPublicUrl(buildTimelinePath(slug));
}

export function buildCanonicalEventUrl(timelineSlug: string, eventId: number): string {
  return buildPublicUrl(buildEventPath(timelineSlug, eventId));
}

export function buildCanonicalMilestoneUrl(eventId: number, titleOrSlug: string): string {
  return buildPublicUrl(buildMilestonePath(eventId, titleOrSlug));
}

export function buildTimelineOgImagePath(slug: string): string {
  return `/og/timeline/${encodeURIComponent(slug)}`;
}

export function buildEventOgImagePath(eventId: number): string {
  return `/og/event/${encodeURIComponent(String(eventId))}`;
}

export function summarizeShareText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function parseEventIdParam(value: string | null | undefined): number | null {
  const normalized = value?.trim() || "";
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseMilestoneIdParam(value: string | null | undefined): number | null {
  return parseEventIdParam(value);
}

export async function copyTextToClipboard(value: string): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Clipboard access requires a browser context.");
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Fall through to the legacy copy path when permissions or secure-context checks block the Clipboard API.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    const didCopy = document.execCommand("copy");
    if (!didCopy) {
      throw new Error("Clipboard copy command returned false.");
    }
  } finally {
    document.body.removeChild(textarea);
  }
}
