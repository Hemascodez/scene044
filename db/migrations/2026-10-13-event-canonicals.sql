BEGIN;

-- Do not delete duplicate records or rewrite click/discovery history. URLs
-- resolve to the older canonical row; removing an alias reverses the merge.
CREATE TABLE IF NOT EXISTS event_aliases (
  duplicate_id INT PRIMARY KEY REFERENCES events(id),
  canonical_id INT NOT NULL REFERENCES events(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (canonical_id < duplicate_id)
);
CREATE TABLE IF NOT EXISTS event_seo_corrections (
  correction_key TEXT PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id),
  original_row JSONB NOT NULL,
  evidence_url TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verified official date: https://devfest.gdgchennai.in/ (17 October 2026).
-- No verified closing time was published, so omit the erroneous end time
-- rather than inventing one. Exact guards protect other databases/editions.
WITH saved AS (
  INSERT INTO event_seo_corrections(correction_key, event_id, original_row, evidence_url)
  SELECT 'devfest-2026-end-date', id, to_jsonb(e), 'https://devfest.gdgchennai.in/'
  FROM events e
  WHERE id = 23 AND title ILIKE '%devfest%'
    AND (start_at AT TIME ZONE 'Asia/Kolkata')::date = DATE '2026-10-17'
    AND (end_at AT TIME ZONE 'Asia/Kolkata')::date = DATE '2027-10-17'
  ON CONFLICT DO NOTHING RETURNING event_id
)
UPDATE events SET end_at = NULL, updated_at = now()
WHERE id IN (SELECT event_id FROM saved);

INSERT INTO event_aliases(duplicate_id, canonical_id, reason)
SELECT d.id, c.id, 'Same DevFest Chennai 2026 at IITM Research Park; verified https://devfest.gdgchennai.in/'
FROM events d JOIN events c ON c.id = 23
WHERE d.id = 89 AND d.title ILIKE '%devfest%' AND c.title ILIKE '%devfest%'
  AND (d.start_at AT TIME ZONE 'Asia/Kolkata')::date = DATE '2026-10-17'
  AND (c.start_at AT TIME ZONE 'Asia/Kolkata')::date = DATE '2026-10-17'
  AND d.venue_name ILIKE '%research%park%' AND c.venue_name ILIKE '%research%park%'
ON CONFLICT DO NOTHING;

-- Retain both source records, and make exact-URL dedup find the canonical ID.
INSERT INTO event_sources(event_id, source_url, source_domain)
SELECT a.canonical_id, e.primary_source_url,
       regexp_replace(e.primary_source_url, '^https?://(www\.)?([^/]+).*$', '\2')
FROM event_aliases a JOIN events e ON e.id = a.duplicate_id
WHERE a.duplicate_id = 89 AND a.canonical_id = 23
ON CONFLICT DO NOTHING;

-- Keep the original registration source as evidence before preferring the
-- live duplicate's official source. Do not leave an upcoming event hidden
-- just because the older canonical record was previously marked expired.
INSERT INTO event_sources(event_id, source_url, source_domain)
SELECT c.id, c.primary_source_url,
       regexp_replace(c.primary_source_url, '^https?://(www\.)?([^/]+).*$', '\2')
FROM events c JOIN event_aliases a ON a.canonical_id = c.id
WHERE a.duplicate_id = 89 AND a.canonical_id = 23
ON CONFLICT DO NOTHING;

WITH saved AS (
  INSERT INTO event_seo_corrections(correction_key, event_id, original_row, evidence_url)
  SELECT 'devfest-2026-canonical-source', c.id, to_jsonb(c), 'https://devfest.gdgchennai.in/'
  FROM events c JOIN event_aliases a ON a.canonical_id = c.id
  JOIN events d ON d.id = a.duplicate_id
  WHERE a.duplicate_id = 89 AND a.canonical_id = 23
    AND d.status IN ('live', 'updated')
    AND d.primary_source_url = 'https://devfest.gdgchennai.in/tickets'
  ON CONFLICT DO NOTHING RETURNING event_id
)
UPDATE events c SET status = d.status, organizer_name = 'GDG Chennai',
  primary_source_url = d.primary_source_url, updated_at = now()
FROM events d WHERE c.id IN (SELECT event_id FROM saved) AND d.id = 89;

COMMIT;
