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

INSERT INTO tag_governance (tag_id, usage_count)
SELECT tags.id, COALESCE(counts.usage_count, 0)
FROM tags
LEFT JOIN (
  SELECT event_tags.tag_id, COUNT(*)::int AS usage_count
  FROM event_tags
  GROUP BY event_tags.tag_id
) counts ON counts.tag_id = tags.id
ON CONFLICT (tag_id) DO UPDATE
SET usage_count = EXCLUDED.usage_count,
    updated_at = NOW();

CREATE INDEX IF NOT EXISTS idx_taxonomy_categories_status_order
  ON taxonomy_categories(status, display_order, canonical_name);

CREATE INDEX IF NOT EXISTS idx_taxonomy_category_aliases_category_id
  ON taxonomy_category_aliases(category_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_category_redirects_target
  ON taxonomy_category_redirects(target_category_id);

CREATE INDEX IF NOT EXISTS idx_taxonomy_category_merges_target
  ON taxonomy_category_merges(target_category_id);

CREATE INDEX IF NOT EXISTS idx_tag_governance_status
  ON tag_governance(moderation_status, usage_count DESC);

CREATE INDEX IF NOT EXISTS idx_tag_governance_duplicate
  ON tag_governance(duplicate_candidate_of)
  WHERE duplicate_candidate_of IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tag_aliases_tag_id
  ON tag_aliases(tag_id);

CREATE INDEX IF NOT EXISTS idx_tag_redirects_target
  ON tag_redirects(target_tag_id);

CREATE INDEX IF NOT EXISTS idx_tag_merges_target
  ON tag_merges(target_tag_id);
