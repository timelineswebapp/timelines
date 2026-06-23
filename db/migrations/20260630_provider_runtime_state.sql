CREATE TABLE IF NOT EXISTS provider_runtime_state (
  provider TEXT PRIMARY KEY CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  cooldown_until TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  failure_count BIGINT NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  success_count BIGINT NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  recovery_count BIGINT NOT NULL DEFAULT 0 CHECK (recovery_count >= 0),
  last_recovered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (last_failure_reason IS NULL OR length(last_failure_reason) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_provider_runtime_state_cooldown
  ON provider_runtime_state(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_runtime_state_updated
  ON provider_runtime_state(updated_at DESC);
