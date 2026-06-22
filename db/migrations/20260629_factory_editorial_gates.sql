CREATE TABLE IF NOT EXISTS factory_editorial_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  lifecycle TEXT NOT NULL DEFAULT 'generated' CHECK (
    lifecycle IN (
      'generated',
      'validated',
      'under_editorial_review',
      'revision_required',
      'editorially_approved',
      'authority_prepared',
      'governance_ready',
      'preserved'
    )
  ),
  validation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  evidence_reviewed JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_reviewed JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewer TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_confidence_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editorial_review_id UUID NOT NULL REFERENCES factory_editorial_reviews(id) ON DELETE RESTRICT,
  confidence_level TEXT NOT NULL CHECK (confidence_level IN ('low', 'medium', 'high', 'verified')),
  confidence_score NUMERIC(5, 4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
  factors JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_editorial_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editorial_review_id UUID NOT NULL REFERENCES factory_editorial_reviews(id) ON DELETE RESTRICT,
  decision TEXT NOT NULL CHECK (decision IN ('validate', 'start_review', 'approve', 'require_revision', 'prepare_authority', 'assess_governance_ready', 'preserve')),
  reason TEXT NOT NULL,
  evidence_reviewed JSONB NOT NULL DEFAULT '[]'::jsonb,
  sources_reviewed JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  authority_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  decided_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_authority_preparations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  editorial_review_id UUID NOT NULL REFERENCES factory_editorial_reviews(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  canonical_identity_mapping JSONB NOT NULL,
  authority_references JSONB NOT NULL,
  source_traceability JSONB NOT NULL,
  evidence_traceability JSONB NOT NULL,
  revision_traceability JSONB NOT NULL,
  prepared_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_factory_editorial_reviews_package ON factory_editorial_reviews(factory_package_draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_editorial_reviews_lifecycle ON factory_editorial_reviews(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_editorial_decisions_review ON factory_editorial_decisions(editorial_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_confidence_assessments_review ON factory_confidence_assessments(editorial_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_authority_preparations_review ON factory_authority_preparations(editorial_review_id, created_at DESC);

DROP TRIGGER IF EXISTS trigger_factory_editorial_reviews_updated_at ON factory_editorial_reviews;
CREATE TRIGGER trigger_factory_editorial_reviews_updated_at
BEFORE UPDATE ON factory_editorial_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS prevent_factory_editorial_reviews_delete ON factory_editorial_reviews;
CREATE TRIGGER prevent_factory_editorial_reviews_delete
BEFORE DELETE ON factory_editorial_reviews
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_editorial_decisions_delete ON factory_editorial_decisions;
CREATE TRIGGER prevent_factory_editorial_decisions_delete
BEFORE DELETE ON factory_editorial_decisions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_confidence_assessments_delete ON factory_confidence_assessments;
CREATE TRIGGER prevent_factory_confidence_assessments_delete
BEFORE DELETE ON factory_confidence_assessments
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_authority_preparations_delete ON factory_authority_preparations;
CREATE TRIGGER prevent_factory_authority_preparations_delete
BEFORE DELETE ON factory_authority_preparations
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
