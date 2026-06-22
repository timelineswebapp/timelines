CREATE TABLE IF NOT EXISTS factory_worker_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  worker_category TEXT NOT NULL CHECK (worker_category IN ('research', 'source', 'extraction', 'enrichment', 'assembly', 'validation')),
  allowed_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_object_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_relationship_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_key)
);

CREATE TABLE IF NOT EXISTS factory_worker_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  provider_policy JSONB NOT NULL,
  max_context_tokens INTEGER NOT NULL CHECK (max_context_tokens > 0),
  max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens > 0),
  retry_policy JSONB NOT NULL,
  execution_timeout INTEGER NOT NULL CHECK (execution_timeout > 0),
  audit_requirements JSONB NOT NULL,
  forbidden_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_worker_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  worker_version INTEGER NOT NULL CHECK (worker_version > 0),
  contract JSONB NOT NULL,
  policy_id UUID NOT NULL REFERENCES factory_worker_policies(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_key, worker_version)
);

CREATE TABLE IF NOT EXISTS factory_worker_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  worker_version_id UUID NOT NULL REFERENCES factory_worker_versions(id) ON DELETE RESTRICT,
  allowed_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_policy JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_version_id)
);

CREATE INDEX IF NOT EXISTS idx_factory_worker_capabilities_category ON factory_worker_capabilities(worker_category, status);
CREATE INDEX IF NOT EXISTS idx_factory_worker_policies_worker ON factory_worker_policies(worker_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_worker_versions_worker ON factory_worker_versions(worker_key, worker_version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_worker_permissions_worker ON factory_worker_permissions(worker_key, created_at DESC);

DROP TRIGGER IF EXISTS trigger_factory_worker_capabilities_updated_at ON factory_worker_capabilities;
CREATE TRIGGER trigger_factory_worker_capabilities_updated_at
BEFORE UPDATE ON factory_worker_capabilities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_worker_capabilities_delete ON factory_worker_capabilities;
CREATE TRIGGER prevent_factory_worker_capabilities_delete
BEFORE DELETE ON factory_worker_capabilities
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_policies_delete ON factory_worker_policies;
CREATE TRIGGER prevent_factory_worker_policies_delete
BEFORE DELETE ON factory_worker_policies
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_versions_delete ON factory_worker_versions;
CREATE TRIGGER prevent_factory_worker_versions_delete
BEFORE DELETE ON factory_worker_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_permissions_delete ON factory_worker_permissions;
CREATE TRIGGER prevent_factory_worker_permissions_delete
BEFORE DELETE ON factory_worker_permissions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
