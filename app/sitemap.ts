import type { MetadataRoute } from "next";
import { FIELD_CARDS } from "@/lib/fieldCards";
import { getPublicEventSitemapEntries } from "@/lib/events";
import { absoluteUrl, eventPath } from "@/lib/seo";
import { stockPosterFor } from "@/lib/stockPosters";

const BASE_URL = "https://scene044.in";

export const dynamic = "force-dynamic";

function validDate(value: string): Date | undefined {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let events: Awaited<ReturnType<typeof getPublicEventSitemapEntries>> = [];
  try {
    events = await getPublicEventSitemapEntries();
  } catch (err) {
    // Keep the sitemap reachable during a transient database outage. Static
    // discovery pages remain useful and event URLs return on the next request.
    console.error("sitemap: failed to load event URLs", err);
  }

  const latestSiteUpdate = events
    .map((event) => validDate(event.updatedAt))
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return [
    {
      url: BASE_URL,
      ...(latestSiteUpdate ? { lastModified: latestSiteUpdate } : {}),
      changeFrequency: "daily",
      priority: 1,
    },
    ...FIELD_CARDS.map((card) => {
      const lastModified = events
        .filter((event) => card.categories.includes(event.category))
        .map((event) => validDate(event.updatedAt))
        .filter((date): date is Date => !!date)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        url: `${BASE_URL}/category/${card.key}`,
        ...(lastModified ? { lastModified } : {}),
        changeFrequency: "daily" as const,
        priority: 0.8,
      };
    }),
    ...events.map((event) => ({
      url: absoluteUrl(eventPath(event)),
      ...(validDate(event.updatedAt) ? { lastModified: validDate(event.updatedAt) } : {}),
      changeFrequency: "weekly" as const,
      priority: 0.7,
      images: [
        absoluteUrl(event.posterImageUrl ?? stockPosterFor(event.category, event.id)),
      ],
    })),
  ];
}
