/* eslint-disable @next/next/no-img-element */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactElement } from "react";
import { TIMELINES_ICON_PUBLIC_PATH } from "@/src/lib/brand";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630
} as const;

const TIMELINE_PREFIX_PATTERN = /^timeline of\s+/i;
const MAX_SOCIAL_IMAGE_TITLE_LENGTH = 104;
const BADGE_BOX_SIZE = 112;

let iconDataUrlPromise: Promise<string> | null = null;

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function stripTimelinePrefix(title: string): string {
  const normalizedTitle = normalizeSpacing(title);
  if (!TIMELINE_PREFIX_PATTERN.test(normalizedTitle)) {
    return normalizedTitle;
  }

  const strippedTitle = normalizedTitle.replace(TIMELINE_PREFIX_PATTERN, "").trim();
  return strippedTitle.length >= 20 ? strippedTitle : normalizedTitle;
}

function truncateSocialImageTitle(title: string): string {
  if (title.length <= MAX_SOCIAL_IMAGE_TITLE_LENGTH) {
    return title;
  }

  const candidate = title.slice(0, MAX_SOCIAL_IMAGE_TITLE_LENGTH - 1).trimEnd();
  const lastWordBoundary = candidate.lastIndexOf(" ");
  if (lastWordBoundary <= 28) {
    return `${candidate}…`;
  }

  return `${candidate.slice(0, lastWordBoundary).trimEnd()}…`;
}

function resolveSocialImageTitle(title: string): string {
  return truncateSocialImageTitle(stripTimelinePrefix(title));
}

function resolveTitleMetrics(title: string): { fontSize: number; maxWidth: string; lineHeight: number } {
  if (title.length <= 26) {
    return { fontSize: 88, maxWidth: "820px", lineHeight: 0.92 };
  }

  if (title.length <= 48) {
    return { fontSize: 78, maxWidth: "860px", lineHeight: 0.93 };
  }

  if (title.length <= 72) {
    return { fontSize: 68, maxWidth: "900px", lineHeight: 0.94 };
  }

  return { fontSize: 60, maxWidth: "920px", lineHeight: 0.95 };
}

async function loadPublicSvgDataUrl(publicPath: string): Promise<string> {
  const assetPath = path.join(process.cwd(), "public", publicPath.replace(/^\//, ""));
  const svgMarkup = await readFile(assetPath, "utf8");
  const encodedMarkup = Buffer.from(svgMarkup).toString("base64");
  return `data:image/svg+xml;base64,${encodedMarkup}`;
}

async function getTimelineIconDataUrl(): Promise<string> {
  if (!iconDataUrlPromise) {
    iconDataUrlPromise = loadPublicSvgDataUrl(TIMELINES_ICON_PUBLIC_PATH);
  }

  return iconDataUrlPromise;
}

export async function renderSocialImage({ title }: { title: string }): Promise<ReactElement> {
  const resolvedTitle = resolveSocialImageTitle(title);
  const { fontSize, maxWidth, lineHeight } = resolveTitleMetrics(resolvedTitle);
  const iconDataUrl = await getTimelineIconDataUrl();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: "56px",
        background:
          "radial-gradient(circle at top left, rgba(214, 235, 255, 0.9), rgba(247, 249, 252, 0) 42%), linear-gradient(180deg, #f8fbff 0%, #eef5fb 100%)",
        color: "#1f2f46",
        fontFamily: "Plus Jakarta Sans, system-ui, sans-serif"
      }}
    >
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "stretch",
          width: "100%",
          borderRadius: "42px",
          padding: "58px 60px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.9), rgba(246,250,255,0.76))",
          border: "1px solid rgba(255,255,255,0.72)",
          boxShadow: "0 28px 72px rgba(61, 103, 149, 0.12), inset 0 1px 0 rgba(255,255,255,0.9)"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0",
            borderRadius: "42px",
            background:
              "radial-gradient(circle at top right, rgba(182, 214, 245, 0.22), rgba(182, 214, 245, 0) 34%)"
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            width: "100%",
            paddingRight: "168px"
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: `${fontSize}px`,
                lineHeight,
                letterSpacing: "-0.04em",
                maxHeight: `${Math.round(fontSize * lineHeight * 2)}px`,
                overflow: "hidden"
              }}
            >
              {resolvedTitle}
            </h1>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: "48px",
            bottom: "48px",
            display: "flex",
            zIndex: 1
          }}
        >
          <div
            style={{
              width: `${BADGE_BOX_SIZE}px`,
              height: `${BADGE_BOX_SIZE}px`,
              borderRadius: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.94), rgba(227,240,252,0.86) 55%, rgba(176,206,236,0.42) 100%)",
              border: "1px solid rgba(255,255,255,0.76)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)"
            }}
          >
            <img
              src={iconDataUrl}
              alt=""
              style={{
                width: "34px",
                height: "88px",
                objectFit: "contain",
                opacity: 0.9
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
