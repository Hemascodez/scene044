import type { Metadata } from "next";
import { Archivo, Inter, JetBrains_Mono } from "next/font/google";
import { gaInlineScript, gaMeasurementId } from "@/lib/client/analytics";
import "./globals.css";

/* Self-hosted via next/font rather than the design's Google Fonts @import —
   removes a render-blocking third-party request and the layout shift with it.
   Archivo carries the editorial display weights (up to 900). */
const archivo = Archivo({
  variable: "--font-archivo",
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Required for per-event OpenGraph images (app/page.tsx's generateMetadata)
  // to resolve to absolute URLs — WhatsApp/Twitter/LinkedIn crawlers fetch
  // og:image directly and can't resolve a relative path.
  metadataBase: new URL("https://scene044.in"),
  title: "SCENE/044 — Chennai's tech events, discovered",
  description:
    "SCENE/044 automatically discovers Chennai professional and technology events from public sources and presents them in one feed.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const gaId = gaMeasurementId();

  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} ${jetBrainsMono.variable} antialiased`}
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
