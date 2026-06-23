CREATE TABLE IF NOT EXISTS admin_security_audit_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (
    event_type IN (
      'admin_auth_failed',
      'admin_auth_succeeded',
      'admin_csrf_rejected',
      'admin_rbac_rejected',
      'admin_request_failed',
      'admin_security_violation',
      'admin_session_revoked'
    )
  ),
  operator_id TEXT,
  auth_method TEXT,
  roles TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  method TEXT NOT NULL,
  pathname TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_security_audit_events_occurred
  ON admin_security_audit_events(occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_security_audit_events_type_occurred
  ON admin_security_audit_events(event_type, occurred_at DESC);

CREATE TABLE IF NOT EXISTS admin_session_revocations (
  session_id TEXT PRIMARY KEY,
  operator_id TEXT,
  reason TEXT,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_session_revocations_revoked
  ON admin_session_revocations(revoked_at DESC);
