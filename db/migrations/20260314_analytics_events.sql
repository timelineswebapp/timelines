CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  timeline_id BIGINT REFERENCES timelines(id) ON DELETE SET NULL,
  slug TEXT,
  session_id TEXT,
  user_id TEXT,
  country TEXT,
  device TEXT,
  referrer TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date
  ON analytics_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_timeline_type_date
  ON analytics_events(timeline_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_events_slug_type_date
  ON analytics_events(slug, event_type, created_at DESC);
