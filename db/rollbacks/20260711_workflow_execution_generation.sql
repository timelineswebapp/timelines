DROP INDEX IF EXISTS idx_factory_topics_execution_owner;
ALTER TABLE factory_topic_work_items DROP COLUMN IF EXISTS execution_generation;
