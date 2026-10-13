import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SCENE/044 — Chennai Tech Events & Venues",
    short_name: "SCENE/044",
    description: "Discover Chennai tech events and book event venues.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ea",
    theme_color: "#14130d",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/api/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/api/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
