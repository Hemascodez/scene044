import { normalizeDomain } from "./domain";
import { safeFetchText, type SafeFetchResult } from "./safeFetch";
import { load } from "cheerio";
import { kynEmbeddedSchema } from "./kynEventAdapter";

const BOT = "chennaieventsbot"; // matches the existing fetcher's User-Agent
const policies = new Map<string, { until: number; text: string | null }>();
let renderBudget = { window: 0, used: 0 };

/** RFC-style group selection, wildcards, terminal $, longest rule and Allow
 * tie-break. Repeated wildcard groups (Meetup) are combined, not overwritten. */
export function robotsAllows(text: string, url: string): boolean {
  const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
  let group = { agents: [] as string[], rules: [] as { allow: boolean; path: string }[] };
  let hasDirectives = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === "user-agent") {
      if (hasDirectives) { groups.push(group); group = { agents: [], rules: [] }; hasDirectives = false; }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) {
      hasDirectives = true;
      if ((key === "allow" || key === "disallow") && value) group.rules.push({ allow: key === "allow", path: value });
    }
  }
  if (group.agents.length) groups.push(group);
  const specificity = (agents: string[]) => Math.max(-1, ...agents.map(a => a === "*" ? 0 : BOT.includes(a) ? a.length : -1));
  const best = Math.max(-1, ...groups.map(g => specificity(g.agents)));
  const path = new URL(url).pathname + new URL(url).search;
  let winner = { length: -1, allow: true };
  for (const g of groups.filter(g => specificity(g.agents) === best && best >= 0)) {
    for (const rule of g.rules) {
      const terminal = rule.path.endsWith("$");
      const body = terminal ? rule.path.slice(0, -1) : rule.path;
      const pattern = body.split("*").map(p => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*");
      const length = body.replace(/\*/g, "").length;
      if (new RegExp(`^${pattern}${terminal ? "$" : ""}`).test(path)
        && (length > winner.length || (length === winner.length && rule.allow))) winner = { length, allow: rule.allow };
    }
  }
  return winner.allow;
}

async function checkRobots(url: string, allowedDomains: string[]) {
  const origin = new URL(url).origin;
  let cached = policies.get(origin);
  if (!cached || cached.until < Date.now()) {
    const result = await safeFetchText(`${origin}/robots.txt`, { allowedDomains, allowPlainText: true, maxBytes: 64_000, timeoutMs: 8_000 });
    const text = result.ok ? result.text : ["http_404", "http_410"].includes(result.reason) ? "" : null;
    cached = { text, until: Date.now() + (text === null ? 60_000 : 3_600_000) };
    policies.set(origin, cached);
  }
  if (cached.text === null) return { ok: false as const, reason: "robots_unavailable" };
  return robotsAllows(cached.text, url) ? { ok: true as const } : { ok: false as const, reason: "robots_disallowed" };
}

/** Public rendering is ONLY for a successfully fetched KYN app shell, never
 * a response to 401/403/429/CAPTCHA. No credentials, stealth proxy or actions. */
export async function fetchEventPage(url: string, allowedDomains: string[]): Promise<SafeFetchResult> {
  const result = await safeFetchText(url, {
    allowedDomains, beforeFetch: candidate => checkRobots(candidate, allowedDomains),
  });
  if (!result.ok || normalizeDomain(result.finalUrl) !== "kynhood.com") return result;
  if (/(?:captcha|verify (?:that )?you are (?:a )?human|access denied|checking your browser|cf-chl-|challenge-platform)/i.test(result.text)) {
    return { ok: false, reason: "access_challenge_review" };
  }
  if (process.env.EVENT_RENDER_ENABLED !== "true" || !process.env.FIRECRAWL_API_KEY) return result;
  if (kynEmbeddedSchema(load(result.text), result.finalUrl)) return result;
  // Server-rendered event data needs no paid rendering.
  if (/application\/ld\+json/i.test(result.text) || /<a\b[^>]*href=["'][^"']*\/event\//i.test(result.text)) return result;
  const target = new URL(result.finalUrl);
  if (target.protocol !== "https:" || target.username || target.password || target.port || target.search) return result;
  if (!/^\/(?:eventhome\/?|event\/[a-f0-9]{24}\/?|eventcategory\/[^/]+\/?)$/i.test(target.pathname)) return result;
  const window = Math.floor(Date.now() / 21_600_000);
  if (renderBudget.window !== window) renderBudget = { window, used: 0 };
  const configured = Number(process.env.EVENT_RENDER_LIMIT ?? 5);
  const limit = Number.isInteger(configured) && configured >= 0 ? Math.min(configured, 20) : 5;
  if (renderBudget.used >= limit) return { ok: false, reason: "render_budget_exhausted" };
  renderBudget.used++;
  try {
    const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST", signal: AbortSignal.timeout(45_000),
      headers: { Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: target.toString(), formats: ["html", "rawHtml"], onlyMainContent: false,
        waitFor: 8000, maxAge: 0, timeout: 35000, proxy: "basic", skipTlsVerification: false, storeInCache: false }),
    });
    if (!response.ok) return { ok: false, reason: `renderer_http_${response.status}` };
    // Enforce a streaming cap rather than buffering arbitrary provider output.
    const reader = response.body?.getReader();
    if (!reader) return { ok: false, reason: "renderer_empty" };
    let size = 0; const chunks: Uint8Array[] = [];
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > 4_000_000) { await reader.cancel(); return { ok: false, reason: "renderer_too_large" }; }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
      success?: boolean; data?: { html?: string; rawHtml?: string; metadata?: { statusCode?: number; url?: string; sourceURL?: string } };
    };
    const finalUrl = data.data?.metadata?.url ?? data.data?.metadata?.sourceURL ?? target.toString();
    if (new URL(finalUrl).origin !== target.origin || new URL(finalUrl).pathname !== target.pathname) return { ok: false, reason: "renderer_redirect_review" };
    if (!(await checkRobots(finalUrl, allowedDomains)).ok) return { ok: false, reason: "robots_disallowed" };
    const status = data.data?.metadata?.statusCode;
    if (status && status >= 400) return { ok: false, reason: `renderer_target_http_${status}` };
    const html = data.data?.html || data.data?.rawHtml;
    return data.success && html ? { ok: true, text: html, finalUrl } : { ok: false, reason: "renderer_no_html" };
  } catch { return { ok: false, reason: "renderer_unavailable" }; }
}
