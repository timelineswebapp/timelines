CREATE TABLE IF NOT EXISTS factory_institutional_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  workflow_id UUID NOT NULL,
  institution TEXT NOT NULL CHECK (institution IN ('factory','governance','historical_library','published_memory','projection','verification')),
  event_type TEXT NOT NULL,
  boundary_stage TEXT NOT NULL,
  authority_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factory_institutional_events_topic ON factory_institutional_events(topic_id, created_at DESC);

CREATE TABLE IF NOT EXISTS factory_operational_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  category TEXT NOT NULL CHECK (category IN ('editorial_review_required','governance_approval_required','evidence_problem','publication_verification_failure','failed_factory_run','queue_warning','replay_request')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  deduplication_key TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (deduplication_key, status)
);
CREATE INDEX IF NOT EXISTS idx_factory_notifications_inbox ON factory_operational_notifications(status, severity, created_at DESC);

CREATE TABLE IF NOT EXISTS factory_publication_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES factory_topic_work_items(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL,
  checks JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed','failed')),
  failure_details JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_factory_verifications_topic ON factory_publication_verifications(topic_id, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_factory_continuation_history_mutation() RETURNS TRIGGER AS $$
BEGIN RAISE EXCEPTION 'Institutional events and publication verifications are immutable.'; END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER prevent_factory_institutional_events_mutation BEFORE UPDATE OR DELETE ON factory_institutional_events
FOR EACH ROW EXECUTE FUNCTION prevent_factory_continuation_history_mutation();
CREATE TRIGGER prevent_factory_publication_verifications_mutation BEFORE UPDATE OR DELETE ON factory_publication_verifications
FOR EACH ROW EXECUTE FUNCTION prevent_factory_continuation_history_mutation();
