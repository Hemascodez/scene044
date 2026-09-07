/** Date reasoning: the gate that decides what reaches the AI pipeline. */
import { datesInSnippet, effectiveEndAt, isPastEvent, snippetLooksPast } from "../lib/eventDates";

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
}

const NOW = Date.parse("2026-09-07T12:00:00+05:30");
const iso = (s: string) => new Date(s).toISOString();

console.log("--- past vs upcoming ---");
check("future event is not past", isPastEvent(iso("2026-09-20T10:00+05:30"), null, NOW), false);
check("event later today is not past", isPastEvent(iso("2026-09-07T19:00+05:30"), null, NOW), false);
check("last month's event is past", isPastEvent(iso("2026-08-12T10:00+05:30"), null, NOW), true);
check("yesterday morning is past", isPastEvent(iso("2026-09-06T09:00+05:30"), null, NOW), true);
check("unknown date is NOT past", isPastEvent(null, null, NOW), false);
check("explicit end respected over start", isPastEvent(iso("2026-09-05T09:00+05:30"), iso("2026-09-30T18:00+05:30"), NOW), false);
check("multi-day still running", isPastEvent(iso("2026-09-06T09:00+05:30"), iso("2026-09-08T18:00+05:30"), NOW), false);
check("assumed duration when no end", effectiveEndAt(iso("2026-09-07T10:00Z"), null) === Date.parse("2026-09-07T16:00Z"), true);

console.log("\n--- the announced-in-June case from the brief ---");
// Announcement date is irrelevant; only the event date counts.
check("Sept event announced in June is upcoming", isPastEvent(iso("2026-09-25T10:00+05:30"), null, NOW), false);
check("August event on a page published today is past", isPastEvent(iso("2026-08-28T10:00+05:30"), null, NOW), true);

console.log("\n--- snippet gate (reject only when ALL dates are past) ---");
check("finds an explicit date", datesInSnippet("Happening on September 20, 2026 in Chennai").length, 1);
check("bare 'Sep 12' with no year is ignored", datesInSnippet("Join us Sep 12 at 10am"), []);
check("all-past snippet rejects", snippetLooksPast("Held on August 12, 2026 in Chennai", NOW), true);
check("future date keeps it", snippetLooksPast("Posted August 1, 2026 · event on October 3, 2026", NOW), false);
check("no dates at all keeps it", snippetLooksPast("A meetup for developers in Chennai", NOW), false);
check("ISO date understood", snippetLooksPast("Event date: 2026-08-01", NOW), true);
check("empty snippet keeps it", snippetLooksPast("", NOW), false);

console.log(`\n${pass} passed, ${fail} failed`);

console.log("\n--- real production snippets: LinkedIn's date-prefix false positives ---");
check(
  "genuinely past (#230, real date mid-text) still rejected",
  snippetLooksPast("We are a community based in Chennai, Date: July 11, 2026 (Saturday)", NOW),
  true,
);
check(
  "genuinely past (#93, prefix AND real date both past) still rejected",
  snippetLooksPast("15 Jan 2025 · Hey All, Join us for the upcoming Null Chennai and OWASP Chennai Chapter monthly meetup! Date: January 18, 2025 Time: 10:00 AM - 1:00 PM", NOW),
  true,
);
check(
  "false positive (#91): index-date prefix, no real date in snippet — no longer rejected",
  snippetLooksPast("19 Apr 2026 · Workshop & National Cyber Security Conference 2026 - Chennai Edition The National Cyber Security Research Council (NCSRC) is proud to", NOW),
  false,
);
check(
  "false positive (#1): same shape — no longer rejected",
  snippetLooksPast("10 May 2026 · Hands-on AI Agent & RAG system building with real-world healthcare use cases. Explore AI + Cloud, DevSecOps, automation, and industry-level", NOW),
  false,
);
check(
  "prefix stripped, but a genuinely past date STILL follows it — must still reject",
  snippetLooksPast("19 Apr 2026 · This meetup happened on March 1, 2026 and was great", NOW),
  true,
);


console.log("\n--- the real bug: pipeline.ts calls with `${title} ${snippet}`, prefix mid-string ---");
import { stripSnippetMetadataPrefix } from "../lib/eventDates";

// Exactly how lib/pipeline.ts builds the string: title first, snippet after.
const asPipelineCalls = (title: string, snippet: string) =>
  snippetLooksPast(`${title} ${stripSnippetMetadataPrefix(snippet)}`, NOW);

check(
  "false positive (#91), title+snippet concatenated like the real call site",
  asPipelineCalls(
    "National Cyber Security Research Council's Post - LinkedIn",
    "19 Apr 2026 · Workshop & National Cyber Security Conference 2026 - Chennai Edition The National Cyber Security Research Council (NCSRC) is proud to",
  ),
  false,
);
check(
  "false positive (#1), title+snippet concatenated like the real call site",
  asPipelineCalls(
    "Chennai AI Innovation Meetup 2026 at IIT Madras Research Park - LinkedIn",
    "10 May 2026 · Hands-on AI Agent & RAG system building with real-world healthcare use cases.",
  ),
  false,
);
check(
  "genuinely past (#93), title+snippet concatenated — still correctly rejected",
  asPipelineCalls(
    "Null Chennai post - LinkedIn",
    "15 Jan 2025 · Hey All, Join us for the upcoming Null Chennai and OWASP Chennai Chapter monthly meetup! Date: January 18, 2025 Time: 10:00 AM",
  ),
  true,
);
check(
  "stripping a bare snippet directly still works (the case my first fix tested)",
  stripSnippetMetadataPrefix("19 Apr 2026 · Workshop text").startsWith("Workshop"),
  true,
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
