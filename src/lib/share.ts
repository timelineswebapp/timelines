const TIMELINE_SHARE_ORIGIN = "https://timelines.sbs";

export function buildCanonicalTimelineUrl(slug: string): string {
  return `${TIMELINE_SHARE_ORIGIN}/timeline/${encodeURIComponent(slug)}`;
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
