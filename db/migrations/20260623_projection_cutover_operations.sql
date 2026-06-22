CREATE TABLE IF NOT EXISTS published_memory_projection_rebuild_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('completed', 'completed_with_failures', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  batch_size INTEGER NOT NULL CHECK (batch_size > 0),
  total_processed INTEGER NOT NULL CHECK (total_processed >= 0),
  generated INTEGER NOT NULL CHECK (generated >= 0),
  updated INTEGER NOT NULL CHECK (updated >= 0),
  unchanged INTEGER NOT NULL CHECK (unchanged >= 0),
  failed INTEGER NOT NULL CHECK (failed >= 0),
  skipped INTEGER NOT NULL CHECK (skipped >= 0),
  continuity_projection_count INTEGER NOT NULL CHECK (continuity_projection_count >= 0),
  coverage_summary JSONB NOT NULL,
  dto_validation_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  rebuild_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_memory_projection_rebuild_reports_created
  ON published_memory_projection_rebuild_reports(created_at DESC);

DROP TRIGGER IF EXISTS prevent_published_memory_projection_rebuild_reports_delete ON published_memory_projection_rebuild_reports;
CREATE TRIGGER prevent_published_memory_projection_rebuild_reports_delete
BEFORE DELETE ON published_memory_projection_rebuild_reports
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
