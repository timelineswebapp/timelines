CREATE TABLE IF NOT EXISTS corpus_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id UUID NOT NULL UNIQUE REFERENCES source_authority_snapshots(id) ON DELETE RESTRICT,
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_lineage JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_document_id UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE RESTRICT,
  source_snapshot_id UUID NOT NULL REFERENCES source_authority_snapshots(id) ON DELETE RESTRICT,
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  retrieval_timestamp TIMESTAMPTZ NOT NULL,
  span_start INTEGER NOT NULL CHECK (span_start >= 0),
  span_end INTEGER NOT NULL CHECK (span_end > span_start),
  quote_text TEXT NOT NULL,
  normalized_claim TEXT NOT NULL,
  provenance JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (corpus_document_id, span_start, span_end, quote_text)
);

CREATE INDEX IF NOT EXISTS idx_corpus_documents_source_record
  ON corpus_documents(source_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_corpus_documents_lineage
  ON corpus_documents USING GIN(source_lineage);

CREATE INDEX IF NOT EXISTS idx_evidence_records_corpus
  ON evidence_records(corpus_document_id, span_start);

CREATE INDEX IF NOT EXISTS idx_evidence_records_source_snapshot
  ON evidence_records(source_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_source_record
  ON evidence_records(source_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_provenance
  ON evidence_records USING GIN(provenance);

CREATE OR REPLACE FUNCTION prevent_research_corpus_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Research corpus and evidence records are preserved and cannot be deleted from %.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_research_corpus_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Research corpus and evidence records are immutable. Create a new source snapshot, corpus document, or evidence record instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_corpus_documents_delete ON corpus_documents;
CREATE TRIGGER prevent_corpus_documents_delete
BEFORE DELETE ON corpus_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_delete();

DROP TRIGGER IF EXISTS prevent_evidence_records_delete ON evidence_records;
CREATE TRIGGER prevent_evidence_records_delete
BEFORE DELETE ON evidence_records
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_delete();

DROP TRIGGER IF EXISTS prevent_corpus_documents_update ON corpus_documents;
CREATE TRIGGER prevent_corpus_documents_update
BEFORE UPDATE ON corpus_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_update();

DROP TRIGGER IF EXISTS prevent_evidence_records_update ON evidence_records;
CREATE TRIGGER prevent_evidence_records_update
BEFORE UPDATE ON evidence_records
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_update();
