CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS timelines (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  ordering_mode TEXT NOT NULL DEFAULT 'chronology' CHECK (ordering_mode IN ('chronology', 'editorial')),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  date_precision TEXT NOT NULL CHECK (date_precision IN ('year', 'month', 'day', 'approximate')),
  sort_year INTEGER,
  sort_month SMALLINT,
  sort_day SMALLINT,
  display_date TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  importance INTEGER NOT NULL CHECK (importance BETWEEN 1 AND 5),
  location TEXT,
  image_url TEXT,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_events (
  timeline_id BIGINT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  event_order INTEGER NOT NULL,
  PRIMARY KEY (timeline_id, event_id),
  UNIQUE (timeline_id, event_order)
);

CREATE TABLE IF NOT EXISTS sources (
  id BIGSERIAL PRIMARY KEY,
  publisher TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  credibility_score NUMERIC(4, 2) NOT NULL CHECK (credibility_score BETWEEN 0 AND 1)
);

CREATE TABLE IF NOT EXISTS event_sources (
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, source_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS taxonomy_categories (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  canonical_slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  display_order INTEGER NOT NULL DEFAULT 1000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'merged', 'deprecated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxonomy_category_aliases (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxonomy_category_redirects (
  id BIGSERIAL PRIMARY KEY,
  source_slug TEXT NOT NULL UNIQUE,
  target_category_id BIGINT NOT NULL REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS taxonomy_category_merges (
  id BIGSERIAL PRIMARY KEY,
  source_category_id BIGINT REFERENCES taxonomy_categories(id) ON DELETE SET NULL,
  target_category_id BIGINT NOT NULL REFERENCES taxonomy_categories(id) ON DELETE CASCADE,
  source_slug TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_governance (
  tag_id BIGINT PRIMARY KEY REFERENCES tags(id) ON DELETE CASCADE,
  moderation_status TEXT NOT NULL DEFAULT 'unreviewed' CHECK (moderation_status IN ('unreviewed', 'approved', 'needs_review', 'deprecated', 'promote_to_concept')),
  usage_count INTEGER NOT NULL DEFAULT 0,
  duplicate_candidate_of BIGINT REFERENCES tags(id) ON DELETE SET NULL,
  promotion_candidate BOOLEAN NOT NULL DEFAULT FALSE,
  governance_notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_aliases (
  id BIGSERIAL PRIMARY KEY,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  alias_slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_redirects (
  id BIGSERIAL PRIMARY KEY,
  source_slug TEXT NOT NULL UNIQUE,
  target_tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tag_merges (
  id BIGSERIAL PRIMARY KEY,
  source_tag_id BIGINT REFERENCES tags(id) ON DELETE SET NULL,
  target_tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  source_slug TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS event_tags (
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, tag_id)
);

CREATE TABLE IF NOT EXISTS timeline_requests (
  id BIGSERIAL PRIMARY KEY,
  query TEXT NOT NULL,
  normalized_query TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  language TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK (request_type IN ('timeline_request', 'general_contact', 'timeline_proposal', 'timeline_correction')) DEFAULT 'timeline_request',
  email TEXT,
  message TEXT,
  target_timeline TEXT,
  sources_scope TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'planned', 'rejected', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timeline_slug_history (
  id BIGSERIAL PRIMARY KEY,
  timeline_id BIGINT NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  timeline_id BIGINT REFERENCES timelines(id) ON DELETE SET NULL,
  slug TEXT,
  session_id TEXT,
  user_id TEXT,
  country TEXT,
  device TEXT,
  referrer TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationship_recovery_reports (
  id BIGSERIAL PRIMARY KEY,
  mode TEXT NOT NULL DEFAULT 'preview' CHECK (mode IN ('preview', 'apply')),
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  matched_rows INTEGER NOT NULL DEFAULT 0,
  unmatched_rows INTEGER NOT NULL DEFAULT 0,
  ambiguous_rows INTEGER NOT NULL DEFAULT 0,
  tag_links_pending INTEGER NOT NULL DEFAULT 0,
  source_links_pending INTEGER NOT NULL DEFAULT 0,
  inserted_tag_links INTEGER NOT NULL DEFAULT 0,
  inserted_source_links INTEGER NOT NULL DEFAULT 0,
  report JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id BIGSERIAL PRIMARY KEY,
  slot TEXT NOT NULL CHECK (slot IN ('home_feed_ad', 'timeline_inline_1', 'timeline_inline_2', 'timeline_bottom', 'search_bottom')),
  campaign_name TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  creative_image TEXT,
  headline TEXT NOT NULL,
  description TEXT NOT NULL,
  cta TEXT NOT NULL,
  target_url TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
  participation_priority TEXT NOT NULL DEFAULT 'SUPPORTING' CHECK (
    participation_priority IN ('PRIMARY', 'SUPPORTING', 'CONTEXT', 'BACKGROUND')
  ),
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

CREATE TABLE IF NOT EXISTS governance_decisions (
  id UUID PRIMARY KEY,
  decision_type TEXT NOT NULL CHECK (
    decision_type IN (
      'ADMIT_HISTORICAL_OBJECT',
      'REVISE_HISTORICAL_OBJECT',
      'MERGE_HISTORICAL_OBJECT',
      'RETIRE_HISTORICAL_OBJECT',
      'PRESERVE_HISTORICAL_OBJECT',
      'ADMIT_PARTICIPATION',
      'REVISE_PARTICIPATION',
      'CHANGE_PARTICIPATION_PRIORITY',
      'RETIRE_PARTICIPATION',
      'CERTIFY_PUBLICATION_READINESS',
      'ACCEPT_PUBLICATION_PACKAGE',
      'REJECT_PUBLICATION_PACKAGE',
      'RETURN_PUBLICATION_PACKAGE',
      'CREATE_FEEDBACK_PACKAGE',
      'CLOSE_FEEDBACK_PACKAGE',
      'OPEN_DISPUTE',
      'RESOLVE_DISPUTE',
      'ESCALATE_AUTHORITY_REVIEW'
    )
  ),
  target_authority JSONB NOT NULL,
  actor JSONB NOT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  rationale JSONB NOT NULL,
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  escalation_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'rejected', 'returned_for_revision', 'escalated', 'superseded', 'no_action')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('draft', 'submitted', 'under_review', 'approval_pending', 'approved', 'rejected', 'returned_for_revision', 'escalated', 'superseded', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_approvals (
  id UUID PRIMARY KEY,
  decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  request JSONB NOT NULL,
  steps JSONB NOT NULL,
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('requested', 'pending', 'partially_approved', 'approved', 'rejected', 'returned_for_revision', 'escalated', 'expired', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_queues (
  id UUID PRIMARY KEY,
  queue_type TEXT NOT NULL CHECK (
    queue_type IN (
      'object_intake',
      'object_validation',
      'participation_intake',
      'participation_priority_review',
      'publication_readiness',
      'library_review',
      'feedback_return',
      'dispute_triage',
      'escalation_review',
      'audit_review'
    )
  ),
  owner_service TEXT NOT NULL CHECK (owner_service IN ('factory', 'governance', 'historical_library', 'registry', 'platform')),
  owner_role TEXT NOT NULL CHECK (
    owner_role IN ('factory_editor', 'governance_reviewer', 'senior_governance_reviewer', 'library_editor', 'registry_operator', 'auditor')
  ),
  target_authority JSONB NOT NULL,
  allowed_actions JSONB NOT NULL,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL CHECK (lifecycle IN ('entered', 'in_review', 'blocked', 'exited', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS governance_publication_packages (
  id UUID PRIMARY KEY,
  scope JSONB NOT NULL,
  included_authority JSONB NOT NULL,
  canonical_authority JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_summary JSONB NOT NULL,
  readiness_certification JSONB,
  acceptance_outcome TEXT CHECK (acceptance_outcome IN ('accepted', 'rejected', 'returned_for_revision', 'accepted_with_notes')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN (
      'factory_draft',
      'factory_validating',
      'factory_ready',
      'governance_review',
      'readiness_certified',
      'library_review',
      'accepted',
      'rejected',
      'returned_for_revision',
      'published',
      'preserved'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  factory_package_version_id UUID UNIQUE,
  factory_package_draft_id UUID,
  factory_lineage_root_id UUID,
  submitted_by JSONB,
  submitted_at TIMESTAMPTZ,
  submission_audit_record_id UUID
);

CREATE TABLE IF NOT EXISTS governance_feedback_packages (
  id UUID PRIMARY KEY,
  origin JSONB NOT NULL,
  affected_authority JSONB NOT NULL,
  correction_class TEXT NOT NULL CHECK (
    correction_class IN ('authority_error', 'missing_context', 'participation_error', 'priority_error', 'source_gap', 'publication_quality_issue', 'audit_gap')
  ),
  evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  required_response TEXT NOT NULL CHECK (
    required_response IN ('factory_acknowledgement', 'factory_revision', 'governance_review', 'new_publication_package', 'no_action_required')
  ),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'blocking')),
  closure_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('created', 'delivered_to_factory', 'acknowledged', 'factory_reviewing', 'action_required', 'informational', 'resolved', 'closed', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_disputes (
  id UUID PRIMARY KEY,
  target_authority JSONB NOT NULL,
  dispute_class TEXT NOT NULL CHECK (
    dispute_class IN (
      'identity_conflict',
      'chronology_conflict',
      'participation_conflict',
      'priority_conflict',
      'source_conflict',
      'publication_conflict',
      'governance_process_conflict'
    )
  ),
  evidence_bundle JSONB NOT NULL DEFAULT '[]'::jsonb,
  severity TEXT NOT NULL CHECK (severity IN ('minor', 'material', 'high', 'blocking')),
  resolution_path TEXT NOT NULL CHECK (resolution_path IN ('standard_review', 'senior_review', 'library_review', 'factory_revision', 'audit_review')),
  outcome TEXT CHECK (outcome IN ('upheld', 'rejected', 'amended', 'merged', 'retired', 'returned_for_revision')),
  lifecycle TEXT NOT NULL CHECK (
    lifecycle IN ('raised', 'triaged', 'evidence_gathering', 'review_pending', 'escalated', 'resolved_upheld', 'resolved_rejected', 'resolved_amended', 'closed', 'preserved')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS governance_audit_records (
  id UUID PRIMARY KEY,
  authority_ref JSONB NOT NULL,
  decision_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  dispute_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_state TEXT NOT NULL,
  reconstruction JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_admissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_package_id UUID NOT NULL UNIQUE REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  admitted_by JSONB NOT NULL,
  admission_reason TEXT NOT NULL,
  source_package_snapshot JSONB NOT NULL,
  included_authority JSONB NOT NULL,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  audit_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'admitted' CHECK (lifecycle IN ('admitted', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_published_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES historical_library_admissions(id) ON DELETE RESTRICT,
  authority_ref JSONB NOT NULL,
  snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (lifecycle IN ('active', 'preserved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  object_type TEXT NOT NULL CHECK (
    object_type IN (
      'candidate_historical_object',
      'candidate_milestone',
      'candidate_participation',
      'candidate_relationship',
      'candidate_source',
      'candidate_context_record'
    )
  ),
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN (
      'draft',
      'researching',
      'validated',
      'validation_failed',
      'package_candidate',
      'packaged',
      'submitted_to_governance',
      'returned_for_revision',
      'superseded',
      'preserved'
    )
  ),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_object_id UUID REFERENCES factory_objects(id) ON DELETE RESTRICT,
  artifact_type TEXT NOT NULL CHECK (
    artifact_type IN ('validation', 'evidence', 'enrichment', 'generation', 'audit')
  ),
  title TEXT NOT NULL,
  payload JSONB NOT NULL,
  authority_safe BOOLEAN NOT NULL DEFAULT FALSE,
  model_provider TEXT,
  model_name TEXT,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_package_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  package_type TEXT NOT NULL CHECK (
    package_type IN (
      'historical_object_publication',
      'participation_publication',
      'timeline_context_publication',
      'mixed_authority_publication'
    )
  ),
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN (
      'draft',
      'validating',
      'ready_for_governance',
      'submitted_to_governance',
      'returned_for_revision',
      'revised',
      'superseded',
      'preserved'
    )
  ),
  lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  supersedes_package_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (id IS DISTINCT FROM lineage_root_id),
  CHECK (id IS DISTINCT FROM supersedes_package_id)
);

CREATE TABLE IF NOT EXISTS factory_package_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  lineage_root_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  supersedes_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  package_snapshot JSONB NOT NULL,
  snapshot_hash TEXT NOT NULL,
  validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN ('draft', 'submitted_to_governance', 'returned_for_revision', 'superseded', 'preserved')
  ),
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  feedback_package_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE (lineage_root_id, version),
  CHECK (id IS DISTINCT FROM supersedes_version_id)
);

CREATE TABLE IF NOT EXISTS factory_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ref JSONB NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS factory_runtime_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_provider_key TEXT NOT NULL DEFAULT 'qwen14',
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  title TEXT NOT NULL,
  template TEXT NOT NULL,
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_key, version)
);

CREATE TABLE IF NOT EXISTS factory_runtime_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID NOT NULL REFERENCES factory_runtime_workers(id) ON DELETE RESTRICT,
  prompt_id UUID NOT NULL REFERENCES factory_runtime_prompts(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL DEFAULT 'qwen14',
  model_name TEXT NOT NULL DEFAULT 'Qwen14',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0 CHECK (priority >= 0 AND priority <= 100),
  input JSONB NOT NULL,
  configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES factory_runtime_jobs(id) ON DELETE RESTRICT,
  worker_id UUID NOT NULL REFERENCES factory_runtime_workers(id) ON DELETE RESTRICT,
  provider_key TEXT NOT NULL,
  model_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'started', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL,
  output JSONB,
  error JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_runtime_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_ref JSONB NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_worker_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  worker_category TEXT NOT NULL CHECK (worker_category IN ('research', 'source', 'extraction', 'enrichment', 'assembly', 'validation')),
  allowed_inputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_object_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_relationship_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_key)
);

CREATE TABLE IF NOT EXISTS factory_worker_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  provider_policy JSONB NOT NULL,
  max_context_tokens INTEGER NOT NULL CHECK (max_context_tokens > 0),
  max_output_tokens INTEGER NOT NULL CHECK (max_output_tokens > 0),
  retry_policy JSONB NOT NULL,
  execution_timeout INTEGER NOT NULL CHECK (execution_timeout > 0),
  audit_requirements JSONB NOT NULL,
  forbidden_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_worker_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  worker_version INTEGER NOT NULL CHECK (worker_version > 0),
  contract JSONB NOT NULL,
  policy_id UUID NOT NULL REFERENCES factory_worker_policies(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'disabled')),
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_key, worker_version)
);

CREATE TABLE IF NOT EXISTS factory_worker_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_key TEXT NOT NULL REFERENCES factory_worker_capabilities(worker_key) ON DELETE RESTRICT,
  worker_version_id UUID NOT NULL REFERENCES factory_worker_versions(id) ON DELETE RESTRICT,
  allowed_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_operations JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_policy JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (worker_version_id)
);

CREATE TABLE IF NOT EXISTS factory_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_pipeline_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID NOT NULL REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  step_index INTEGER NOT NULL CHECK (step_index >= 0),
  worker_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'cancelled')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  factory_object_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pipeline_run_id, step_index)
);

CREATE TABLE IF NOT EXISTS factory_governance_handoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pipeline_run_id UUID REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'submitted_to_governance', 'cancelled', 'preserved')),
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_artifact_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_reason TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (factory_package_draft_id)
);

CREATE TABLE IF NOT EXISTS factory_submission_audit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES factory_governance_handoffs(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT NOT NULL,
  package_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  pipeline_lineage JSONB NOT NULL DEFAULT '{}'::jsonb,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_submission_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handoff_id UUID NOT NULL REFERENCES factory_governance_handoffs(id) ON DELETE RESTRICT,
  pipeline_run_id UUID REFERENCES factory_pipeline_runs(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  worker_outputs JSONB NOT NULL DEFAULT '[]'::jsonb,
  validation_artifacts JSONB NOT NULL DEFAULT '[]'::jsonb,
  governance_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_governance_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_package_version_id UUID NOT NULL UNIQUE REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID NOT NULL REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID NOT NULL UNIQUE REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  submission_actor JSONB NOT NULL,
  submission_reason TEXT NOT NULL,
  submission_audit_record_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_feedback_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_package_id UUID NOT NULL UNIQUE REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  affected_factory_object_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  classification TEXT NOT NULL CHECK (
    classification IN ('authority_error', 'missing_context', 'participation_error', 'priority_error', 'source_gap', 'publication_quality_issue', 'audit_gap')
  ),
  required_response TEXT NOT NULL CHECK (
    required_response IN ('factory_acknowledgement', 'factory_revision', 'governance_review', 'new_publication_package', 'no_action_required')
  ),
  lifecycle TEXT NOT NULL DEFAULT 'received' CHECK (
    lifecycle IN (
      'received',
      'acknowledged',
      'triaged',
      'revision_required',
      'revision_in_progress',
      'resubmission_prepared',
      'resolved',
      'closed',
      'preserved'
    )
  ),
  revision_plan_id UUID,
  resolution_record_id UUID,
  audit_record_id UUID NOT NULL REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS factory_revision_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_consumption_id UUID NOT NULL REFERENCES factory_feedback_consumptions(id) ON DELETE RESTRICT,
  feedback_package_id UUID NOT NULL REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  factory_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  factory_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  factory_lineage_root_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  affected_factory_object_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  plan_summary TEXT NOT NULL,
  planned_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (
    lifecycle IN ('draft', 'approved', 'in_progress', 'resubmission_prepared', 'resolved', 'closed', 'preserved')
  ),
  resubmission_package_draft_id UUID REFERENCES factory_package_drafts(id) ON DELETE RESTRICT,
  superseded_package_version_id UUID REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  new_package_version_id UUID UNIQUE REFERENCES factory_package_versions(id) ON DELETE RESTRICT,
  governance_publication_package_id UUID REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  submission_audit_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  revision_completion_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  audit_record_id UUID NOT NULL REFERENCES factory_audit_records(id) ON DELETE RESTRICT,
  created_by TEXT NOT NULL DEFAULT 'system',
  updated_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE factory_package_versions
  ADD COLUMN IF NOT EXISTS revision_plan_id UUID REFERENCES factory_revision_plans(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS source_feedback_package_id UUID REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resubmission_audit_record_id UUID REFERENCES factory_audit_records(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_timelines_slug ON timelines(slug);
CREATE INDEX IF NOT EXISTS idx_timelines_category ON timelines(category);
CREATE INDEX IF NOT EXISTS idx_timelines_search_vector ON timelines USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_historical_sort ON events(sort_year, sort_month, sort_day);
CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_timeline_events_order ON timeline_events(timeline_id, event_order);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_timeline_requests_hash_date ON timeline_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_requests_type_date ON timeline_requests(request_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_slug_history_timeline_id ON timeline_slug_history(timeline_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type_date ON analytics_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timeline_type_date ON analytics_events(timeline_id, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_slug_type_date ON analytics_events(slug, event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_relationship_recovery_reports_generated_at ON relationship_recovery_reports(generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_slot_status_dates ON ad_campaigns(slot, status, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_historical_objects_type_status ON historical_objects(primary_type, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_historical_object_aliases_object_id ON historical_object_aliases(object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_revisions_object_id ON historical_object_revisions(object_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_historical_object_merges_source ON historical_object_merges(source_object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_merges_target ON historical_object_merges(target_object_id);
CREATE INDEX IF NOT EXISTS idx_historical_object_retirements_object ON historical_object_retirements(object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_participations_object ON milestone_participations(historical_object_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_milestone_participations_milestone ON milestone_participations(milestone_id, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_milestone_participations_public_context ON milestone_participations(milestone_id, authority_state, lifecycle_status, participation_priority);
CREATE INDEX IF NOT EXISTS idx_milestone_participation_revisions_participation ON milestone_participation_revisions(participation_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_milestone_participation_disputes_participation ON milestone_participation_disputes(participation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_historical_relationships_type_status ON historical_relationships(relationship_type, lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_historical_relationships_source ON historical_relationships USING GIN(source_authority_ref);
CREATE INDEX IF NOT EXISTS idx_historical_relationships_target ON historical_relationships USING GIN(target_authority_ref);
CREATE INDEX IF NOT EXISTS idx_historical_relationship_revisions_relationship ON historical_relationship_revisions(relationship_id, revision DESC);
CREATE INDEX IF NOT EXISTS idx_historical_relationship_merges_source ON historical_relationship_merges(source_relationship_id);
CREATE INDEX IF NOT EXISTS idx_historical_relationship_retirements_relationship ON historical_relationship_retirements(relationship_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_decisions_target ON governance_decisions USING GIN(target_authority);
CREATE INDEX IF NOT EXISTS idx_governance_decisions_lifecycle ON governance_decisions(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_decision ON governance_approvals(decision_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_governance_queues_owner ON governance_queues(owner_service, queue_type, lifecycle);
CREATE INDEX IF NOT EXISTS idx_governance_publication_packages_lifecycle ON governance_publication_packages(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_feedback_packages_lifecycle ON governance_feedback_packages(lifecycle, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_disputes_lifecycle ON governance_disputes(lifecycle, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_governance_audit_records_authority ON governance_audit_records USING GIN(authority_ref);
CREATE INDEX IF NOT EXISTS idx_historical_library_admissions_package ON historical_library_admissions(publication_package_id);
CREATE INDEX IF NOT EXISTS idx_historical_library_admissions_decision ON historical_library_admissions(governance_decision_id);
CREATE INDEX IF NOT EXISTS idx_historical_library_published_snapshots_admission ON historical_library_published_snapshots(admission_id);
CREATE INDEX IF NOT EXISTS idx_historical_library_published_snapshots_authority ON historical_library_published_snapshots USING GIN(authority_ref);
CREATE INDEX IF NOT EXISTS idx_factory_objects_type_lifecycle ON factory_objects(object_type, lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_artifacts_object_type ON factory_artifacts(factory_object_id, artifact_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_drafts_lifecycle ON factory_package_drafts(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_drafts_lineage ON factory_package_drafts(lineage_root_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_versions_draft ON factory_package_versions(draft_id, version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_package_versions_lineage ON factory_package_versions(lineage_root_id, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_factory_package_versions_revision_plan ON factory_package_versions(revision_plan_id);
CREATE INDEX IF NOT EXISTS idx_factory_package_versions_feedback ON factory_package_versions(source_feedback_package_id);
CREATE INDEX IF NOT EXISTS idx_factory_editorial_reviews_package ON factory_editorial_reviews(factory_package_draft_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_editorial_reviews_lifecycle ON factory_editorial_reviews(lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_editorial_decisions_review ON factory_editorial_decisions(editorial_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_confidence_assessments_review ON factory_confidence_assessments(editorial_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_authority_preparations_review ON factory_authority_preparations(editorial_review_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_audit_records_target ON factory_audit_records USING GIN(target_ref);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_workers_status ON factory_runtime_workers(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_prompts_key_version ON factory_runtime_prompts(prompt_key, version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_jobs_status_priority ON factory_runtime_jobs(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_executions_job ON factory_runtime_executions(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_runtime_audit_records_target ON factory_runtime_audit_records USING GIN(target_ref);
CREATE INDEX IF NOT EXISTS idx_factory_worker_capabilities_category ON factory_worker_capabilities(worker_category, status);
CREATE INDEX IF NOT EXISTS idx_factory_worker_policies_worker ON factory_worker_policies(worker_key, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_worker_versions_worker ON factory_worker_versions(worker_key, worker_version DESC);
CREATE INDEX IF NOT EXISTS idx_factory_worker_permissions_worker ON factory_worker_permissions(worker_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_pipeline_runs_status ON factory_pipeline_runs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_pipeline_steps_run ON factory_pipeline_steps(pipeline_run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_factory_pipeline_steps_worker ON factory_pipeline_steps(worker_key, status);
CREATE INDEX IF NOT EXISTS idx_factory_governance_handoffs_status ON factory_governance_handoffs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_governance_handoffs_pipeline ON factory_governance_handoffs(pipeline_run_id);
CREATE INDEX IF NOT EXISTS idx_factory_submission_audit_handoff ON factory_submission_audit_records(handoff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_submission_lineage_handoff ON factory_submission_lineage(handoff_id);
CREATE INDEX IF NOT EXISTS idx_governance_publication_packages_factory_version ON governance_publication_packages(factory_package_version_id);
CREATE INDEX IF NOT EXISTS idx_factory_governance_submissions_lineage ON factory_governance_submissions(factory_lineage_root_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_feedback_consumptions_feedback ON factory_feedback_consumptions(feedback_package_id);
CREATE INDEX IF NOT EXISTS idx_factory_feedback_consumptions_lineage ON factory_feedback_consumptions(factory_lineage_root_id, lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_consumption ON factory_revision_plans(feedback_consumption_id);
CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_lineage ON factory_revision_plans(factory_lineage_root_id, lifecycle, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_factory_revision_plans_new_version ON factory_revision_plans(new_package_version_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_timelines_updated_at ON timelines;
CREATE TRIGGER trigger_timelines_updated_at
BEFORE UPDATE ON timelines
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_events_updated_at ON events;
CREATE TRIGGER trigger_events_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_ad_campaigns_updated_at ON ad_campaigns;
CREATE TRIGGER trigger_ad_campaigns_updated_at
BEFORE UPDATE ON ad_campaigns
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

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

DROP TRIGGER IF EXISTS trigger_historical_relationships_updated_at ON historical_relationships;
CREATE TRIGGER trigger_historical_relationships_updated_at
BEFORE UPDATE ON historical_relationships
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_governance_queues_updated_at ON governance_queues;
CREATE TRIGGER trigger_governance_queues_updated_at
BEFORE UPDATE ON governance_queues
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_governance_publication_packages_updated_at ON governance_publication_packages;
CREATE TRIGGER trigger_governance_publication_packages_updated_at
BEFORE UPDATE ON governance_publication_packages
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_objects_updated_at ON factory_objects;
CREATE TRIGGER trigger_factory_objects_updated_at
BEFORE UPDATE ON factory_objects
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_package_drafts_updated_at ON factory_package_drafts;
CREATE TRIGGER trigger_factory_package_drafts_updated_at
BEFORE UPDATE ON factory_package_drafts
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_editorial_reviews_updated_at ON factory_editorial_reviews;
CREATE TRIGGER trigger_factory_editorial_reviews_updated_at
BEFORE UPDATE ON factory_editorial_reviews
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_feedback_consumptions_updated_at ON factory_feedback_consumptions;
CREATE TRIGGER trigger_factory_feedback_consumptions_updated_at
BEFORE UPDATE ON factory_feedback_consumptions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_revision_plans_updated_at ON factory_revision_plans;
CREATE TRIGGER trigger_factory_revision_plans_updated_at
BEFORE UPDATE ON factory_revision_plans
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_runtime_workers_updated_at ON factory_runtime_workers;
CREATE TRIGGER trigger_factory_runtime_workers_updated_at
BEFORE UPDATE ON factory_runtime_workers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_runtime_jobs_updated_at ON factory_runtime_jobs;
CREATE TRIGGER trigger_factory_runtime_jobs_updated_at
BEFORE UPDATE ON factory_runtime_jobs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_runtime_executions_updated_at ON factory_runtime_executions;
CREATE TRIGGER trigger_factory_runtime_executions_updated_at
BEFORE UPDATE ON factory_runtime_executions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_worker_capabilities_updated_at ON factory_worker_capabilities;
CREATE TRIGGER trigger_factory_worker_capabilities_updated_at
BEFORE UPDATE ON factory_worker_capabilities
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_pipeline_runs_updated_at ON factory_pipeline_runs;
CREATE TRIGGER trigger_factory_pipeline_runs_updated_at
BEFORE UPDATE ON factory_pipeline_runs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_pipeline_steps_updated_at ON factory_pipeline_steps;
CREATE TRIGGER trigger_factory_pipeline_steps_updated_at
BEFORE UPDATE ON factory_pipeline_steps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_factory_governance_handoffs_updated_at ON factory_governance_handoffs;
CREATE TRIGGER trigger_factory_governance_handoffs_updated_at
BEFORE UPDATE ON factory_governance_handoffs
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

DROP TRIGGER IF EXISTS prevent_governance_decisions_delete ON governance_decisions;
CREATE TRIGGER prevent_governance_decisions_delete
BEFORE DELETE ON governance_decisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_approvals_delete ON governance_approvals;
CREATE TRIGGER prevent_governance_approvals_delete
BEFORE DELETE ON governance_approvals
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_queues_delete ON governance_queues;
CREATE TRIGGER prevent_governance_queues_delete
BEFORE DELETE ON governance_queues
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_publication_packages_delete ON governance_publication_packages;
CREATE TRIGGER prevent_governance_publication_packages_delete
BEFORE DELETE ON governance_publication_packages
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_feedback_packages_delete ON governance_feedback_packages;
CREATE TRIGGER prevent_governance_feedback_packages_delete
BEFORE DELETE ON governance_feedback_packages
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_disputes_delete ON governance_disputes;
CREATE TRIGGER prevent_governance_disputes_delete
BEFORE DELETE ON governance_disputes
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

DROP TRIGGER IF EXISTS prevent_governance_audit_records_delete ON governance_audit_records;
CREATE TRIGGER prevent_governance_audit_records_delete
BEFORE DELETE ON governance_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_authority_delete();

CREATE OR REPLACE FUNCTION prevent_historical_library_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Historical Library Published Memory records are preserved and cannot be % from %. Use a governed revision workflow.', TG_OP, TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_historical_library_admissions_delete ON historical_library_admissions;
CREATE TRIGGER prevent_historical_library_admissions_delete
BEFORE DELETE ON historical_library_admissions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_published_snapshots_update ON historical_library_published_snapshots;
CREATE TRIGGER prevent_historical_library_published_snapshots_update
BEFORE UPDATE ON historical_library_published_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_published_snapshots_delete ON historical_library_published_snapshots;
CREATE TRIGGER prevent_historical_library_published_snapshots_delete
BEFORE DELETE ON historical_library_published_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

CREATE OR REPLACE FUNCTION prevent_factory_history_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Factory Production Memory records are preserved and cannot be deleted from %. Use lifecycle transitions.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_submitted_factory_package_version_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.lifecycle = 'submitted_to_governance' THEN
    RAISE EXCEPTION 'Submitted Factory package versions are immutable. Create a new version for revisions.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_factory_objects_delete ON factory_objects;
CREATE TRIGGER prevent_factory_objects_delete
BEFORE DELETE ON factory_objects
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_artifacts_delete ON factory_artifacts;
CREATE TRIGGER prevent_factory_artifacts_delete
BEFORE DELETE ON factory_artifacts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_package_drafts_delete ON factory_package_drafts;
CREATE TRIGGER prevent_factory_package_drafts_delete
BEFORE DELETE ON factory_package_drafts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_package_versions_delete ON factory_package_versions;
CREATE TRIGGER prevent_factory_package_versions_delete
BEFORE DELETE ON factory_package_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

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

DROP TRIGGER IF EXISTS prevent_factory_package_versions_submitted_update ON factory_package_versions;
CREATE TRIGGER prevent_factory_package_versions_submitted_update
BEFORE UPDATE ON factory_package_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_submitted_factory_package_version_update();

DROP TRIGGER IF EXISTS prevent_factory_audit_records_delete ON factory_audit_records;
CREATE TRIGGER prevent_factory_audit_records_delete
BEFORE DELETE ON factory_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_workers_delete ON factory_runtime_workers;
CREATE TRIGGER prevent_factory_runtime_workers_delete
BEFORE DELETE ON factory_runtime_workers
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_prompts_delete ON factory_runtime_prompts;
CREATE TRIGGER prevent_factory_runtime_prompts_delete
BEFORE DELETE ON factory_runtime_prompts
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_jobs_delete ON factory_runtime_jobs;
CREATE TRIGGER prevent_factory_runtime_jobs_delete
BEFORE DELETE ON factory_runtime_jobs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_executions_delete ON factory_runtime_executions;
CREATE TRIGGER prevent_factory_runtime_executions_delete
BEFORE DELETE ON factory_runtime_executions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_runtime_audit_records_delete ON factory_runtime_audit_records;
CREATE TRIGGER prevent_factory_runtime_audit_records_delete
BEFORE DELETE ON factory_runtime_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_capabilities_delete ON factory_worker_capabilities;
CREATE TRIGGER prevent_factory_worker_capabilities_delete
BEFORE DELETE ON factory_worker_capabilities
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_policies_delete ON factory_worker_policies;
CREATE TRIGGER prevent_factory_worker_policies_delete
BEFORE DELETE ON factory_worker_policies
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_versions_delete ON factory_worker_versions;
CREATE TRIGGER prevent_factory_worker_versions_delete
BEFORE DELETE ON factory_worker_versions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_worker_permissions_delete ON factory_worker_permissions;
CREATE TRIGGER prevent_factory_worker_permissions_delete
BEFORE DELETE ON factory_worker_permissions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_pipeline_runs_delete ON factory_pipeline_runs;
CREATE TRIGGER prevent_factory_pipeline_runs_delete
BEFORE DELETE ON factory_pipeline_runs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_pipeline_steps_delete ON factory_pipeline_steps;
CREATE TRIGGER prevent_factory_pipeline_steps_delete
BEFORE DELETE ON factory_pipeline_steps
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_governance_handoffs_delete ON factory_governance_handoffs;
CREATE TRIGGER prevent_factory_governance_handoffs_delete
BEFORE DELETE ON factory_governance_handoffs
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_submission_audit_records_delete ON factory_submission_audit_records;
CREATE TRIGGER prevent_factory_submission_audit_records_delete
BEFORE DELETE ON factory_submission_audit_records
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_submission_lineage_delete ON factory_submission_lineage;
CREATE TRIGGER prevent_factory_submission_lineage_delete
BEFORE DELETE ON factory_submission_lineage
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_governance_submissions_delete ON factory_governance_submissions;
CREATE TRIGGER prevent_factory_governance_submissions_delete
BEFORE DELETE ON factory_governance_submissions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_feedback_consumptions_delete ON factory_feedback_consumptions;
CREATE TRIGGER prevent_factory_feedback_consumptions_delete
BEFORE DELETE ON factory_feedback_consumptions
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();

DROP TRIGGER IF EXISTS prevent_factory_revision_plans_delete ON factory_revision_plans;
CREATE TRIGGER prevent_factory_revision_plans_delete
BEFORE DELETE ON factory_revision_plans
FOR EACH ROW
EXECUTE FUNCTION prevent_factory_history_delete();
CREATE TABLE IF NOT EXISTS historical_library_published_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  previous_snapshot JSONB NOT NULL,
  revised_snapshot JSONB NOT NULL,
  revised_snapshot_hash TEXT NOT NULL,
  amendment_summary TEXT NOT NULL,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_retirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  retirement_reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (published_snapshot_id)
);

CREATE TABLE IF NOT EXISTS historical_library_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_record_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  merge_reason TEXT NOT NULL,
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_published_record_id IS DISTINCT FROM target_published_record_id),
  UNIQUE (source_published_record_id)
);

CREATE TABLE IF NOT EXISTS historical_library_preservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  governance_decision_id UUID NOT NULL REFERENCES governance_decisions(id) ON DELETE RESTRICT,
  preservation_reason TEXT NOT NULL,
  preservation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  audit_record_id UUID,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS historical_library_feedback_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lifecycle_action_type TEXT NOT NULL CHECK (
    lifecycle_action_type IN ('revision', 'retirement', 'merge', 'preservation')
  ),
  lifecycle_action_id UUID NOT NULL,
  feedback_package_id UUID NOT NULL UNIQUE REFERENCES governance_feedback_packages(id) ON DELETE RESTRICT,
  publication_package_id UUID NOT NULL REFERENCES governance_publication_packages(id) ON DELETE RESTRICT,
  source_published_record_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_record_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  created_by JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_historical_library_revisions_snapshot
  ON historical_library_published_revisions(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historical_library_retirements_snapshot
  ON historical_library_retirements(published_snapshot_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_merges_source
  ON historical_library_merges(source_published_record_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_merges_target
  ON historical_library_merges(target_published_record_id);

CREATE INDEX IF NOT EXISTS idx_historical_library_preservations_snapshot
  ON historical_library_preservations(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_historical_library_feedback_links_action
  ON historical_library_feedback_links(lifecycle_action_type, lifecycle_action_id);

DROP TRIGGER IF EXISTS prevent_historical_library_revisions_delete ON historical_library_published_revisions;
CREATE TRIGGER prevent_historical_library_revisions_delete
BEFORE DELETE ON historical_library_published_revisions
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_retirements_delete ON historical_library_retirements;
CREATE TRIGGER prevent_historical_library_retirements_delete
BEFORE DELETE ON historical_library_retirements
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_merges_delete ON historical_library_merges;
CREATE TRIGGER prevent_historical_library_merges_delete
BEFORE DELETE ON historical_library_merges
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_preservations_delete ON historical_library_preservations;
CREATE TRIGGER prevent_historical_library_preservations_delete
BEFORE DELETE ON historical_library_preservations
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_historical_library_feedback_links_delete ON historical_library_feedback_links;
CREATE TRIGGER prevent_historical_library_feedback_links_delete
BEFORE DELETE ON historical_library_feedback_links
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TABLE IF NOT EXISTS published_memory_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  projection_type TEXT NOT NULL CHECK (
    projection_type IN ('timeline', 'milestone', 'historical_object', 'relationship', 'search', 'sitemap')
  ),
  slug TEXT,
  payload JSONB NOT NULL,
  projection_version INTEGER NOT NULL CHECK (projection_version > 0),
  projection_hash TEXT NOT NULL,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK (
    lifecycle IN ('active', 'superseded', 'retired', 'merged', 'preserved')
  ),
  source_event_type TEXT NOT NULL CHECK (
    source_event_type IN ('admission', 'revision', 'retirement', 'merge', 'preservation', 'rebuild')
  ),
  source_event_id UUID NOT NULL,
  audit_record_id UUID,
  superseded_by_projection_id UUID REFERENCES published_memory_projections(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (published_snapshot_id, projection_type, projection_hash)
);

CREATE TABLE IF NOT EXISTS published_memory_projection_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projection_id UUID NOT NULL REFERENCES published_memory_projections(id) ON DELETE RESTRICT,
  published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  revision_id UUID REFERENCES historical_library_published_revisions(id) ON DELETE RESTRICT,
  retirement_id UUID REFERENCES historical_library_retirements(id) ON DELETE RESTRICT,
  merge_id UUID REFERENCES historical_library_merges(id) ON DELETE RESTRICT,
  preservation_id UUID REFERENCES historical_library_preservations(id) ON DELETE RESTRICT,
  projection_version INTEGER NOT NULL CHECK (projection_version > 0),
  projection_hash TEXT NOT NULL,
  audit_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS published_memory_continuity_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_published_snapshot_id UUID NOT NULL REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  target_published_snapshot_id UUID REFERENCES historical_library_published_snapshots(id) ON DELETE RESTRICT,
  continuity_type TEXT NOT NULL CHECK (continuity_type IN ('retired', 'merged')),
  continuity_path JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_event_id UUID NOT NULL,
  projection_hash TEXT NOT NULL,
  audit_record_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_published_snapshot_id, continuity_type, projection_hash)
);

CREATE TABLE IF NOT EXISTS published_memory_projection_rebuild_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL CHECK (status IN ('completed', 'completed_with_failures', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  batch_size INTEGER NOT NULL CHECK (batch_size > 0),
  total_processed INTEGER NOT NULL CHECK (total_processed >= 0),
  generated INTEGER NOT NULL CHECK (generated >= 0),
  updated INTEGER NOT NULL CHECK (updated >= 0),
  unchanged INTEGER NOT NULL CHECK (unchanged >= 0),
  failed INTEGER NOT NULL CHECK (failed >= 0),
  skipped INTEGER NOT NULL CHECK (skipped >= 0),
  continuity_projection_count INTEGER NOT NULL CHECK (continuity_projection_count >= 0),
  coverage_summary JSONB NOT NULL,
  dto_validation_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  rebuild_failures JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_published_memory_projections_lookup
  ON published_memory_projections(projection_type, lifecycle, slug, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_published_memory_projections_one_active
  ON published_memory_projections(published_snapshot_id, projection_type)
  WHERE lifecycle = 'active';

CREATE INDEX IF NOT EXISTS idx_published_memory_projections_superseded_by
  ON published_memory_projections(superseded_by_projection_id)
  WHERE superseded_by_projection_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_published_memory_projection_lineage_snapshot
  ON published_memory_projection_lineage(published_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_published_memory_continuity_source
  ON published_memory_continuity_projections(source_published_snapshot_id, continuity_type);

CREATE INDEX IF NOT EXISTS idx_published_memory_projection_rebuild_reports_created
  ON published_memory_projection_rebuild_reports(created_at DESC);

DROP TRIGGER IF EXISTS prevent_published_memory_projections_delete ON published_memory_projections;
CREATE TRIGGER prevent_published_memory_projections_delete
BEFORE DELETE ON published_memory_projections
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_published_memory_projection_lineage_delete ON published_memory_projection_lineage;
CREATE TRIGGER prevent_published_memory_projection_lineage_delete
BEFORE DELETE ON published_memory_projection_lineage
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_published_memory_continuity_projections_delete ON published_memory_continuity_projections;
CREATE TRIGGER prevent_published_memory_continuity_projections_delete
BEFORE DELETE ON published_memory_continuity_projections
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();

DROP TRIGGER IF EXISTS prevent_published_memory_projection_rebuild_reports_delete ON published_memory_projection_rebuild_reports;
CREATE TRIGGER prevent_published_memory_projection_rebuild_reports_delete
BEFORE DELETE ON published_memory_projection_rebuild_reports
FOR EACH ROW
EXECUTE FUNCTION prevent_historical_library_mutation();
CREATE TABLE IF NOT EXISTS source_authority_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  provider_record_id TEXT NOT NULL,
  canonical_url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL,
  origin JSONB NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_record_id)
);

CREATE TABLE IF NOT EXISTS source_authority_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL CHECK (version > 0),
  retrieval_url TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_text TEXT NOT NULL,
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  provenance JSONB NOT NULL,
  retrieved_by TEXT NOT NULL DEFAULT 'system',
  retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_record_id, version)
);

CREATE TABLE IF NOT EXISTS provider_runtime_state (
  provider TEXT PRIMARY KEY CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK (consecutive_failures >= 0),
  cooldown_until TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  failure_count BIGINT NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
  success_count BIGINT NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  recovery_count BIGINT NOT NULL DEFAULT 0 CHECK (recovery_count >= 0),
  last_recovered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (last_failure_reason IS NULL OR length(last_failure_reason) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_source_authority_records_provider_created
  ON source_authority_records(provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_authority_records_origin
  ON source_authority_records USING GIN(origin);

CREATE INDEX IF NOT EXISTS idx_source_authority_snapshots_source_version
  ON source_authority_snapshots(source_record_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_source_authority_snapshots_provenance
  ON source_authority_snapshots USING GIN(provenance);

CREATE INDEX IF NOT EXISTS idx_provider_runtime_state_cooldown
  ON provider_runtime_state(cooldown_until)
  WHERE cooldown_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_provider_runtime_state_updated
  ON provider_runtime_state(updated_at DESC);

CREATE OR REPLACE FUNCTION prevent_source_authority_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Source Authority records are preserved and cannot be deleted from %. Create a new version instead.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_source_authority_snapshot_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Source Authority snapshots are immutable. Retrieve a new snapshot version instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_source_authority_records_delete ON source_authority_records;
CREATE TRIGGER prevent_source_authority_records_delete
BEFORE DELETE ON source_authority_records
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_delete();

DROP TRIGGER IF EXISTS prevent_source_authority_snapshots_delete ON source_authority_snapshots;
CREATE TRIGGER prevent_source_authority_snapshots_delete
BEFORE DELETE ON source_authority_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_delete();

DROP TRIGGER IF EXISTS prevent_source_authority_snapshots_update ON source_authority_snapshots;
CREATE TRIGGER prevent_source_authority_snapshots_update
BEFORE UPDATE ON source_authority_snapshots
FOR EACH ROW
EXECUTE FUNCTION prevent_source_authority_snapshot_update();

CREATE TABLE IF NOT EXISTS corpus_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_snapshot_id UUID NOT NULL UNIQUE REFERENCES source_authority_snapshots(id) ON DELETE RESTRICT,
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  source_lineage JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  corpus_document_id UUID NOT NULL REFERENCES corpus_documents(id) ON DELETE RESTRICT,
  source_snapshot_id UUID NOT NULL REFERENCES source_authority_snapshots(id) ON DELETE RESTRICT,
  source_record_id UUID NOT NULL REFERENCES source_authority_records(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('wikidata', 'dbpedia', 'library_of_congress', 'nara')),
  retrieval_timestamp TIMESTAMPTZ NOT NULL,
  span_start INTEGER NOT NULL CHECK (span_start >= 0),
  span_end INTEGER NOT NULL CHECK (span_end > span_start),
  quote_text TEXT NOT NULL,
  normalized_claim TEXT NOT NULL,
  provenance JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (corpus_document_id, span_start, span_end, quote_text)
);

CREATE INDEX IF NOT EXISTS idx_corpus_documents_source_record
  ON corpus_documents(source_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_corpus_documents_lineage
  ON corpus_documents USING GIN(source_lineage);

CREATE INDEX IF NOT EXISTS idx_evidence_records_corpus
  ON evidence_records(corpus_document_id, span_start);

CREATE INDEX IF NOT EXISTS idx_evidence_records_source_snapshot
  ON evidence_records(source_snapshot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_source_record
  ON evidence_records(source_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_records_provenance
  ON evidence_records USING GIN(provenance);

CREATE OR REPLACE FUNCTION prevent_research_corpus_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Research corpus and evidence records are preserved and cannot be deleted from %.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_research_corpus_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Research corpus and evidence records are immutable. Create a new source snapshot, corpus document, or evidence record instead.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_corpus_documents_delete ON corpus_documents;
CREATE TRIGGER prevent_corpus_documents_delete
BEFORE DELETE ON corpus_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_delete();

DROP TRIGGER IF EXISTS prevent_evidence_records_delete ON evidence_records;
CREATE TRIGGER prevent_evidence_records_delete
BEFORE DELETE ON evidence_records
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_delete();

DROP TRIGGER IF EXISTS prevent_corpus_documents_update ON corpus_documents;
CREATE TRIGGER prevent_corpus_documents_update
BEFORE UPDATE ON corpus_documents
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_update();

DROP TRIGGER IF EXISTS prevent_evidence_records_update ON evidence_records;
CREATE TRIGGER prevent_evidence_records_update
BEFORE UPDATE ON evidence_records
FOR EACH ROW
EXECUTE FUNCTION prevent_research_corpus_update();

CREATE TABLE IF NOT EXISTS evidence_validation_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_record_id UUID NOT NULL REFERENCES evidence_records(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('passed', 'failed')),
  checks JSONB NOT NULL,
  provenance JSONB NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_evidence
  ON evidence_validation_records(evidence_record_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_status
  ON evidence_validation_records(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_validation_records_provenance
  ON evidence_validation_records USING GIN(provenance);

CREATE OR REPLACE FUNCTION prevent_evidence_validation_records_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Evidence validation records are immutable validation history and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_evidence_validation_records_update ON evidence_validation_records;
CREATE TRIGGER prevent_evidence_validation_records_update
BEFORE UPDATE ON evidence_validation_records
FOR EACH ROW
EXECUTE FUNCTION prevent_evidence_validation_records_mutation();

DROP TRIGGER IF EXISTS prevent_evidence_validation_records_delete ON evidence_validation_records;
CREATE TRIGGER prevent_evidence_validation_records_delete
BEFORE DELETE ON evidence_validation_records
FOR EACH ROW
EXECUTE FUNCTION prevent_evidence_validation_records_mutation();
