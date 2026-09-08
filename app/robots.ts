import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Uploaded event posters are served from /api/poster/{id}; allowing
        // that narrower path lets Google use them in event results while the
        // rest of the API stays out of the crawl surface.
        allow: ["/", "/api/poster/"],
        disallow: ["/admin", "/api/"],
      },
    ],
    sitemap: "https://scene044.in/sitemap.xml",
  };
}
