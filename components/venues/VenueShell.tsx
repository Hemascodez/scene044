import type { ReactNode } from "react";
// Venue typography, self-hosted. Imported here, not in the root layout, so the
// events pages never pay for these files. See the note on `.venue-surface` in
// app/globals.css for why this is fontsource and not next/font/google.
import "@fontsource-variable/montserrat";
import "@fontsource-variable/montserrat/wght-italic.css";
import "@fontsource-variable/work-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { VenueAppProvider } from "@/components/venues/figma/VenueApp";
import { SiteFooter, SiteHeader } from "@/components/venues/figma/SiteChrome";

/**
 * Wraps every venue route: the venue surface (fonts, paper, tokens), and the
 * shared app state from the Figma Make prototype (profile, OTP modal, toast).
 *
 * `bare`: the page brings its own header and footer, as the designed pages
 * (landing, venue, bookings, partner, host) do — verbatim from the prototype.
 * Otherwise the prototype's site header and footer are added around it.
 */
export function VenueShell({ children, bare = false }: { children: ReactNode; bare?: boolean; active?: string }) {
  return (
    <div className="venue-surface min-h-screen text-ink">
      <VenueAppProvider>
        {bare ? (
          children
        ) : (
          <>
            <SiteHeader wide />
            <main id="main">{children}</main>
            <SiteFooter wide />
          </>
        )}
      </VenueAppProvider>
    </div>
  );
}
