CREATE TABLE IF NOT EXISTS published_memory_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  projection_type TEXT NOT NULL CHECK (
    projection_type IN ('timeline', 'milestone', 'historical_object', 'relationship', 'search', 'sitemap')
  ),
  slug TEXT,
  payload JSONB NOT NULL,
  projection_version INTEGER NOT NULL CHECK (projection_version > 0),
  projection_hash TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (
    lifecycle IN ('active', 'superseded', 'retired', 'merged', 'preserved')
  ),
  source_event_type TEXT NOT NULL CHECK (
    source_event_type IN ('admission', 'revision', 'retirement', 'merge', 'preservation', 'rebuild')
  ),
  source_event_id UUID NOT NULL,
  audit_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (published_snapshot_id, projection_type, projection_hash)
);

CREATE TABLE IF NOT EXISTS published_memory_projection_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID NOT NULL REFERENCES published_memory_projections(id) ON DELETE RESTRICT,
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  revision_id UUID REFERENCES historical_library_published_revisions(id) ON DELETE RESTRICT,
  retirement_id UUID REFERENCES historical_library_retirements(id) ON DELETE RESTRICT,
  merge_id UUID REFERENCES historical_library_merges(id) ON DELETE RESTRICT,
  preservation_id UUID REFERENCES historical_library_preservations(id) ON DELETE RESTRICT,
  projection_version INTEGER NOT NULL CHECK (projection_version > 0),
  projection_hash TEXT NOT NULL,
  audit_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS published_memory_continuity_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_snapshot_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  continuity_type TEXT NOT NULL CHECK (continuity_type IN ('retired', 'merged')),
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_event_id UUID NOT NULL,
  projection_hash TEXT NOT NULL,
  audit_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_published_snapshot_id, continuity_type, projection_hash)
);

CREATE INDEX IF NOT EXISTS idx_published_memory_projections_lookup
  ON published_memory_projections(projection_type, lifecycle, slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_memory_projection_lineage_snapshot
  ON published_memory_projection_lineage(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_memory_continuity_source
  ON published_memory_continuity_projections(source_published_snapshot_id, continuity_type);

DROP TRIGGER IF EXISTS prevent_published_memory_projections_delete ON published_memory_projections;
CREATE TRIGGER prevent_published_memory_projections_delete
BEFORE DELETE ON published_memory_projections
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_published_memory_projection_lineage_delete ON published_memory_projection_lineage;
CREATE TRIGGER prevent_published_memory_projection_lineage_delete
BEFORE DELETE ON published_memory_projection_lineage
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_published_memory_continuity_projections_delete ON published_memory_continuity_projections;
CREATE TRIGGER prevent_published_memory_continuity_projections_delete
BEFORE DELETE ON published_memory_continuity_projections
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
