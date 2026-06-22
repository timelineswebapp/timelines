CREATE TABLE IF NOT EXISTS factory_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  worker_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_run_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_factory_pipeline_runs_status ON factory_pipeline_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_pipeline_steps_run ON factory_pipeline_steps(pipeline_run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_factory_pipeline_steps_worker ON factory_pipeline_steps(worker_key, status);

DROP TRIGGER IF EXISTS trigger_factory_pipeline_runs_updated_at ON factory_pipeline_runs;
CREATE TRIGGER trigger_factory_pipeline_runs_updated_at
BEFORE UPDATE ON factory_pipeline_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_pipeline_steps_updated_at ON factory_pipeline_steps;
CREATE TRIGGER trigger_factory_pipeline_steps_updated_at
BEFORE UPDATE ON factory_pipeline_steps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_pipeline_runs_delete ON factory_pipeline_runs;
CREATE TRIGGER prevent_factory_pipeline_runs_delete
BEFORE DELETE ON factory_pipeline_runs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_pipeline_steps_delete ON factory_pipeline_steps;
CREATE TRIGGER prevent_factory_pipeline_steps_delete
BEFORE DELETE ON factory_pipeline_steps
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
