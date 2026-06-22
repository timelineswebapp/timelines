CREATE TABLE IF NOT EXISTS historical_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_authority_ref JSONB NOT NULL,
  target_authority_ref JSONB NOT NULL,
  relationship_type TEXT NOT NULL CHECK (
    relationship_type IN ('influences', 'influenced_by', 'member_of', 'contains', 'located_in', 'succeeds', 'preceded_by', 'owns', 'owned_by', 'related_to')
  ),
  summary TEXT NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle_status TEXT NOT NULL DEFAULT 'established' CHECK (
    lifecycle_status IN ('established', 'revised', 'disputed', 'merged', 'retired', 'preserved')
  ),
  authority_state TEXT NOT NULL DEFAULT 'active' CHECK (authority_state IN ('active', 'inactive')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  merged_into_id UUID REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  dispute_reason TEXT,
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

CREATE TABLE IF NOT EXISTS historical_relationship_revisions (
  id BIGSERIAL PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  action TEXT NOT NULL CHECK (action IN ('create', 'revise', 'dispute', 'merge', 'retire', 'preserve')),
  before_state JSONB,
  after_state JSONB NOT NULL,
  reason TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (relationship_id, revision)
);

CREATE TABLE IF NOT EXISTS historical_relationship_merges (
  id BIGSERIAL PRIMARY KEY,
  source_relationship_id UUID NOT NULL REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  target_relationship_id UUID NOT NULL REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_relationship_id IS DISTINCT FROM target_relationship_id)
);

CREATE TABLE IF NOT EXISTS historical_relationship_retirements (
  id BIGSERIAL PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_relationship_disputes (
  id BIGSERIAL PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES historical_relationships(id) ON DELETE RESTRICT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'rejected')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_relationships_type_status
  ON historical_relationships(relationship_type, lifecycle_status);

CREATE INDEX IF NOT EXISTS idx_historical_relationships_source
  ON historical_relationships USING GIN(source_authority_ref);

CREATE INDEX IF NOT EXISTS idx_historical_relationships_target
  ON historical_relationships USING GIN(target_authority_ref);

CREATE INDEX IF NOT EXISTS idx_historical_relationship_revisions_relationship
  ON historical_relationship_revisions(relationship_id, revision DESC);

CREATE INDEX IF NOT EXISTS idx_historical_relationship_merges_source
  ON historical_relationship_merges(source_relationship_id);

CREATE INDEX IF NOT EXISTS idx_historical_relationship_retirements_relationship
  ON historical_relationship_retirements(relationship_id, created_at DESC);

DROP TRIGGER IF EXISTS set_historical_relationships_updated_at ON historical_relationships;
CREATE TRIGGER set_historical_relationships_updated_at
BEFORE UPDATE ON historical_relationships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_historical_relationships_delete ON historical_relationships;
CREATE TRIGGER prevent_historical_relationships_delete
BEFORE DELETE ON historical_relationships
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_relationship_revisions_delete ON historical_relationship_revisions;
CREATE TRIGGER prevent_historical_relationship_revisions_delete
BEFORE DELETE ON historical_relationship_revisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_relationship_merges_delete ON historical_relationship_merges;
CREATE TRIGGER prevent_historical_relationship_merges_delete
BEFORE DELETE ON historical_relationship_merges
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_relationship_retirements_delete ON historical_relationship_retirements;
CREATE TRIGGER prevent_historical_relationship_retirements_delete
BEFORE DELETE ON historical_relationship_retirements
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_historical_relationship_disputes_delete ON historical_relationship_disputes;
CREATE TRIGGER prevent_historical_relationship_disputes_delete
BEFORE DELETE ON historical_relationship_disputes
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();
