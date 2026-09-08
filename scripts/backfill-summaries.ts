/**
 * Rebuilds editorial descriptions and perks for existing live events.
 *
 * The JSON-LD path wrote `description` straight through, so live events carry
 * the organizer's full copy — markdown, emoji, waitlist boilerplate and all.
 * This runs the same lib/summarize.ts pass the pipeline now applies, so
 * existing listings match new ones.
 *
 *   npm run backfill:event-copy                     # preview
 *   npm run backfill:event-copy -- --write          # apply
 */
import { pool, query } from "../lib/db";
import { normalizeDomain } from "../lib/domain";
import { extractFromUrl } from "../lib/extract";
import { summarizeEvent } from "../lib/summarize";

const WRITE = process.argv.includes("--write");

async function main() {
  const { rows } = await query<{
    id: number; title: string; summary: string | null; category: string;
    organizer_name: string | null; registration_deadline: string | null;
    start_at: string | null; end_at: string | null; is_online: boolean;
    venue_name: string | null; venue_address: string | null;
    price_type: "free" | "paid" | null; price_note: string | null;
    primary_source_url: string;
  }>(
    `SELECT id, title, summary, category, organizer_name, registration_deadline,
            start_at, end_at, is_online, venue_name, venue_address, price_type, price_note,
            primary_source_url
      FROM events
      WHERE status IN ('live','updated')
      ORDER BY length(summary) DESC NULLS LAST`,
  );

  console.log(`${rows.length} event(s) to process — ${WRITE ? "WRITING" : "dry run"}\n`);

  for (const ev of rows) {
    const before = ev.summary?.length ?? 0;
    let sourceSummary = ev.summary;
    let supportingText: string | null = null;

    // A previous interrupted/invalid backfill may have left the editorial
    // summary empty. Recover the organizer's description from the canonical
    // source before asking the model to write again; title/date/venue alone do
    // not provide enough evidence for useful event copy or attendee outcomes.
    if (!sourceSummary?.trim()) {
      const refreshed = await extractFromUrl(
        ev.primary_source_url,
        [normalizeDomain(ev.primary_source_url)],
      );
      if (refreshed.kind === "event") {
        sourceSummary = refreshed.event.summary;
        supportingText = refreshed.supportingText;
        console.log(`#${ev.id} recovered source copy before regeneration`);
      }
    }

    const out = await summarizeEvent({
      title: ev.title,
      rawSummary: sourceSummary,
      category: ev.category,
      organizerName: ev.organizer_name,
      startAt: ev.start_at,
      endAt: ev.end_at,
      isOnline: ev.is_online,
      venueName: ev.venue_name,
      venueAddress: ev.venue_address,
      priceType: ev.price_type,
      priceNote: ev.price_note,
      registrationDeadline: ev.registration_deadline,
      supportingText,
    });
    const after = out.eventIntro?.length ?? 0;
    const words = out.eventIntro ? out.eventIntro.trim().split(/\s+/).length : 0;

    console.log(`#${ev.id} ${ev.title.slice(0, 52)}`);
    console.log(`   ${before} -> ${after} chars (${words} words)`);
    console.log(`   ${out.eventIntro ?? "(none)"}`);
    console.log(`   why attend: ${out.whyAttend.length ? out.whyAttend.join(" · ") : "(none — description was vague)"}`);
    console.log(`   registration: ${out.registrationNote ?? "(no deadline published)"}`);
    console.log(`   generation: ${out.generationStatus}\n`);

    // A transient API/configuration error must never erase previously stored
    // copy. "insufficient" is different: the model completed normally and
    // explicitly found that the evidence did not support publishable copy.
    if (WRITE && out.generationStatus !== "error") {
      await query(
        `UPDATE events
            SET summary = COALESCE($1, summary),
                highlights = $2,
                registration_note = $3,
                updated_at = now()
          WHERE id = $4`,
        [out.eventIntro, out.whyAttend, out.registrationNote, ev.id],
      );
    } else if (WRITE) {
      console.log("   skipped write because generation failed\n");
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
