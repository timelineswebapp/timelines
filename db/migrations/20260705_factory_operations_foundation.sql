CREATE TABLE IF NOT EXISTS factory_operations_control (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  mode TEXT NOT NULL CHECK (mode IN ('stopped','running','pause_after_current','paused')),
  concurrency INTEGER NOT NULL CHECK (concurrency BETWEEN 1 AND 16),
  poll_interval_ms INTEGER NOT NULL CHECK (poll_interval_ms BETWEEN 250 AND 60000),
  updated_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO factory_operations_control (singleton, mode, concurrency, poll_interval_ms, updated_by)
VALUES (TRUE, 'stopped', 1, 2000, 'migration')
ON CONFLICT (singleton) DO NOTHING;

CREATE TABLE IF NOT EXISTS factory_topic_work_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 240),
  source TEXT NOT NULL CHECK (source IN ('founder','public_request','automatic_discovery')),
  source_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued','running','waiting','paused','failed','dead_letter','cancelled','completed')),
  priority INTEGER NOT NULL DEFAULT 100 CHECK (priority BETWEEN 0 AND 1000),
  current_stage TEXT NOT NULL CHECK (current_stage IN ('queued','research','extraction','publication_candidate','founder_review','governance','library_admission','published','completed')),
  last_certified_stage TEXT NOT NULL CHECK (last_certified_stage IN ('queued','research','extraction','publication_candidate','founder_review','governance','library_admission','published','completed')),
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries BETWEEN 0 AND 20),
  workflow_id UUID NOT NULL DEFAULT gen_random_uuid(),
  lease_owner TEXT,
  lease_expires_at TIMESTAMPTZ,
  heartbeat_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  stage_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  CHECK ((lease_owner IS NULL) = (lease_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_factory_topic_dispatch
  ON factory_topic_work_items(status, next_attempt_at, priority DESC, created_at)
  WHERE status IN ('queued','failed','running');
CREATE INDEX IF NOT EXISTS idx_factory_topic_workflow ON factory_topic_work_items(workflow_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_topic_public_request
  ON factory_topic_work_items(source_reference) WHERE source = 'public_request' AND source_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS factory_topic_execution_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  from_stage TEXT,
  to_stage TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('started','succeeded','failed','waiting','control')),
  attempt INTEGER NOT NULL CHECK (attempt >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factory_topic_history ON factory_topic_execution_history(topic_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_factory_topic_history_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Factory topic execution history is immutable.'; END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS prevent_factory_topic_history_update ON factory_topic_execution_history;
CREATE TRIGGER prevent_factory_topic_history_update BEFORE UPDATE OR DELETE ON factory_topic_execution_history
FOR EACH ROW EXECUTE FUNCTION prevent_factory_topic_history_mutation();
