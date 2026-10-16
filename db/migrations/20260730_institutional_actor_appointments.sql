CREATE TABLE IF NOT EXISTS institutional_actor_appointments (
  id UUID PRIMARY KEY,
  principal_id TEXT NOT NULL,
  institution_id TEXT NOT NULL,
  constitutional_role TEXT NOT NULL CHECK (constitutional_role IN ('factory_editor','governance_reviewer','senior_governance_reviewer','library_editor','registry_operator','auditor')),
  action_scopes TEXT[] NOT NULL CHECK (cardinality(action_scopes) > 0),
  authorization_version INTEGER NOT NULL CHECK (authorization_version > 0),
  status TEXT NOT NULL CHECK (status IN ('active','revoked')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  audit_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'active' AND revoked_at IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS institutional_actor_appointments_active_principal_scope
  ON institutional_actor_appointments(principal_id, institution_id, constitutional_role, authorization_version)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS institutional_actor_appointments_resolution
  ON institutional_actor_appointments(principal_id, status, valid_from, valid_until);
CREATE OR REPLACE FUNCTION prevent_institutional_actor_appointment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Institutional appointments are immutable; create a new version or revocation record.'; END; $$;
DROP TRIGGER IF EXISTS prevent_institutional_actor_appointment_mutation ON institutional_actor_appointments;
CREATE TRIGGER prevent_institutional_actor_appointment_mutation BEFORE UPDATE OR DELETE ON institutional_actor_appointments FOR EACH ROW EXECUTE FUNCTION prevent_institutional_actor_appointment_mutation();
