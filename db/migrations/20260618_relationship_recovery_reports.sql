CREATE TABLE IF NOT EXISTS relationship_recovery_reports (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('preview', 'apply')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_rows INTEGER NOT NULL DEFAULT 0,
  unmatched_rows INTEGER NOT NULL DEFAULT 0,
  ambiguous_rows INTEGER NOT NULL DEFAULT 0,
  tag_links_pending INTEGER NOT NULL DEFAULT 0,
  source_links_pending INTEGER NOT NULL DEFAULT 0,
  inserted_tag_links INTEGER NOT NULL DEFAULT 0,
  inserted_source_links INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_relationship_recovery_reports_generated_at
  ON relationship_recovery_reports(generated_at DESC);
