CREATE TABLE IF NOT EXISTS historical_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  canonical_slug TEXT NOT NULL UNIQUE,
  primary_type TEXT NOT NULL CHECK (
    primary_type IN ('person', 'institution', 'place', 'technology', 'publication', 'conflict', 'movement', 'period')
  ),
  lifecycle_status TEXT NOT NULL DEFAULT 'established' CHECK (
    lifecycle_status IN ('established', 'revised', 'merged', 'retired', 'preserved')
  ),
  authority_state TEXT NOT NULL DEFAULT 'active' CHECK (authority_state IN ('active', 'inactive')),
  description TEXT NOT NULL DEFAULT '',
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  merged_into_id UUID REFERENCES historical_objects(id) ON DELETE RESTRICT,
  retirement_reason TEXT,
  preservation_reason TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id IS DISTINCT FROM merged_into_id),
  CHECK (
    (lifecycle_status = 'merged' AND merged_into_id IS NOT NULL AND authority_state = 'inactive')
    OR lifecycle_status <> 'merged'
  ),
  CHECK (
    (lifecycle_status = 'retired' AND authority_state = 'inactive')
    OR lifecycle_status <> 'retired'
  )
);

CREATE TABLE IF NOT EXISTS historical_object_aliases (
  id BIGSERIAL PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL UNIQUE,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_object_revisions (
  id BIGSERIAL PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('create', 'revise', 'merge', 'retire', 'preserve')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (object_id, revision)
);

CREATE TABLE IF NOT EXISTS historical_object_merges (
  id BIGSERIAL PRIMARY KEY,
  source_object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  target_object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_object_id IS DISTINCT FROM target_object_id)
);

CREATE TABLE IF NOT EXISTS historical_object_retirements (
  id BIGSERIAL PRIMARY KEY,
  object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestone_participations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  historical_object_id UUID NOT NULL REFERENCES historical_objects(id) ON DELETE RESTRICT,
  milestone_id BIGINT NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
  role TEXT NOT NULL,
  summary TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'established' CHECK (
    lifecycle_status IN ('established', 'revised', 'disputed', 'retired', 'preserved')
  ),
  authority_state TEXT NOT NULL DEFAULT 'active' CHECK (authority_state IN ('active', 'inactive')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  dispute_reason TEXT,
  retirement_reason TEXT,
  preservation_reason TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (historical_object_id, milestone_id, role),
  CHECK (
    (lifecycle_status = 'retired' AND authority_state = 'inactive')
    OR lifecycle_status <> 'retired'
  )
);

CREATE TABLE IF NOT EXISTS milestone_participation_revisions (
  id BIGSERIAL PRIMARY KEY,
  participation_id UUID NOT NULL REFERENCES milestone_participations(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('create', 'revise', 'dispute', 'retire', 'preserve', 'object_merge')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (participation_id, revision)
);

CREATE TABLE IF NOT EXISTS milestone_participation_disputes (
  id BIGSERIAL PRIMARY KEY,
  participation_id UUID NOT NULL REFERENCES milestone_participations(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_objects_type_status ON historical_objects(primary_type, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_historical_object_aliases_object_id ON historical_object_aliases(object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_revisions_object_id ON historical_object_revisions(object_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_historical_object_merges_source ON historical_object_merges(source_object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_merges_target ON historical_object_merges(target_object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_retirements_object ON historical_object_retirements(object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_participations_object ON milestone_participations(historical_object_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_milestone_participations_milestone ON milestone_participations(milestone_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_milestone_participation_revisions_participation ON milestone_participation_revisions(participation_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_participation_disputes_participation ON milestone_participation_disputes(participation_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_historical_objects_updated_at ON historical_objects;
CREATE TRIGGER trigger_historical_objects_updated_at
BEFORE UPDATE ON historical_objects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_milestone_participations_updated_at ON milestone_participations;
CREATE TRIGGER trigger_milestone_participations_updated_at
BEFORE UPDATE ON milestone_participations
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION prevent_historical_authority_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Historical authority records are preserved and cannot be deleted from %. Use retirement or merge workflows.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_historical_objects_delete ON historical_objects;
CREATE TRIGGER prevent_historical_objects_delete
BEFORE DELETE ON historical_objects
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_object_aliases_delete ON historical_object_aliases;
CREATE TRIGGER prevent_historical_object_aliases_delete
BEFORE DELETE ON historical_object_aliases
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_object_revisions_delete ON historical_object_revisions;
CREATE TRIGGER prevent_historical_object_revisions_delete
BEFORE DELETE ON historical_object_revisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_object_merges_delete ON historical_object_merges;
CREATE TRIGGER prevent_historical_object_merges_delete
BEFORE DELETE ON historical_object_merges
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_object_retirements_delete ON historical_object_retirements;
CREATE TRIGGER prevent_historical_object_retirements_delete
BEFORE DELETE ON historical_object_retirements
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_milestone_participations_delete ON milestone_participations;
CREATE TRIGGER prevent_milestone_participations_delete
BEFORE DELETE ON milestone_participations
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_milestone_participation_revisions_delete ON milestone_participation_revisions;
CREATE TRIGGER prevent_milestone_participation_revisions_delete
BEFORE DELETE ON milestone_participation_revisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_milestone_participation_disputes_delete ON milestone_participation_disputes;
CREATE TRIGGER prevent_milestone_participation_disputes_delete
BEFORE DELETE ON milestone_participation_disputes
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();
