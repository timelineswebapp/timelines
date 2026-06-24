ALTER TABLE factory_package_drafts
  ADD COLUMN IF NOT EXISTS validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE factory_package_versions
  ADD COLUMN IF NOT EXISTS validated_evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb;
