CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS timelines (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
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
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'planned', 'rejected', 'completed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_timelines_slug ON timelines(slug);
CREATE INDEX IF NOT EXISTS idx_timelines_category ON timelines(category);
CREATE INDEX IF NOT EXISTS idx_timelines_search_vector ON timelines USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_search_vector ON events USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_timeline_events_order ON timeline_events(timeline_id, event_order);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_timeline_requests_hash_date ON timeline_requests(ip_hash, created_at);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_slot_status_dates ON ad_campaigns(slot, status, start_date, end_date);

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
