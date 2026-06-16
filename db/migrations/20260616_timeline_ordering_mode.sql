ALTER TABLE timelines
ADD COLUMN IF NOT EXISTS ordering_mode TEXT NOT NULL DEFAULT 'chronology'
CHECK (ordering_mode IN ('chronology', 'editorial'));
