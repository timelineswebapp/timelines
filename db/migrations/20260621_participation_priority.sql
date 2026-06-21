ALTER TABLE milestone_participations
ADD COLUMN IF NOT EXISTS participation_priority TEXT NOT NULL DEFAULT 'SUPPORTING'
CHECK (participation_priority IN ('PRIMARY', 'SUPPORTING', 'CONTEXT', 'BACKGROUND'));

UPDATE milestone_participations
SET participation_priority = 'SUPPORTING'
WHERE participation_priority IS NULL;

CREATE INDEX IF NOT EXISTS idx_milestone_participations_public_context
ON milestone_participations(milestone_id, authority_state, lifecycle_status, participation_priority);
