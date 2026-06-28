CREATE TABLE IF NOT EXISTS provider_execution_limits (
  provider_key TEXT PRIMARY KEY,
  max_concurrency INTEGER NOT NULL CHECK (max_concurrency BETWEEN 1 AND 64),
  requests_per_minute INTEGER NOT NULL CHECK (requests_per_minute BETWEEN 1 AND 10000),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO provider_execution_limits (provider_key,max_concurrency,requests_per_minute)
VALUES ('qwen14',2,30) ON CONFLICT (provider_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS provider_execution_leases (
  id UUID PRIMARY KEY,
  provider_key TEXT NOT NULL REFERENCES provider_execution_limits(provider_key) ON DELETE RESTRICT,
  owner_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_execution_leases_active ON provider_execution_leases(provider_key,expires_at);

CREATE TABLE IF NOT EXISTS provider_rate_limit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL REFERENCES provider_execution_limits(provider_key) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_rate_limit_window ON provider_rate_limit_events(provider_key,occurred_at DESC);
