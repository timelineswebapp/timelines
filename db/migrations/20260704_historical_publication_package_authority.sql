ALTER TABLE governance_publication_packages
  ADD COLUMN IF NOT EXISTS canonical_authority JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN governance_publication_packages.canonical_authority IS
  'Governance-approved canonical Factory authority transferred to Historical Library with immutable lineage.';
