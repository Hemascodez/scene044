import type { MetadataRoute } from "next";

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => XML_ENTITIES[character]);
}

/** Next's metadata sitemap serializer interpolates URLs without XML escaping.
 * Encode at this output boundary, not in stored URLs or shared URL helpers:
 * an XML reader must recover the original URL, including its query string.
 */
export function escapeSitemapUrls(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  return entries.map((entry) => ({
    ...entry,
    url: escapeXml(entry.url),
    ...(entry.images ? { images: entry.images.map(escapeXml) } : {}),
    ...(entry.alternates?.languages
      ? {
          alternates: {
            ...entry.alternates,
            languages: Object.fromEntries(
              Object.entries(entry.alternates.languages).map(([language, url]) => [
                language,
                url ? escapeXml(url) : url,
              ]),
            ),
          },
        }
      : {}),
  }));
}
