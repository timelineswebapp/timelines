CREATE TABLE IF NOT EXISTS source_authority_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  provider_record_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,
  origin JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_record_id)
);

CREATE TABLE IF NOT EXISTS source_authority_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  retrieval_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_text TEXT NOT NULL,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL,
  retrieved_by TEXT NOT NULL DEFAULT 'system',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_record_id, version)
);

CREATE INDEX IF NOT EXISTS idx_source_authority_records_provider_created
  ON source_authority_records(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_authority_records_origin
  ON source_authority_records USING GIN(origin);

CREATE INDEX IF NOT EXISTS idx_source_authority_snapshots_source_version
  ON source_authority_snapshots(source_record_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_source_authority_snapshots_provenance
  ON source_authority_snapshots USING GIN(provenance);

CREATE OR REPLACE FUNCTION prevent_source_authority_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Source Authority records are preserved and cannot be deleted from %. Create a new version instead.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_source_authority_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Source Authority snapshots are immutable. Retrieve a new snapshot version instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_source_authority_records_delete ON source_authority_records;
CREATE TRIGGER prevent_source_authority_records_delete
BEFORE DELETE ON source_authority_records
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_delete();

DROP TRIGGER IF EXISTS prevent_source_authority_snapshots_delete ON source_authority_snapshots;
CREATE TRIGGER prevent_source_authority_snapshots_delete
BEFORE DELETE ON source_authority_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_delete();

DROP TRIGGER IF EXISTS prevent_source_authority_snapshots_update ON source_authority_snapshots;
CREATE TRIGGER prevent_source_authority_snapshots_update
BEFORE UPDATE ON source_authority_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_snapshot_update();
