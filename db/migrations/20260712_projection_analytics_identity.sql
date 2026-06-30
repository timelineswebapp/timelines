ALTER TABLE analytics_events
  ADD COLUMN IF NOT EXISTS published_projection_id UUID
  REFERENCES published_memory_projections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_analytics_events_projection_type_date
  ON analytics_events(published_projection_id, event_type, created_at DESC);
