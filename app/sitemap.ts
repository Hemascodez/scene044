import type { MetadataRoute } from "next";
import { FIELD_CARDS } from "@/lib/fieldCards";

const BASE_URL = "https://scene044.in";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE_URL, lastModified: now, changeFrequency: "hourly", priority: 1 },
    ...FIELD_CARDS.map((card) => ({
      url: `${BASE_URL}/category/${card.key}`,
      lastModified: now,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
  ];
}
