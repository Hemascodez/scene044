import { pool, query } from "../lib/db";

const SEED_QUERIES: {
  query_text: string;
  category_hint: string;
  site_filter: string | null;
}[] = [
  { query_text: "Chennai AI meetup 2026", category_hint: "ai", site_filter: null },
  { query_text: "Chennai artificial intelligence conference", category_hint: "ai", site_filter: null },
  { query_text: "Chennai AI events", category_hint: "ai", site_filter: "site:lu.ma" },
  { query_text: "Chennai AI meetup", category_hint: "ai", site_filter: "site:meetup.com" },
  { query_text: "Chennai tech meetup 2026", category_hint: "tech", site_filter: null },
  { query_text: "Chennai technology conference 2026", category_hint: "tech", site_filter: null },
  { query_text: "Chennai tech events", category_hint: "tech", site_filter: "site:lu.ma" },
  { query_text: "Chennai tech conference", category_hint: "tech", site_filter: "site:eventbrite.com" },
  { query_text: "Chennai cybersecurity conference 2026", category_hint: "cybersecurity", site_filter: null },
  { query_text: "Chennai cybersecurity meetup", category_hint: "cybersecurity", site_filter: null },
  { query_text: "Chennai cybersecurity meetup", category_hint: "cybersecurity", site_filter: "site:meetup.com" },
  { query_text: "Chennai cybersecurity events", category_hint: "cybersecurity", site_filter: "site:lu.ma" },
  { query_text: "Chennai startup event 2026", category_hint: "startups", site_filter: null },
  { query_text: "Chennai startup meetup", category_hint: "startups", site_filter: null },
  { query_text: "Chennai startup events", category_hint: "startups", site_filter: "site:lu.ma" },
  { query_text: "Chennai startup networking meetup", category_hint: "startups", site_filter: "site:meetup.com" },
  { query_text: "Chennai digital marketing conference 2026", category_hint: "marketing", site_filter: null },
  { query_text: "Chennai marketing meetup", category_hint: "marketing", site_filter: "site:meetup.com" },
  { query_text: "Chennai marketing events", category_hint: "marketing", site_filter: "site:lu.ma" },
  { query_text: "Chennai product management meetup 2026", category_hint: "product", site_filter: null },
  { query_text: "Chennai product manager meetup", category_hint: "product", site_filter: "site:meetup.com" },
  { query_text: "Chennai product management events", category_hint: "product", site_filter: "site:lu.ma" },
  { query_text: "Chennai UX design meetup 2026", category_hint: "design", site_filter: null },
  { query_text: "Chennai design conference", category_hint: "design", site_filter: "site:eventbrite.com" },
  { query_text: "Chennai design events", category_hint: "design", site_filter: "site:lu.ma" },
  { query_text: "Chennai fintech conference 2026", category_hint: "finance", site_filter: null },
  { query_text: "Chennai finance professionals meetup", category_hint: "finance", site_filter: "site:meetup.com" },
  { query_text: "Chennai fintech events", category_hint: "finance", site_filter: "site:lu.ma" },
  { query_text: "Chennai data engineering meetup 2026", category_hint: "data", site_filter: null },
  { query_text: "Chennai cloud computing conference", category_hint: "data", site_filter: null },
  { query_text: "Chennai data analytics meetup", category_hint: "data", site_filter: "site:meetup.com" },
  { query_text: "Chennai big data events", category_hint: "data", site_filter: "site:lu.ma" },

  /*
   * LinkedIn. A large share of Chennai's professional events are announced only
   * as LinkedIn Events, so without these the discovery pass simply never sees
   * them. The routing in /api/cron/discover already sends any linkedin.com hit
   * to the curator queue and never fetches the page server-side — these queries
   * are what actually put candidates in front of a human to verify.
   */
  { query_text: "AI meetup Chennai", category_hint: "ai", site_filter: "site:linkedin.com/events" },
  { query_text: "machine learning event Chennai", category_hint: "ai", site_filter: "site:linkedin.com/events" },
  { query_text: "tech meetup Chennai", category_hint: "tech", site_filter: "site:linkedin.com/events" },
  { query_text: "developer event Chennai", category_hint: "tech", site_filter: "site:linkedin.com/events" },
  { query_text: "cybersecurity event Chennai", category_hint: "cybersecurity", site_filter: "site:linkedin.com/events" },
  { query_text: "product management event Chennai", category_hint: "product", site_filter: "site:linkedin.com/events" },
  { query_text: "UX design event Chennai", category_hint: "design", site_filter: "site:linkedin.com/events" },
  { query_text: "marketing growth event Chennai", category_hint: "marketing", site_filter: "site:linkedin.com/events" },
  { query_text: "startup founders event Chennai", category_hint: "startups", site_filter: "site:linkedin.com/events" },
  { query_text: "fintech event Chennai", category_hint: "finance", site_filter: "site:linkedin.com/events" },
  { query_text: "data cloud event Chennai", category_hint: "data", site_filter: "site:linkedin.com/events" },
];

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const row of SEED_QUERIES) {
    const siteFilter = row.site_filter ?? null;
    const result = await query(
      `INSERT INTO search_queries (query_text, category_hint, site_filter)
       VALUES ($1,$2,$3)
       ON CONFLICT (query_text, site_filter) DO UPDATE SET category_hint = EXCLUDED.category_hint
       RETURNING (xmax = 0) AS inserted`,
      [row.query_text, row.category_hint, siteFilter],
    );
    if (result.rows[0]?.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  console.log(`seed-queries: ${inserted} inserted, ${updated} updated, ${SEED_QUERIES.length} total`);
}

(async () => {
  try {
    await main();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
