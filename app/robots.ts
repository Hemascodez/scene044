import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Uploaded event posters are served from /api/poster/{id}; allowing
        // that narrower path lets Google use them in event results while the
        // rest of the API stays out of the crawl surface.
        allow: ["/", "/api/poster/"],
        // /venues/search and /bookings/host stay crawlable but rely on
        // per-page `robots`/`canonical` metadata (query-string variants and
        // private dashboards) rather than a blanket disallow here.
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
