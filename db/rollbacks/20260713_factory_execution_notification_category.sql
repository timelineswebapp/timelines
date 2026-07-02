ALTER TABLE factory_operational_notifications
  DROP CONSTRAINT IF EXISTS factory_operational_notifications_category_check;

ALTER TABLE factory_operational_notifications
  ADD CONSTRAINT factory_operational_notifications_category_check
  CHECK (category IN (
    'editorial_review_required',
    'governance_approval_required',
    'evidence_problem',
    'publication_verification_failure',
    'failed_factory_run',
    'queue_warning',
    'replay_request'
  )) NOT VALID;
