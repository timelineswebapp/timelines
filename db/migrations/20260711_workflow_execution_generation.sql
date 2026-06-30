ALTER TABLE factory_topic_work_items
  ADD COLUMN IF NOT EXISTS execution_generation INTEGER NOT NULL DEFAULT 0
  CHECK (execution_generation >= 0);

CREATE INDEX IF NOT EXISTS idx_factory_topics_execution_owner
  ON factory_topic_work_items (id, execution_generation, current_stage, status, lease_owner);
