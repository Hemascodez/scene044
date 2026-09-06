/**
 * Re-summarises events whose description was stored verbatim.
 *
 * The JSON-LD path wrote `description` straight through, so live events carry
 * the organizer's full copy — markdown, emoji, waitlist boilerplate and all.
 * This runs the same lib/summarize.ts pass the pipeline now applies, so
 * existing listings match new ones.
 *
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts          # preview
 *   npx tsx --env-file=.env.local scripts/backfill-summaries.ts --write  # apply
 */
import { pool, query } from "../lib/db";
import { summarizeEvent } from "../lib/summarize";

const WRITE = process.argv.includes("--write");

async function main() {
  const { rows } = await query<{ id: number; title: string; summary: string | null }>(
    `SELECT id, title, summary FROM events
      WHERE status IN ('live','updated') AND summary IS NOT NULL
        AND cardinality(highlights) = 0
      ORDER BY length(summary) DESC`,
  );

  console.log(`${rows.length} event(s) to process — ${WRITE ? "WRITING" : "dry run"}\n`);

  for (const ev of rows) {
    const before = ev.summary?.length ?? 0;
    const out = await summarizeEvent({ title: ev.title, rawSummary: ev.summary });
    const after = out.summary?.length ?? 0;

    console.log(`#${ev.id} ${ev.title.slice(0, 52)}`);
    console.log(`   ${before} -> ${after} chars`);
    console.log(`   ${out.summary?.slice(0, 150) ?? "(none)"}`);
    console.log(`   highlights: ${out.highlights.length ? out.highlights.join(" · ") : "(none — description was vague)"}\n`);

    if (WRITE) {
      await query("UPDATE events SET summary = $1, highlights = $2, updated_at = now() WHERE id = $3", [
        out.summary,
        out.highlights,
        ev.id,
      ]);
    }
  }

  if (!WRITE) console.log("Dry run — nothing written. Re-run with --write to apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
