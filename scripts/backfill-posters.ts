/**
 * Re-attempts posters for live events that fell back to category art.
 *
 * Runs the same selection the pipeline now uses (JSON-LD image, then og:image,
 * then twitter:image — resolved to absolute, platform placeholders rejected),
 * so existing listings match newly discovered ones.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-posters.ts          # preview
 *   npx tsx --env-file=.env.local scripts/backfill-posters.ts --write  # apply
 */
import { pool, query } from "../lib/db";
import { extractFromUrl } from "../lib/extract";
import { importPosterFromUrl } from "../lib/posterStore";

const WRITE = process.argv.includes("--write");

async function main() {
  const { rows: allowed } = await query<{ domain: string }>(
    "SELECT domain FROM sources WHERE trust_tier='auto_fetch' AND active = true",
  );
  const allowedDomains = allowed.map((r) => r.domain);

  const { rows } = await query<{ id: number; title: string; primary_source_url: string }>(
    `SELECT id, title, primary_source_url FROM events
      WHERE status IN ('live','updated') AND poster_image_url IS NULL ORDER BY id`,
  );

  console.log(`${rows.length} event(s) without a poster — ${WRITE ? "WRITING" : "dry run"}\n`);
  let recovered = 0;

  for (const ev of rows) {
    let host: string;
    try {
      host = new URL(ev.primary_source_url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }

    const outcome = await extractFromUrl(ev.primary_source_url, [...allowedDomains, host]);
    const found = outcome.kind === "event" ? outcome.event.posterImageUrl : null;

    if (!found) {
      console.log(`#${ev.id} ${ev.title.slice(0, 46)}\n   no usable image published — category art is correct\n`);
      continue;
    }

    const imported = await importPosterFromUrl(found, "auto");
    if (!imported.ok) {
      console.log(`#${ev.id} ${ev.title.slice(0, 46)}\n   found ${found.slice(0, 70)}\n   IMPORT FAILED: ${imported.error}\n`);
      continue;
    }

    recovered++;
    console.log(`#${ev.id} ${ev.title.slice(0, 46)}\n   RECOVERED -> ${imported.url}\n`);
    if (WRITE) {
      await query("UPDATE events SET poster_image_url = $1, updated_at = now() WHERE id = $2", [
        imported.url,
        ev.id,
      ]);
    }
  }

  console.log(`${recovered}/${rows.length} recoverable`);
  if (!WRITE) console.log("Dry run — nothing written. Re-run with --write to apply.");
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => pool.end());
