CREATE TABLE IF NOT EXISTS timeline_slug_history (
  id BIGSERIAL PRIMARY KEY,
  timeline_id BIGINT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_slug_history_timeline_id
  ON timeline_slug_history(timeline_id, created_at DESC);
