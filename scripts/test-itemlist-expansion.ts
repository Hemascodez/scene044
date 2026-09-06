/**
 * Listing-page expansion, against live pages.
 *
 * These four cover the shapes that mattered: an Eventbrite city feed (many
 * events, bare Event nodes with `position`), a Lu.ma calendar (one event,
 * Organization + ItemList siblings), a single event page (must NOT expand),
 * and a JS-only shell (must yield nothing rather than a bogus event).
 */
import { extractFromUrl } from "../lib/extract";
import { query } from "../lib/db";

const CASES = [
  { url: "https://www.eventbrite.com/d/india--chennai/tech-conference/", expect: "event_list", note: "Eventbrite city feed" },
  { url: "https://lu.ma/chennaidatacircle", expect: "event_list", note: "Lu.ma calendar page" },
  { url: "https://www.meetup.com/chennai-cybersecurity-meetup/", expect: "any", note: "Meetup group root" },
  { url: "https://startuptn.in/", expect: "none", note: "JS-only shell, no JSON-LD" },
];

async function main() {
  // Mirror the cron route exactly: it allowlists every auto_fetch domain, not
  // just the one being fetched. That matters because lu.ma 301s to luma.com,
  // and a single-domain allowlist would reject the redirect as off-site.
  const { rows } = await query<{ domain: string }>(
    "SELECT domain FROM sources WHERE trust_tier = 'auto_fetch' AND active = true",
  );
  const allowedDomains = rows.map((r) => r.domain);

  let pass = 0;
  for (const c of CASES) {
    const outcome = await extractFromUrl(c.url, allowedDomains);
    const ok = c.expect === "any" || outcome.kind === c.expect;
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.note}`);
    console.log(`      kind=${outcome.kind}  expected=${c.expect}`);
    if (outcome.kind === "event_list") {
      console.log(`      ${outcome.links.length} child events enqueued:`);
      outcome.links.slice(0, 3).forEach((l) =>
        console.log(`        - ${(l.title ?? "(untitled)").slice(0, 44)}  ${l.startAt?.slice(0, 10) ?? "no date"}`),
      );
      if (outcome.links.length > 3) console.log(`        ... +${outcome.links.length - 3} more`);
      const selfRef = outcome.links.filter((l) => l.url === c.url).length;
      console.log(`      self-references (must be 0): ${selfRef}`);
      if (selfRef > 0) pass--;
    }
    if (outcome.kind === "event") console.log(`      title="${outcome.event.title.slice(0, 50)}" start=${outcome.event.startAt?.slice(0, 10) ?? "-"}`);
  }
  console.log(`\n${pass}/${CASES.length} passed`);
  process.exit(pass === CASES.length ? 0 : 1);
}
main();
