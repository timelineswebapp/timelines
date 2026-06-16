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
const BADGE_BOX_SIZE = 96;

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

function resolveSocialImageTitle(title: string): string {
  return stripTimelinePrefix(title);
}

function resolveTitleMetrics(title: string): { fontSize: number; maxWidth: string; lineHeight: number; maxHeight: string } {
  if (title.length <= 26) {
    return { fontSize: 82, maxWidth: "860px", lineHeight: 0.94, maxHeight: "166px" };
  }

  if (title.length <= 48) {
    return { fontSize: 72, maxWidth: "900px", lineHeight: 0.96, maxHeight: "210px" };
  }

  if (title.length <= 72) {
    return { fontSize: 62, maxWidth: "920px", lineHeight: 0.98, maxHeight: "244px" };
  }

  return { fontSize: 52, maxWidth: "940px", lineHeight: 1, maxHeight: "260px" };
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

export async function renderSocialImage({
  title,
  category,
  meta,
  label = "TiMELiNES"
}: {
  title: string;
  category?: string | null;
  meta?: string | null;
  label?: string;
}): Promise<ReactElement> {
  const resolvedTitle = resolveSocialImageTitle(title);
  const { fontSize, maxWidth, lineHeight, maxHeight } = resolveTitleMetrics(resolvedTitle);
  const iconDataUrl = await getTimelineIconDataUrl();

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: "72px 84px",
        background: "linear-gradient(180deg, #f8fafc 0%, #edf3f8 100%)",
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
          borderRadius: "24px",
          padding: "56px 64px",
          background: "rgba(255,255,255,0.86)",
          border: "1px solid rgba(140, 158, 179, 0.28)",
          boxShadow: "0 22px 56px rgba(44, 67, 94, 0.10), inset 0 1px 0 rgba(255,255,255,0.9)"
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "0",
              borderRadius: "24px",
              background: "linear-gradient(90deg, rgba(55, 81, 110, 0.035), rgba(55, 81, 110, 0))"
            }}
          />

        <div
          style={{
            position: "relative",
            zIndex: "1",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            paddingRight: "142px"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              fontSize: "24px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#5b718c"
            }}
          >
            <span>{category || "Historical timeline"}</span>
            {meta ? <span style={{ color: "#9aa8b8" }}>•</span> : null}
            {meta ? <span>{meta}</span> : null}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              maxWidth,
              minHeight: "292px"
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: `${fontSize}px`,
                lineHeight,
                letterSpacing: "0",
                maxHeight,
                overflow: "hidden"
              }}
            >
              {resolvedTitle}
            </h1>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              color: "#5b718c",
              fontSize: "24px"
            }}
          >
            <span>{label}</span>
            <span style={{ color: "#9aa8b8" }}>Everything has a timeline.</span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            right: "58px",
            bottom: "58px",
            display: "flex",
            zIndex: "1"
          }}
        >
          <div
            style={{
              width: `${BADGE_BOX_SIZE}px`,
              height: `${BADGE_BOX_SIZE}px`,
              borderRadius: "22px",
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
                width: "30px",
                height: "74px",
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
