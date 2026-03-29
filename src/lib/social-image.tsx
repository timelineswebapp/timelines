import type { ReactElement } from "react";

export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630
} as const;

export function renderSocialImage({
  eyebrow,
  title,
  subtitle
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}): ReactElement {
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
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          borderRadius: "42px",
          padding: "46px 48px",
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

        <div style={{ display: "flex", flexDirection: "column", gap: "22px", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              padding: "10px 16px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.74)",
              border: "1px solid rgba(193, 215, 236, 0.82)",
              color: "rgba(68, 102, 145, 0.92)",
              fontSize: "24px",
              letterSpacing: "0.22em",
              textTransform: "uppercase"
            }}
          >
            {eyebrow}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              maxWidth: "940px"
            }}
          >
            <h1
              style={{
                margin: 0,
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: "72px",
                lineHeight: 0.95,
                letterSpacing: "-0.03em"
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "30px",
                lineHeight: 1.3,
                color: "rgba(64, 82, 109, 0.84)"
              }}
            >
              {subtitle}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            <span
              style={{
                fontSize: "16px",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(84, 108, 137, 0.66)"
              }}
            >
              Shared from
            </span>
            <span
              style={{
                fontFamily: "Cormorant Garamond, Georgia, serif",
                fontSize: "34px",
                letterSpacing: "0.02em"
              }}
            >
              TiMELiNES
            </span>
          </div>

          <div
            style={{
              width: "112px",
              height: "112px",
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
            <span
              style={{
                fontSize: "26px",
                letterSpacing: "0.28em",
                textTransform: "uppercase",
                color: "rgba(71, 108, 154, 0.86)"
              }}
            >
              TL
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
