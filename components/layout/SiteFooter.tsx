export function SiteFooter() {
  return (
    <footer className="glass section-card" style={{ marginTop: 24 }}>
      <div className="stack">
        <strong>TiMELiNES</strong>
        <p className="muted" style={{ margin: 0 }}>
          Curated timelines with structured chronology, source tracking, and scalable editorial workflows.
        </p>
        <p className="small muted" style={{ margin: 0 }}>
          Built for Next.js 14, PostgreSQL, and incremental static regeneration.
        </p>
      </div>
    </footer>
  );
}
