/** Read-only, single-public-page probe. No DB import, poster downloads or
 * publishing. --render may use ONE Firecrawl request; --model opts into AI
 * extraction when structured data isn't available. Neither is on by default. */
import { fetchEventPage } from "../lib/eventPageFetch";
import { extractEventDocument, extractModel } from "../lib/extract";
import { automaticPublicationIssue } from "../lib/eventIngestionQuality";
import { categorizeEvent } from "../lib/categorize";
import { summarizeEvent } from "../lib/summarize";

async function main() {
  const at = process.argv.indexOf("--url");
  if (at < 0 || !process.argv[at + 1]) throw new Error("Pass --url <public-event-or-feed-url>");
  const url = new URL(process.argv[at + 1]);
  if (url.protocol !== "https:" || url.username || url.password || url.port || url.search) throw new Error("Use a public HTTPS URL without credentials, query or custom port");
  const host = url.hostname.replace(/^www\./, "");
  if (!["luma.com", "lu.ma", "meetup.com", "kynhood.com"].includes(host)) throw new Error("Probe is restricted to the requested public platforms");
  if (process.argv.includes("--render")) {
    process.env.EVENT_RENDER_ENABLED = "true"; process.env.EVENT_RENDER_LIMIT = "1";
  } else process.env.EVENT_RENDER_ENABLED = "false";
  const result = await fetchEventPage(url.toString(), ["luma.com", "lu.ma", "meetup.com", "kynhood.com"]);
  if (!result.ok) { console.log(JSON.stringify({ url: url.toString(), outcome: result.reason, databaseWrites: 0 })); return; }
  const model = process.argv.includes("--model") ? extractModel() : null;
  const outcome = await extractEventDocument(result.text, result.finalUrl, model);
  let assessment: unknown;
  if (process.argv.includes("--assess") && outcome.kind === "event") {
    const e = outcome.event;
    const category = await categorizeEvent({ title: e.title, summary: e.summary, venueAddress: e.venueAddress, isOnline: e.isOnline });
    const editorial = category.category ? await summarizeEvent({ ...e, category: category.category, rawSummary: e.summary, supportingText: outcome.supportingText }) : null;
    assessment = { category: category.category, classificationError: !!category.classificationError,
      editorialStatus: editorial?.generationStatus ?? "not_run", hasDescription: !!editorial?.eventIntro };
  }
  console.log(JSON.stringify({ url: result.finalUrl, bytes: result.text.length, databaseWrites: 0, modelExtractionEnabled: !!model,
    assessment,
    result: outcome.kind === "event" ? { kind: outcome.kind, title: outcome.event.title,
      startAt: outcome.event.startAt, city: outcome.event.city,
      reviewReason: automaticPublicationIssue(outcome.event, outcome.supportingText) }
      : outcome.kind === "event_list" ? { kind: outcome.kind, count: outcome.links.length, sample: outcome.links.slice(0, 3) } : outcome }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Probe failed"); process.exitCode = 1; });
