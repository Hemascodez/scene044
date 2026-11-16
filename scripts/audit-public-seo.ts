/** Read-only, bounded public SEO crawl. Never fetches account, host or admin data.
 * Run: node --import tsx scripts/audit-public-seo.ts
 * Audit output is generated outside the checkout under /tmp/scene044.in-audit.
 */
import { load } from 'cheerio';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const base = new URL('https://scene044.in');
const output = '/tmp/scene044.in-audit';
const limit = 500;
const timeout = 30_000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const publicPath = (path: string) => path === '/' || /^\/(?:events\/[^/]+|events\/chennai\/[^/]+|category\/[^/,]+|venues(?:\/[^/]+)?|privacy|terms|account\/delete)\/?$/.test(path);

async function request(url: string) {
  let current = url;
  for (let hop = 0; hop <= 3; hop++) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(timeout) });
    if (response.status === 429) throw new Error('Rate limited; stopping crawl');
    const location = response.headers.get('location');
    if (location && response.status >= 300 && response.status < 400) {
      const next = new URL(location, current);
      if (next.origin !== base.origin || !publicPath(next.pathname) || next.search) {
        return { response, finalUrl: current, text: '', redirect: next.href };
      }
      current = next.href;
      continue;
    }
    return { response, finalUrl: current, text: await response.text(), redirect: null };
  }
  throw new Error('More than three redirects');
}

async function main() {
  await mkdir(output, { recursive: true });
  const robotsResponse = await fetch(new URL('/robots.txt', base), { signal: AbortSignal.timeout(timeout) });
  if (!robotsResponse.ok) throw new Error(`robots.txt returned ${robotsResponse.status}`);
  const robots = await robotsResponse.text();
  const rules: { prefix: string; allow: boolean }[] = [];
  let universal = false;
  for (const line of robots.split(/\r?\n/)) {
    const match = line.replace(/#.*/, '').trim().match(/^(user-agent|allow|disallow):\s*(.*)$/i);
    if (!match) continue;
    if (match[1].toLowerCase() === 'user-agent') universal = match[2] === '*';
    else if (universal && match[2]) rules.push({ prefix: match[2], allow: match[1].toLowerCase() === 'allow' });
  }
  const allowed = (path: string) => rules.filter(rule => path.startsWith(rule.prefix)).sort((a, b) => b.prefix.length - a.prefix.length || Number(b.allow) - Number(a.allow))[0]?.allow !== false;
  const xmlResponse = await fetch(new URL('/sitemap.xml', base), { signal: AbortSignal.timeout(timeout) });
  if (!xmlResponse.ok) throw new Error(`Sitemap returned ${xmlResponse.status}`);
  const xml = await xmlResponse.text();
  const xmlValidation = spawnSync('xmllint', ['--noout', '-'], { input: xml, encoding: 'utf8' });
  if (xmlValidation.status !== 0) throw new Error(`Strict XML validation failed: ${xmlValidation.stderr}`);
  await writeFile(`${output}/sitemap.xml`, xml);
  const sitemap = load(xml, { xmlMode: true });
  const sitemapUrls = sitemap('url > loc').map((_, el) => sitemap(el).text()).get();
  // URL() normalizes a bare origin to '/', avoiding two requests for one page.
  const sitemapSet = new Set(sitemapUrls.map(url => new URL(url).href));
  const queue = [...sitemapSet];
  const seen = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const errors: Record<string, string>[] = [];
  for (let offset = 0; offset < queue.length && seen.size < limit; offset += 5) {
    const batch = queue.slice(offset, offset + Math.min(5, limit - seen.size));
    await Promise.all(batch.map(async url => {
      if (seen.has(url)) return;
      seen.add(url);
      const parsed = new URL(url);
      if (parsed.origin !== base.origin || parsed.search || !publicPath(parsed.pathname) || !allowed(parsed.pathname)) {
        errors.push({ url, error: 'Skipped: outside allowed public crawl scope or robots rules' });
        return;
      }
      try {
        const result = await request(url);
        const $ = load(result.text);
        const schema: unknown[] = [];
        let invalidJsonLd = 0;
        $('script[type="application/ld+json"]').each((_, el) => {
          try { schema.push(JSON.parse($(el).text())); } catch { invalidJsonLd++; }
        });
        rows.push({
          url, inSitemap: sitemapSet.has(url), status: result.response.status,
          finalUrl: result.finalUrl, redirect: result.redirect,
          title: $('title').text(), description: $('meta[name="description"]').attr('content') ?? null,
          canonical: $('link[rel="canonical"]').attr('href') ?? null,
          robots: $('meta[name="robots"]').attr('content') ?? null,
          xRobotsTag: result.response.headers.get('x-robots-tag'),
          h1Count: $('h1').length, h1: $('h1').map((_, el) => $(el).text()).get(),
          missingImageAlt: $('img:not([alt])').length, invalidJsonLd, schema,
        });
        for (const el of $('a[href]').toArray()) {
          const link = new URL($(el).attr('href')!, result.finalUrl);
          link.hash = '';
          if (link.origin === base.origin && !link.search && publicPath(link.pathname) && allowed(link.pathname) && !seen.has(link.href) && !queue.includes(link.href)) queue.push(link.href);
        }
      } catch (error) {
        errors.push({ url, error: error instanceof Error ? error.message : String(error) });
        if (String(error).includes('Rate limited')) throw error;
      }
    }));
    console.log(`Crawled ${rows.length}; errors ${errors.length}; discovered ${queue.length}`);
    await sleep(1000);
  }
  const problems = rows.filter(row => row.status !== 200 || row.url !== row.finalUrl || !row.title || !row.description || row.h1Count !== 1 || !row.canonical || row.invalidJsonLd || /noindex/i.test(String(row.robots)));
  const audit = {
    checkedAt: new Date().toISOString(), origin: base.origin, sitemapContentType: xmlResponse.headers.get('content-type'),
    strictXmlValid: true, sitemapUrlCount: sitemapUrls.length, uniqueSitemapUrlCount: new Set(sitemapUrls).size,
    crawledCount: rows.length, maxPages: limit, robotsRespected: true, errors,
    notMeasured: ['Core Web Vitals field data', 'Backlinks', 'Google rankings', 'Rendered mobile usability'],
    problems, rows,
  };
  await writeFile(`${output}/audit-data.json`, JSON.stringify(audit, null, 2));
  console.log(JSON.stringify({ output, sitemapUrlCount: sitemapUrls.length, crawled: rows.length, problems: problems.length, errors }, null, 2));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
