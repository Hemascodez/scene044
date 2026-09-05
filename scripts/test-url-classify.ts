/** Checks hub-vs-event classification against the exact URLs that failed the
 *  first real discovery run. */
import { classifyEventUrl } from "@/lib/eventUrlPatterns";

const CASES: [string, "event" | "hub" | "unknown"][] = [
  // Hubs that wasted a fetch + LLM call in the first live run:
  ["https://www.meetup.com/chennai-meetup-group/", "hub"],
  ["https://www.meetup.com/chennai-artificial-intelligence-meetup-group/", "hub"],
  ["https://www.meetup.com/find/in--chennai/ai/", "hub"],
  ["https://www.eventbrite.com/d/india--chennai/tech-meetup/", "hub"],
  ["https://www.eventbrite.com/d/india--chennai/technology-conference/", "hub"],
  ["https://lu.ma/discover", "hub"],
  // Real event pages that must still get through:
  ["https://www.meetup.com/chennai-ai-developers-group/events/312345678/", "event"],
  ["https://www.eventbrite.com/e/aicon-chennai-2026-tickets-123456789", "event"],
  ["https://lu.ma/event/evt-cHNOOFps6VrrGk4", "event"],
  ["https://gdg.community.dev/events/details/google-gdg-chennai-presents-x/", "event"],
  // Unknown domains must not be judged at all:
  ["https://chennai.aitinkerers.org/", "unknown"],
  ["https://konfhub.com/age-tech-founders-meetup-chennai-chapter", "unknown"],
  ["https://some-random-college.edu.in/fest2026", "unknown"],
  ["not a url", "unknown"],
];

let bad = 0;
for (const [url, expected] of CASES) {
  const got = classifyEventUrl(url);
  if (got === expected) {
    console.log(`  PASS  ${expected.padEnd(8)} ${url.slice(0, 66)}`);
  } else {
    bad++;
    console.log(`  FAIL  expected ${expected}, got ${got}  ${url}`);
  }
}
console.log(`\n${CASES.length - bad}/${CASES.length} passed`);
process.exit(bad ? 1 : 0);
