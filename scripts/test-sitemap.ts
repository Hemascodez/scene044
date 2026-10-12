import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { load } from "cheerio";
import type { MetadataRoute } from "next";
import { escapeSitemapUrls } from "../lib/sitemapXml";

const require = createRequire(import.meta.url);
// Exercise the installed framework serializer, not a second test-only writer.
const { resolveSitemap } = require("next/dist/build/webpack/loaders/metadata/resolve-route-data") as {
  resolveSitemap(entries: MetadataRoute.Sitemap): string;
};

// The Eventbrite poster query below caused the production line-527 error.
const poster = "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F1193739602%2F471394649775%2F1%2Foriginal.20260917-115036?crop=focalpoint&fit=crop&w=940&auto=format%2Ccompress&q=75&sharp=10&fp-x=0.486&fp-y=0.537&s=19a179f52dd8ba07deb1f8cf94f1729b";
const entries: MetadataRoute.Sitemap = [
  {
    url: "https://scene044.in/events/example-37?one=1&two=2",
    images: [poster, "https://example.com/image.png?label=<art>&quote=\"yes\"&name=O'Brien"],
    lastModified: new Date("2026-10-13T00:00:00.000Z"),
    changeFrequency: "weekly",
    priority: 0.7,
    alternates: { languages: { ta: "https://scene044.in/ta?one=1&label=\"சென்னை\"" } },
  },
  { url: "https://scene044.in/venues/time-cafe", images: [] },
  // A literal entity-looking query value must survive without being decoded.
  { url: "https://scene044.in/events/literal-1?value=&amp;" },
];
const original = structuredClone(entries);
const encoded = escapeSitemapUrls(entries);
const xml = resolveSitemap(encoded);
assert.deepEqual(entries, original, "escaping must not change stored/shared URLs");
assert.notEqual(encoded, entries, "escaping should return new metadata entries");
assert.equal(encoded[0].lastModified, entries[0].lastModified, "dates must remain dates");
assert.match(xml, /crop=focalpoint&amp;fit=crop&amp;w=940/);
assert.match(xml, /&lt;art&gt;/);
assert.match(xml, /&quot;yes&quot;/);
assert.match(xml, /O&apos;Brien/);
assert.doesNotMatch(xml, /&(?!amp;|lt;|gt;|quot;|apos;)/, "no unescaped ampersands");
const parsed = load(xml, { xmlMode: true });
assert.deepEqual(parsed("url > loc").toArray().map((node) => parsed(node).text()), entries.map((entry) => entry.url), "page URLs must round-trip through XML unchanged");
assert.deepEqual(parsed("image\\:loc").toArray().map((node) => parsed(node).text()), entries.flatMap((entry) => entry.images ?? []), "image query strings must round-trip unchanged");
assert.equal(parsed("xhtml\\:link").attr("href"), entries[0].alternates?.languages?.ta, "alternate URL attributes must round-trip unchanged");
assert.equal(parsed("lastmod").text(), "2026-10-13T00:00:00.000Z");
assert.equal(parsed("urlset").attr("xmlns:image"), "http://www.google.com/schemas/sitemap-image/1.1");
const strict = spawnSync("xmllint", ["--nonet", "--noout", "-"], { input: xml, encoding: "utf8" });
if (strict.error && (strict.error as NodeJS.ErrnoException).code !== "ENOENT") throw strict.error;
if (!strict.error) assert.equal(strict.status, 0, `strict XML validation failed: ${strict.stderr}`);
console.log(`PASS sitemap XML escaping, framework serialization, URL round-trips and preserved metadata${strict.error ? " (xmllint unavailable)" : ", strict XML parsing"}`);
