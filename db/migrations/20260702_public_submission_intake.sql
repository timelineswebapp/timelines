ALTER TABLE timeline_requests
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'timeline_request',
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT,
  ADD COLUMN IF NOT EXISTS target_timeline TEXT,
  ADD COLUMN IF NOT EXISTS sources_scope TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE timeline_requests
  DROP CONSTRAINT IF EXISTS timeline_requests_request_type_check;

ALTER TABLE timeline_requests
  ADD CONSTRAINT timeline_requests_request_type_check
  CHECK (request_type IN ('timeline_request', 'general_contact', 'timeline_proposal', 'timeline_correction'));

CREATE INDEX IF NOT EXISTS idx_timeline_requests_type_date
  ON timeline_requests(request_type, created_at DESC);
