DROP INDEX IF EXISTS idx_analytics_events_projection_type_date;
ALTER TABLE analytics_events DROP COLUMN IF EXISTS published_projection_id;
