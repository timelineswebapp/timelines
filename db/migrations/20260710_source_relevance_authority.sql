CREATE TABLE IF NOT EXISTS source_relevance_diagnostics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  provider_record_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  discovery_query TEXT NOT NULL,
  assessment JSONB NOT NULL,
  repository_evidence JSONB NOT NULL,
  evaluated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_source_relevance_diagnostics_query_created
  ON source_relevance_diagnostics(discovery_query, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_relevance_diagnostics_assessment
  ON source_relevance_diagnostics USING GIN(assessment);

DROP TRIGGER IF EXISTS prevent_source_relevance_diagnostics_delete ON source_relevance_diagnostics;
CREATE TRIGGER prevent_source_relevance_diagnostics_delete
BEFORE DELETE ON source_relevance_diagnostics
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_delete();
