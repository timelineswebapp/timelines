DROP TRIGGER IF EXISTS prevent_factory_topic_history_update ON factory_topic_execution_history;
DROP FUNCTION IF EXISTS prevent_factory_topic_history_mutation();
DROP TABLE IF EXISTS factory_topic_execution_history;
DROP TABLE IF EXISTS factory_topic_work_items;
DROP TABLE IF EXISTS factory_operations_control;
