CREATE TABLE IF NOT EXISTS venue_host_changes (
  id bigserial PRIMARY KEY,
  venue_slug text NOT NULL REFERENCES venues(slug),
  actor_name text NOT NULL,
  field text NOT NULL,
  before_value jsonb NOT NULL,
  after_value jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX IF NOT EXISTS venue_host_changes_unread ON venue_host_changes(id) WHERE read_at IS NULL;
ALTER TABLE venue_host_changes ENABLE ROW LEVEL SECURITY;
