CREATE TABLE IF NOT EXISTS operational_metric_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  unit TEXT NOT NULL,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  measured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operational_metrics_trend ON operational_metric_measurements(metric_key, measured_at DESC);

CREATE TABLE IF NOT EXISTS operational_health_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution TEXT NOT NULL CHECK (institution IN ('factory','governance','historical_library','published_memory','projection','platform_runtime')),
  status TEXT NOT NULL CHECK (status IN ('healthy','warning','critical')),
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operational_health_current ON operational_health_assessments(institution, assessed_at DESC);

CREATE TABLE IF NOT EXISTS operational_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key TEXT NOT NULL,
  topic_id UUID REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  institution TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('warning','critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  message TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  deduplication_key TEXT NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_alert_open_dedupe ON operational_alerts(deduplication_key) WHERE status <> 'resolved';
CREATE INDEX IF NOT EXISTS idx_operational_alert_inbox ON operational_alerts(status, severity, last_observed_at DESC);

CREATE TABLE IF NOT EXISTS operational_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES operational_alerts(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('opened','observed','acknowledged','resolved')),
  actor TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_operational_alert_history_alert ON operational_alert_history(alert_id, created_at);

CREATE TABLE IF NOT EXISTS operational_scheduled_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_key TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','completed','failed')),
  lease_owner TEXT NOT NULL,
  lease_expires_at TIMESTAMPTZ NOT NULL,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (operation_key, scheduled_for)
);
CREATE INDEX IF NOT EXISTS idx_operational_scheduled_runs_recovery ON operational_scheduled_runs(status, lease_expires_at);

CREATE TABLE IF NOT EXISTS operational_replay_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  workflow_id UUID NOT NULL,
  institution TEXT,
  certified_boundary TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested','running','completed','failed','rejected_duplicate')),
  requested_by TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_operational_replay_queue ON operational_replay_requests(status, created_at);

CREATE OR REPLACE FUNCTION prevent_operational_observation_delete() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Operational observation history is append-only.'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER prevent_operational_metrics_delete BEFORE DELETE ON operational_metric_measurements FOR EACH ROW EXECUTE FUNCTION prevent_operational_observation_delete();
CREATE TRIGGER prevent_operational_health_delete BEFORE DELETE ON operational_health_assessments FOR EACH ROW EXECUTE FUNCTION prevent_operational_observation_delete();
CREATE TRIGGER prevent_operational_alert_history_mutation BEFORE UPDATE OR DELETE ON operational_alert_history FOR EACH ROW EXECUTE FUNCTION prevent_operational_observation_delete();
CREATE TRIGGER prevent_operational_replay_delete BEFORE DELETE ON operational_replay_requests FOR EACH ROW EXECUTE FUNCTION prevent_operational_observation_delete();
