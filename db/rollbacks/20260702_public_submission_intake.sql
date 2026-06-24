DROP INDEX IF EXISTS idx_timeline_requests_type_date;

ALTER TABLE timeline_requests
  DROP CONSTRAINT IF EXISTS timeline_requests_request_type_check,
  DROP COLUMN IF EXISTS metadata,
  DROP COLUMN IF EXISTS sources_scope,
  DROP COLUMN IF EXISTS target_timeline,
  DROP COLUMN IF EXISTS message,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS request_type;
