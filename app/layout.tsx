import type { Metadata } from "next";
import { gaInlineScript, gaMeasurementId } from "@/lib/client/analytics";
import { SITE_URL } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  // Required for per-event OpenGraph images (app/page.tsx's generateMetadata)
  // to resolve to absolute URLs — WhatsApp/Twitter/LinkedIn crawlers fetch
  // og:image directly and can't resolve a relative path.
  metadataBase: new URL(SITE_URL),
  title: "Tech Events in Chennai | Meetups, Conferences & Workshops — SCENE/044",
  description:
    "Discover upcoming tech events in Chennai, including AI meetups, startup networking, developer conferences, workshops and hackathons. Updated by SCENE/044.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const gaId = gaMeasurementId();

  return (
    <html
      lang="en"
      className="antialiased"
    >
      <head>
        {/* Analytics. Renders nothing at all when no measurement ID is
            configured, so dev and preview builds send no traffic. */}
        {gaId && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`} />
            <script dangerouslySetInnerHTML={{ __html: gaInlineScript(gaId) }} />
          </>
        )}
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
