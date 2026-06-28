CREATE INDEX IF NOT EXISTS idx_published_memory_search_fts
  ON published_memory_projections USING GIN (
    to_tsvector('simple'::regconfig, COALESCE(payload->>'searchableText', payload::text))
  )
  WHERE projection_type='search' AND lifecycle='active';

CREATE INDEX IF NOT EXISTS idx_published_memory_search_trigram
  ON published_memory_projections USING GIN (
    LOWER(COALESCE(payload->>'searchableText', payload::text)) gin_trgm_ops
  )
  WHERE projection_type='search' AND lifecycle='active';

CREATE INDEX IF NOT EXISTS idx_published_memory_milestone_payload_id
  ON published_memory_projections (((payload->>'id')::bigint))
  WHERE projection_type='milestone' AND lifecycle='active' AND payload ? 'id';

CREATE INDEX IF NOT EXISTS idx_factory_topic_fair_dispatch
  ON factory_topic_work_items(status, next_attempt_at, priority DESC, created_at)
  WHERE status IN ('queued','failed');

CREATE TABLE IF NOT EXISTS provider_execution_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed','failed','throttled')),
  latency_ms INTEGER NOT NULL CHECK (latency_ms >= 0),
  estimated_input_tokens INTEGER NOT NULL DEFAULT 0 CHECK (estimated_input_tokens >= 0),
  max_output_tokens INTEGER,
  estimated_cost_usd NUMERIC(14,6) NOT NULL DEFAULT 0 CHECK (estimated_cost_usd >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_provider_execution_metrics_trend ON provider_execution_metrics(provider_key, created_at DESC);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
