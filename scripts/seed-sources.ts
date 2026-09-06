import { pool, query } from "../lib/db";

type SourceSeed = {
  name: string;
  domain: string;
  trust_tier: string;
  robots_allowed: boolean;
  notes: string;
};

const sources: SourceSeed[] = [
  { name: "Luma", domain: "lu.ma", trust_tier: "auto_fetch", robots_allowed: true, notes: "Generic event platform widely used for Chennai tech meetups (e.g. Chennai AI Meetup, TAI Connect, Hello World 2026). robots.txt only restricts Googlebot from a few paths (/social-share, /in/, /company/, /session-*); no general User-agent:* disallow. Event pages are publicly viewable without login." },
  { name: "Luma (luma.com)", domain: "luma.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "lu.ma 301-redirects to luma.com (platform rebrand, confirmed live 2026-08-30) — the SSRF-safe fetcher re-validates every redirect hop's domain against the allowlist, so luma.com must be seeded too or every lu.ma URL fails to fetch. robots.txt only restricts Googlebot from a few paths (/social-share, /in/, /company/, /session-*), same as lu.ma." },
  { name: "Meetup", domain: "meetup.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Hosts numerous active Chennai groups (Chennai Tech Meetup, AWS User Group Chennai, PyData Chennai, Chennai Web Engineering, OWASP Chennai). robots.txt disallows feeds/api/query-param variants but does not block general group/event pages, which are viewable without login." },
  { name: "Eventbrite", domain: "eventbrite.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Generic platform used by IIT Madras E-Cell and many Chennai organizers. robots.txt disallows /login/, /signin/, /logout/, rss/atom feeds and a directory path, but discovery pages (e.g. /d/india--chennai/tech-meetup/) and event detail pages are allowed and publicly viewable." },
  /*
   * Eventbrite's regional storefronts serve the SAME event under a different
   * TLD — a Chennai event routinely appears as eventbrite.com.au/e/... because
   * that's the domain the organizer created it on. Listing-page expansion
   * surfaced this: children harvested from a .com ItemList carry .com.au and
   * .co.uk URLs, which were landing in the curator queue as "unknown domain"
   * despite being the same trusted publisher. Same precedent as luma.com above.
   * robots.txt on all four is byte-identical to eventbrite.com's (verified
   * 2026-09-06): feeds, /esi_cache/, /upload/ and query-param variants are
   * disallowed; /e/ event pages and /d/ discovery pages are not.
   */
  { name: "Eventbrite (AU)", domain: "eventbrite.com.au", trust_tier: "auto_fetch", robots_allowed: true, notes: "Regional storefront for eventbrite.com; same robots.txt rules. Chennai events surface here when the organizer's account is AU-based." },
  { name: "Eventbrite (UK)", domain: "eventbrite.co.uk", trust_tier: "auto_fetch", robots_allowed: true, notes: "Regional storefront for eventbrite.com; same robots.txt rules." },
  { name: "Eventbrite (CA)", domain: "eventbrite.ca", trust_tier: "auto_fetch", robots_allowed: true, notes: "Regional storefront for eventbrite.com; same robots.txt rules." },
  { name: "Eventbrite (SG)", domain: "eventbrite.sg", trust_tier: "auto_fetch", robots_allowed: true, notes: "Regional storefront for eventbrite.com; same robots.txt rules. Nearest regional hub to India, so likely to appear on Chennai listings." },
  /*
   * Chennai design communities. Design was the worst-covered field (0 live
   * events) and the diagnosis was not that the queries were wrong — they found
   * exactly the right places — but that these domains sat at curator_only, so
   * every hit queued for a human who never came.
   *
   * Both publish a Crawl-delay we comfortably exceed: our 120/hour is a 30s
   * gap, against their requested 2s and 10s.
   */
  { name: "Friends of Figma (Chennai)", domain: "friends.figma.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Official Friends of Figma Chennai chapter — one of the few consistently active UX/UI communities in the city. robots.txt disallows /health/, /accounts/, /api/, /newsletter/, /gql/, /triggers/, /u/ and /viewserver-health/; chapter and event pages are public and allowed. Crawl-delay: 2." },
  { name: "UMO City Meetups (Chennai)", domain: "meetups.umo.design", trust_tier: "auto_fetch", robots_allowed: true, notes: "Design meetup listings with a Chennai city page. robots.txt disallows only infrastructure paths (/admin/, /includes/, /config/, /logs/, /backup/, /.env, /wp-*). Crawl-delay: 10, well inside our 30s per-domain gap. Upgraded from curator_only — it was queuing design events nobody reviewed." },
  { name: "GDG Community (Google Developer Groups)", domain: "gdg.community.dev", trust_tier: "auto_fetch", robots_allowed: true, notes: "Hosts active GDG Chennai, GDG Cloud Chennai, and multiple GDG on Campus Chennai chapters with confirmed 2026 events (Google I/O Extended Chennai, Chennai Hackfest 2026). robots.txt disallows /accounts/, /api/, /newsletter/, /gql/, /u/ but explicitly permits ClaudeBot on general paths; event listing/detail pages are public." },
  { name: "Hasgeek", domain: "hasgeek.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active pan-India (incl. Chennai-relevant) tech conference/community platform (e.g. The Fifth Elephant). robots.txt only disallows /account and /login; event/proposal pages are public." },
  { name: "ChennaiJS", domain: "chennaijs.dev", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active Chennai JavaScript community, monthly meetups confirmed via search. No robots.txt file exists (genuine 404, not a soft-block), so nothing is disallowed; site is a small static public community page with no login wall." },
  { name: "Chennaipy (Chennai Python User Group)", domain: "chennaipy.org", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active Python community in Chennai (meets at IMSc), listed on python.org's official user group directory. robots.txt contains only 'User-agent: *' with no Disallow rules, i.e. crawling fully allowed." },
  { name: "OWASP Foundation (Chennai Chapter)", domain: "owasp.org", trust_tier: "auto_fetch", robots_allowed: true, notes: "OWASP Chennai chapter page (owasp.org/www-chapter-chennai/) is active with 11+ years of meetups/webinars/conferences. Global owasp.org robots.txt disallows only /membership-success/; chapter pages load with 200 and no login wall." },
  { name: "KonfHub", domain: "konfhub.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active Indian event-ticketing platform used by AWS User Group Chennai and other Indian tech meetups. robots.txt disallows only /cgi-bin/ and explicitly Allows ClaudeBot, GPTBot, PerplexityBot, etc. Event pages are public (confirmed 200)." },
  { name: "91Springboard", domain: "91springboard.com", trust_tier: "curator_only", robots_allowed: false, notes: "Active coworking chain with a confirmed Chennai (Guindy) location hosting founder/community events. robots.txt allows generic User-agent:* but contains explicit 'User-agent: ClaudeBot / Disallow: /' plus blocks for CCBot, GPTBot, Google-Extended, Bytespider, Amazonbot, meta-externalagent — treating this as not safe for auto-fetch." },
  { name: "IIT Madras Research Park", domain: "respark.iitm.ac.in", trust_tier: "curator_only", robots_allowed: true, notes: "Confirmed active, India's first university-based research park in Chennai (Taramani), houses Villgro/IITM Incubation Cell. No robots.txt file present (404, so nothing disallowed) and no login wall found on its events.html page, but the institutional site's event listings are not a dedicated, consistently-updated feed, so kept curator_only for caution despite technical robots allowance." },
  { name: "RTBI / IIT Madras Incubation Cell", domain: "rtbi.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active IIT Madras Incubation Cell (deep-tech startup hub) site. robots.txt (WordPress default) disallows only /wp-admin/ (with admin-ajax allowed); public pages load without login." },
  { name: "StartupTN", domain: "startuptn.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active Tamil Nadu government startup mission (TANSIM), running current events like Tamil Nadu Global Startup Summit and Startup Thiruvizha. robots.txt has an empty Disallow (crawling fully allowed); pages public, no login wall." },
  { name: "Villgro", domain: "villgro.org", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active social-enterprise incubator headquartered at IIT Madras Research Park, Chennai, still actively investing/incubating as of 2026. robots.txt (Yoast default) has empty Disallow, fully crawlable, no login wall." },
  { name: "TiE Chennai", domain: "chennai.tie.org", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active TiE chapter in Chennai (175+ charter members, ~600 associate members), runs TiECON and monthly events; TiECON Chennai 2026 registrations confirmed open. robots.txt has empty Disallow (fully crawlable); upcoming-events page returns 200 with no login wall." },
  { name: "NASSCOM Community", domain: "community.nasscom.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active NASSCOM community portal listing events (e.g. Digital Innovation Conclave 2025, NTC 2025 held in Chennai). robots.txt (Drupal defaults) disallows only /core/, /profiles/, /README.md; /events page confirmed public (200, no login redirect)." },
  { name: "IIT Madras E-Cell", domain: "ecell.iitm.ac.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active IIT Madras student entrepreneurship cell running E-Summit, Young Entrepreneurs @Schools, and other yearlong events. No robots.txt file found (genuine 404), so nothing disallowed; site is public with no login wall (internal 302 redirect to /home is normal app routing)." },
  { name: "Anna University", domain: "annauniv.edu", trust_tier: "curator_only", robots_allowed: true, notes: "Confirmed active public university in Chennai hosting recurring tech/cultural fests (Techofes, Chemfluence, Kalakrithi) but spread across many independent department/college subdomains (e.g. ceg.annauniv.edu) with no unified, reliably-maintained events feed. No robots.txt was found at the root (404, so technically unrestricted), but kept curator_only given the fragmented site structure." },
  { name: "TechnoVIT (VIT Chennai)", domain: "technovit.vit.ac.in", trust_tier: "curator_only", robots_allowed: true, notes: "Confirmed active annual VIT Chennai tech fest site (TechnoVIT'26, 150+ events). No robots.txt found (404), but the homepage/app presents a sign-in modal requiring a VTOP username/password for registration, and the fest microsite is re-created yearly under a versioned subdomain, so marked curator_only despite no explicit robots block." },
  { name: "SRM Institute of Science and Technology", domain: "srmist.edu.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Active university in Chennai (Kattankulathur/Ramapuram campuses) hosting confirmed recent tech fests (Robofest 2025, TEXUS). robots.txt (fetched via www.srmist.edu.in, since the bare apex returned a bot-detection 403) disallows only /wp-admin/; event pages are public with no login wall." },
  { name: "Chennai Data Circle (CDC)", domain: "chennaidatacircle.in", trust_tier: "auto_fetch", robots_allowed: true, notes: "Verified real, active Chennai data community (chennaidatacircle.in, /events page live). robots.txt returns 404 (no such file) — no crawl restrictions in place, safe to auto-fetch public event pages." },
  { name: "AI Tinkerers Chennai", domain: "chennai.aitinkerers.org", trust_tier: "auto_fetch", robots_allowed: true, notes: "Verified real, active subdomain of aitinkerers.org for the Chennai chapter. robots.txt disallows only /signin, /admin/, /api/, RSVP/cancel endpoints, /qrcode/, job-visit tracking — surgical rules that don't block event or content pages." },
  { name: "null - The Open Security Community (Chennai chapter)", domain: "null.community", trust_tier: "auto_fetch", robots_allowed: true, notes: "Confirmed via search — null.community/chapters/8-chennai is the real Chennai chapter page of India's largest open security community. robots.txt contains only commented-out/inactive disallow rules, so effectively no restrictions." },
  { name: "The Product Folks (Grabchai Chennai)", domain: "theproductfolks.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Verified real, active global site with live Chennai chapter (Grabchai) events at theproductfolks.com/grabchai (redirects to www subdomain). robots.txt is served (200, text/plain) but is completely empty — no disallow directives at all." },
  { name: "Chennai Marketers Circle (CMC)", domain: "chennaimarketerscircle.com", trust_tier: "auto_fetch", robots_allowed: true, notes: "Verified real, active independent site (200 OK) for the Chennai marketing community. robots.txt returns 404 (file does not exist) — no crawl restrictions." },
  { name: "IxDF Chennai (Interaction Design Foundation)", domain: "ixdf.org", trust_tier: "curator_only", robots_allowed: false, notes: "Verified real, active Chennai UX chapter at ixdf.org/local-group/asia/india/chennai. robots.txt's generic User-agent:* allows crawling, but a Cloudflare-managed block explicitly disallows ClaudeBot (plus GPTBot, CCBot, Google-Extended, Bytespider, Amazonbot, meta-externalagent) — same pattern as 91springboard.com, treated as not safe for auto-fetch." },
  { name: "UMO City Meetups (UXINDIA Chennai chapter)", domain: "meetups.umo.design", trust_tier: "curator_only", robots_allowed: true, notes: "Real UXINDIA/UMO city-meetup network with a Chennai chapter (also cross-posted to IxDF). robots.txt itself is permissive (10s crawl-delay, blocks only /admin,/includes,/config,/logs,/backup,/wp-admin,/wp-includes), but the homepage timed out on a direct reachability check — kept curator_only out of caution given unconfirmed uptime/latency for reliable auto-fetching." },
  { name: "LinkedIn Events", domain: "linkedin.com", trust_tier: "curator_only", robots_allowed: false, notes: "A large share of Chennai's professional events are announced only as LinkedIn Events, so these must be discoverable — but never auto-fetched. robots.txt broadly disallows crawling and event pages sit behind an interstitial, so a scrape would be both unreliable and unwelcome. /api/cron/discover hard-codes linkedin.com to curator_pending ahead of any trust_tier lookup, and /api/admin/curator/preview refuses to fetch it even on a curator's explicit request: a human opens the post themselves and enters the details." }
];

async function main() {
  let inserted = 0;
  let updated = 0;

  for (const source of sources) {
    const result = await query(
      `INSERT INTO sources (domain, name, trust_tier, robots_allowed, robots_checked_at)
       VALUES ($1,$2,$3,$4, now())
       ON CONFLICT (domain) DO UPDATE SET
         name = EXCLUDED.name,
         trust_tier = EXCLUDED.trust_tier,
         robots_allowed = EXCLUDED.robots_allowed,
         robots_checked_at = now()
       RETURNING xmax = 0 AS inserted`,
      [source.domain, source.name, source.trust_tier, source.robots_allowed],
    );
    if (result.rows[0]?.inserted) {
      inserted += 1;
    } else {
      updated += 1;
    }
  }

  console.log(
    `seed-sources: ${inserted} inserted, ${updated} updated, ${sources.length} total`,
  );

  await pool.end();
  process.exit(0);
}

(async () => {
  try {
    await main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
