DO $$
BEGIN
  IF to_regclass('public.published_memory_projections') IS NULL THEN
    RAISE EXCEPTION 'published_memory_projections must be created before projection_lifecycle_correction';
  END IF;

  IF to_regclass('public.historical_library_retirements') IS NULL THEN
    RAISE EXCEPTION 'historical_library_lifecycle must be created before projection_lifecycle_correction';
  END IF;
END $$;

ALTER TABLE published_memory_projections
  ADD COLUMN IF NOT EXISTS superseded_by_projection_id UUID REFERENCES published_memory_projections(id) ON DELETE RESTRICT;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY published_snapshot_id, projection_type
      ORDER BY created_at DESC, projection_version DESC, id DESC
    ) AS active_rank
  FROM published_memory_projections
  WHERE lifecycle = 'active'
)
UPDATE published_memory_projections
SET lifecycle = 'superseded'
FROM ranked
WHERE published_memory_projections.id = ranked.id
  AND ranked.active_rank > 1;

UPDATE published_memory_projections
SET lifecycle = 'retired'
WHERE published_snapshot_id IN (
  SELECT published_snapshot_id FROM historical_library_retirements
)
  AND lifecycle IN ('active', 'superseded');

UPDATE published_memory_projections
SET lifecycle = 'merged'
WHERE published_snapshot_id IN (
  SELECT source_published_record_id FROM historical_library_merges
)
  AND lifecycle IN ('active', 'superseded');

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_memory_projections_one_active
  ON published_memory_projections(published_snapshot_id, projection_type)
  WHERE lifecycle = 'active';

CREATE INDEX IF NOT EXISTS idx_published_memory_projections_superseded_by
  ON published_memory_projections(superseded_by_projection_id)
  WHERE superseded_by_projection_id IS NOT NULL;
