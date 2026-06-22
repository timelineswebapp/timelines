CREATE TABLE IF NOT EXISTS factory_runtime_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_provider_key TEXT NOT NULL DEFAULT 'qwen14',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  template TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_key, version)
);

CREATE TABLE IF NOT EXISTS factory_runtime_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES factory_runtime_workers(id) ON DELETE RESTRICT,
  prompt_id UUID NOT NULL REFERENCES factory_runtime_prompts(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL DEFAULT 'qwen14',
  model_name TEXT NOT NULL DEFAULT 'Qwen14',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 100),
  input JSONB NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES factory_runtime_jobs(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES factory_runtime_workers(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'started', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL,
  output JSONB,
  error JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ref JSONB NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_runtime_workers_status ON factory_runtime_workers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_prompts_key_version ON factory_runtime_prompts(prompt_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_jobs_status_priority ON factory_runtime_jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_executions_job ON factory_runtime_executions(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_audit_records_target ON factory_runtime_audit_records USING GIN(target_ref);

DROP TRIGGER IF EXISTS trigger_factory_runtime_workers_updated_at ON factory_runtime_workers;
CREATE TRIGGER trigger_factory_runtime_workers_updated_at
BEFORE UPDATE ON factory_runtime_workers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_runtime_jobs_updated_at ON factory_runtime_jobs;
CREATE TRIGGER trigger_factory_runtime_jobs_updated_at
BEFORE UPDATE ON factory_runtime_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_runtime_executions_updated_at ON factory_runtime_executions;
CREATE TRIGGER trigger_factory_runtime_executions_updated_at
BEFORE UPDATE ON factory_runtime_executions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_runtime_workers_delete ON factory_runtime_workers;
CREATE TRIGGER prevent_factory_runtime_workers_delete
BEFORE DELETE ON factory_runtime_workers
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_prompts_delete ON factory_runtime_prompts;
CREATE TRIGGER prevent_factory_runtime_prompts_delete
BEFORE DELETE ON factory_runtime_prompts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_jobs_delete ON factory_runtime_jobs;
CREATE TRIGGER prevent_factory_runtime_jobs_delete
BEFORE DELETE ON factory_runtime_jobs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_executions_delete ON factory_runtime_executions;
CREATE TRIGGER prevent_factory_runtime_executions_delete
BEFORE DELETE ON factory_runtime_executions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_audit_records_delete ON factory_runtime_audit_records;
CREATE TRIGGER prevent_factory_runtime_audit_records_delete
BEFORE DELETE ON factory_runtime_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
