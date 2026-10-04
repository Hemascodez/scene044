import Link from "next/link";
import type { ReactNode } from "react";
// Venue typography, self-hosted. Imported here, not in the root layout, so the
// events pages never pay for these files. See the note on `.venue-surface` in
// app/globals.css for why this is fontsource and not next/font/google.
import "@fontsource-variable/montserrat";
import "@fontsource-variable/montserrat/wght-italic.css";
import "@fontsource-variable/work-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import { Wordmark } from "@/components/scene/SceneHeader";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";

type Active = "venues" | "bookings" | "host";

const NAV = [
  { href: "/", label: "Events", key: "events" },
  { href: "/venues", label: "Venues", key: "venues" },
  { href: "/bookings", label: "My bookings", key: "bookings" },
] as const;

function navClass(current: boolean) {
  return `px-3.5 py-2 text-sm font-semibold transition-colors ${
    current ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
  }`;
}

export function VenueShell({ children, active = "venues" }: { children: ReactNode; active?: Active }) {
  return (
    <div className="venue-surface min-h-screen text-foreground">
      <header className="sticky top-0 z-40 border-b-[1.5px] border-foreground bg-white">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:bg-card focus:px-3 focus:py-2">
          Skip to venue content
        </a>
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="SCENE/044 home" className="shrink-0">
            <Wordmark size="text-lg" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
            {NAV.map((item) => {
              const current = item.key === active;
              return (
                <Link key={item.key} href={item.href} className={navClass(current)} aria-current={current ? "page" : undefined}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2">
            {/* The host workspace is invite-only and irrelevant to the visitors
                this nav serves, so it lives in the partner footer column — except
                while you're in it, where a current-page link aids orientation. */}
            {active === "host" && (
              <Link
                href="/host"
                className="hidden bg-foreground px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-background sm:inline-flex"
                aria-current="page"
              >
                Host view
              </Link>
            )}
            <Link href="/venues/partner" aria-label="List your venue" className={`${venueButton.primary} !min-h-10 !px-3.5 !py-2`}>
              <VenueIcon name="building" className="size-4" />
              <span className="hidden sm:inline">List your venue</span>
            </Link>
          </div>
        </div>
        {/* Below md the primary nav is hidden, which used to leave My bookings
            unreachable on a phone except via the booking-success screen. */}
        <nav className="flex border-t border-foreground/15 md:hidden" aria-label="Main navigation (compact)">
          {NAV.map((item) => {
            const current = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 flex-1 items-center justify-center font-mono text-[11px] font-bold uppercase tracking-[0.08em] ${
                  current ? "bg-foreground text-background" : "text-muted-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-20 border-t-[1.5px] border-foreground bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-[1.5fr_1fr_1fr] sm:px-6 lg:px-8">
          <div>
            <Wordmark size="text-lg" />
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
              Chennai&apos;s professional events and the spaces that make them possible.
            </p>
          </div>
          <div className="text-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary-ink">Explore</p>
            <div className="mt-3 flex flex-col gap-2 text-foreground/80">
              <Link href="/" className="py-1.5 hover:text-foreground hover:underline">Events</Link>
              <Link href="/venues" className="py-1.5 hover:text-foreground hover:underline">Venues</Link>
              <Link href="/bookings" className="py-1.5 hover:text-foreground hover:underline">My bookings</Link>
            </div>
          </div>
          <div className="text-sm">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-primary-ink">For venue partners</p>
            <div className="mt-3 flex flex-col gap-2 text-foreground/80">
              <Link href="/venues/partner" className="py-1.5 hover:text-foreground hover:underline">Register interest</Link>
              <Link href="/host" className="py-1.5 hover:text-foreground hover:underline">Open host view</Link>
              <Link href="/privacy" className="py-1.5 hover:text-foreground hover:underline">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
