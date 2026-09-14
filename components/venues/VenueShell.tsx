import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/scene/SceneHeader";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";

export function VenueShell({ children, active = "venues" }: { children: ReactNode; active?: "venues" | "bookings" | "host" }) {
  return (
    <div className="venue-surface min-h-screen bg-[#f7f5ee] text-foreground">
      <header className="sticky top-0 z-40 border-b border-foreground/15 bg-[#f7f5ee]/95 backdrop-blur-xl">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
          Skip to venue content
        </a>
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SCENE/044 home" className="shrink-0">
            <Wordmark size="text-lg" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            <Link href="/" className="rounded-full px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-card hover:text-foreground">Events</Link>
            <Link href="/venues" className={`rounded-full px-4 py-2 text-sm font-semibold ${active === "venues" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground"}`} aria-current={active === "venues" ? "page" : undefined}>Venues</Link>
            <Link href="/bookings" className={`rounded-full px-4 py-2 text-sm font-semibold ${active === "bookings" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-card hover:text-foreground"}`} aria-current={active === "bookings" ? "page" : undefined}>My bookings</Link>
          </nav>
          <div className="flex items-center gap-2">
            {/* The host workspace is invite-only and irrelevant to the visitors
                this nav serves, so it lives in the partner footer column — except
                while you're in it, where a current-page link aids orientation. */}
            {active === "host" && (
              <Link
                href="/host"
                className="hidden rounded-full bg-foreground px-3 py-2 text-sm font-semibold text-background sm:inline-flex"
                aria-current="page"
              >
                Host view
              </Link>
            )}
            <Link href="/venues/partner" aria-label="List your venue" className={`${venueButton.outline} !size-10 !min-h-10 !p-0 sm:!h-10 sm:!w-auto sm:!px-3.5`}>
              <VenueIcon name="building" className="size-4" />
              <span className="hidden sm:inline">List your venue</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-20 border-t border-foreground/15 bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
          <div>
            <Wordmark size="text-lg" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-background/65">
              Chennai&apos;s professional events and the spaces that make them possible.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">Explore</p>
            <div className="mt-3 flex flex-col gap-2 text-background/75">
              <Link href="/">Events</Link><Link href="/venues">Venues</Link><Link href="/bookings">My bookings</Link>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-background/45">For venue partners</p>
            <div className="mt-3 flex flex-col gap-2 text-background/75">
              <Link href="/venues/partner">Register interest</Link><Link href="/host">Open host view</Link><Link href="/privacy">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
