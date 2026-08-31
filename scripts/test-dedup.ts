import { pool, query } from "../lib/db";
import {
  findDuplicateEvent,
  DEDUP_HIGH_CONFIDENCE_THRESHOLD,
  DEDUP_LOW_CONFIDENCE_THRESHOLD,
} from "../lib/dedup";

async function main() {
  const startAt = new Date(Date.now() + 7 * 86_400_000).toISOString();

  const {
    rows: [existing],
  } = await query<{ id: number }>(
    `INSERT INTO events (title, category, start_at, is_online, venue_name, organizer_name, primary_source_url, source_type, chennai_relevance_score, status, last_verified_at)
     VALUES ('AI Meetup Chennai', 'ai', $1, false, 'IIT Madras Research Park', 'Chennai AI Devs', 'https://example.com/test-dedup-original', 'auto', 1.0, 'live', now())
     RETURNING id`,
    [startAt],
  );
  console.log(`Seeded existing event #${existing.id}: "AI Meetup Chennai"`);

  const cases: { label: string; title: string; venueName: string; expect: string }[] = [
    { label: "reordered + punctuation", title: "Chennai, AI Meetup!", venueName: "IIT Madras Research Park", expect: "HIGH (merge)" },
    { label: "different venue, same title/date", title: "AI Meetup Chennai", venueName: "Some Other Venue", expect: "still likely HIGH (title+date dominate)" },
    { label: "unrelated event, same date", title: "Chennai Marketing Summit", venueName: "Taj Coromandel", expect: "LOW (new event)" },
  ];

  for (const c of cases) {
    const dup = await findDuplicateEvent({
      title: c.title,
      startAt,
      isOnline: false,
      venueName: c.venueName,
      organizerName: "Chennai AI Devs",
      category: "ai",
      url: `https://example.com/test-dedup-${encodeURIComponent(c.label)}`,
    });
    const score = dup?.score ?? 0;
    const tier =
      score >= DEDUP_HIGH_CONFIDENCE_THRESHOLD
        ? "HIGH (merge)"
        : score >= DEDUP_LOW_CONFIDENCE_THRESHOLD
          ? "MEDIUM (curator review)"
          : "LOW (new event)";
    console.log(`[${c.label}] "${c.title}" @ "${c.venueName}" -> score=${score.toFixed(3)} -> ${tier} (expected: ${c.expect})`);
  }

  await query("DELETE FROM events WHERE primary_source_url LIKE 'https://example.com/test-dedup%'");
  console.log("\nCleaned up test fixture rows.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
