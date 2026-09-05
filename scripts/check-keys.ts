/**
 * Verifies every external credential with the smallest possible real call,
 * and never prints a secret — only its length and the API's verdict.
 *
 * Run: node --env-file=.env.local --import tsx scripts/check-keys.ts
 */
import { extractModel, curatorModel } from "@/lib/extract";
import { selectSearchProvider, MissingSearchCredentialsError } from "@/lib/search";

function shape(name: string): string {
  const v = process.env[name];
  if (v === undefined) return "MISSING";
  if (v === "") return "EMPTY";
  return `set (${v.length} chars)`;
}

async function checkOpenAI(model: string, label: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return console.log(`  ${label.padEnd(22)} SKIPPED — OPENAI_API_KEY empty`);
  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: key });
    const res = await client.responses.create({
      model,
      instructions: "Reply with exactly: ok",
      input: [{ role: "user", content: "ping" }],
    });
    const text = JSON.stringify(res.output).slice(0, 60);
    console.log(`  ${label.padEnd(22)} OK   model=${model}  ->  ${text}`);
  } catch (err) {
    console.log(`  ${label.padEnd(22)} FAIL model=${model}  ->  ${String(err).slice(0, 160)}`);
  }
}

async function checkFirecrawl() {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return console.log("  firecrawl             SKIPPED — FIRECRAWL_API_KEY empty");
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "AI meetup Chennai",
        limit: 3,
        sources: ["web"],
        includeDomains: ["linkedin.com"],
        location: "Chennai,Tamil Nadu,India",
        country: "IN",
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      data?: { web?: { url: string; title?: string }[] };
      creditsUsed?: number;
      error?: string;
    } | null;
    if (!res.ok) {
      return console.log(`  firecrawl             FAIL ${res.status} -> ${(body?.error ?? "").slice(0, 140)}`);
    }
    const hits = body?.data?.web ?? [];
    console.log(`  firecrawl             OK   ${hits.length} result(s), creditsUsed=${body?.creditsUsed ?? "?"}`);
    for (const h of hits) console.log(`      - ${h.url}`);
    if (hits.length === 0) console.log("      ^ zero results for a LinkedIn-scoped query — worth a manual retry");
  } catch (err) {
    console.log(`  firecrawl             FAIL -> ${String(err).slice(0, 160)}`);
  }
}

async function checkGoogleCse() {
  const key = process.env.GOOGLE_CSE_API_KEY;
  const cx = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return console.log("  google cse            SKIPPED — key or cx empty");
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent("AI meetup Chennai site:linkedin.com/events")}&num=3`;
  try {
    const res = await fetch(url);
    const body = (await res.json()) as {
      items?: { link: string; title: string }[];
      error?: { message: string };
      searchInformation?: { totalResults: string };
    };
    if (!res.ok) return console.log(`  google cse            FAIL ${res.status} -> ${body.error?.message?.slice(0, 140)}`);
    const n = body.items?.length ?? 0;
    console.log(`  google cse            OK   ${n} result(s), totalResults=${body.searchInformation?.totalResults ?? "?"}`);
    for (const item of body.items ?? []) console.log(`      - ${item.link}`);
    if (n === 0) {
      console.log("      ^ zero results usually means the search engine is NOT set to");
      console.log('        "Search the entire web" — fix that in the control panel.');
    }
  } catch (err) {
    console.log(`  google cse            FAIL -> ${String(err).slice(0, 160)}`);
  }
}

(async () => {
  console.log("=== credential shapes (values never printed) ===");
  for (const k of ["DATABASE_URL", "FIRECRAWL_API_KEY", "SEARCH_PROVIDER", "GOOGLE_CSE_API_KEY", "GOOGLE_CSE_CX", "OPENAI_API_KEY", "EXTRACT_MODEL", "CURATOR_MODEL", "CURATOR_PASSWORD", "CRON_SECRET"]) {
    console.log(`  ${k.padEnd(22)} ${shape(k)}`);
  }
  console.log("\n=== active search provider ===");
  try {
    const p = selectSearchProvider();
    console.log(`  ${p.name}  (suggested ${p.suggestedQueriesPerRun} queries per discover run)`);
  } catch (err) {
    console.log(`  NONE — ${err instanceof MissingSearchCredentialsError ? err.message : String(err).slice(0, 160)}`);
  }

  console.log("\n=== live checks ===");
  await checkFirecrawl();
  await checkGoogleCse();
  await checkOpenAI(extractModel(), "openai (bulk)");
  if (curatorModel() !== extractModel()) await checkOpenAI(curatorModel(), "openai (curator)");
  process.exit(0);
})();
