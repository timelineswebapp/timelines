import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="glass section-card" style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap"
        }}
      >
        <Link href="/" className="eyebrow">
          TiMELiNES
        </Link>
        <p className="small muted" style={{ margin: 0 }}>
          Follow history through the timeline.
        </p>
      </div>
    </header>
  );
}
