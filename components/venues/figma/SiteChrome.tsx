"use client";

import Link from "next/link";
import { ArrowRight } from "./icons";
import { useVenueApp } from "./VenueApp";

/*
 * The prototype's site header and footer, markup unchanged, with its SPA hash
 * routes ("#/host", "#/list-venue") and placeholder "#" links pointed at the
 * real routes so nothing in the chrome is a dead link on the live site.
 */

export const Logo = () => (
  <span className="font-mono-b text-sm leading-5 tracking-[2.52px] text-ink">
    SCENE<span className="text-flame">/044</span>
  </span>
);

const NAV: [string, string][] = [
  ["How it works", "#how"],
  ["Spaces", "#spaces"],
  ["Why SCENE", "#why"],
  ["For hosts", "#hosts"],
];

/** `onLanding`: section links scroll in-page; elsewhere they go to /venues#… */
export function SiteHeader({ onLanding = false, wide = false }: { onLanding?: boolean; wide?: boolean }) {
  const { profile, openAuth } = useVenueApp();
  const firstName = profile?.name.split(" ")[0];
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <nav aria-label="Main" className={`mx-auto flex ${wide ? "max-w-[1280px]" : "max-w-[1152px]"} items-center justify-between gap-4 px-5 py-4 md:px-8`}>
          <Link href="/venues" aria-label="SCENE/044 home">
            <Logo />
          </Link>
          <ul className="hidden items-center gap-8 md:flex">
            {NAV.map(([label, hash]) => (
              <li key={label}>
                <a href={onLanding ? hash : `/venues${hash}`} className="text-sm leading-5 text-stone transition-colors hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            {firstName && (
              <Link href="/bookings" className="hidden rounded-full px-4 py-2 font-body-m text-sm leading-5 text-ink transition-colors hover:bg-sand sm:block">
                Your bookings
              </Link>
            )}
            {firstName ? (
              <Link
                href="/bookings"
                className="press flex items-center gap-1.5 rounded-md border-[1.5px] border-ink bg-flame px-4 py-2 font-body-sb text-sm leading-5 text-white shadow-hard-sm"
              >
                Hi, {firstName}
                <ArrowRight />
              </Link>
            ) : (
              <button
                type="button"
                onClick={openAuth}
                className="press flex items-center gap-1.5 rounded-md border-[1.5px] border-ink bg-flame px-4 py-2 font-body-sb text-sm leading-5 text-white shadow-hard-sm"
              >
                Login/signup
                <ArrowRight />
              </button>
            )}
          </div>
        </nav>
      </header>
    </>
  );
}

const FOOTER: [string, [string, string][]][] = [
  ["Organisers", [["Explore venues", "/venues#spaces"], ["How booking works", "/venues#how"], ["My bookings", "/bookings"], ["Pricing", "/venues#spaces"]]],
  ["Hosts", [["List your venue", "/venues/partner"], ["Host dashboard", "/host"], ["Check-in tools", "/host"], ["Payouts", "/host"]]],
  ["SCENE/044", [["About", "/"], ["Events", "/"], ["Contact", "/venues/partner"], ["Help centre", "/venues#how"]]],
];

/**
 * The prototype has two footer variants: the landing page's (1152px, roomier)
 * and the venue page's (1280px, tighter lists, smaller legal line). `wide`
 * selects the venue-page one; both reproduce the prototype's spacing exactly.
 */
export function SiteFooter({ wide = false }: { wide?: boolean }) {
  const max = wide ? "max-w-[1280px]" : "max-w-[1152px]";
  return (
    <footer className="border-t border-line bg-paper-2">
      <div className={`mx-auto grid ${max} gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8`}>
        <div>
          <Logo />
          <p className={`mt-3 max-w-[260px] text-sm text-stone ${wide ? "" : "leading-6"}`}>Curated event spaces in Chennai. Book with clarity, host with calm.</p>
        </div>
        {FOOTER.map(([heading, links]) => (
          <nav key={heading} aria-label={heading}>
            <h2 className={`font-mono-b text-[11px] uppercase ${wide ? "tracking-[0.9px]" : "tracking-[1.32px]"}`}>{heading}</h2>
            <ul className={wide ? "mt-3 space-y-2" : "mt-4 space-y-2.5"}>
              {links.map(([label, href]) => (
                <li key={label} className={wide ? "text-sm text-stone" : undefined}>
                  <Link href={href} className={wide ? "transition-colors hover:text-ink" : "text-sm text-stone transition-colors hover:text-ink"}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className={`mx-auto flex ${max} flex-wrap justify-between gap-3 border-t border-line px-5 md:px-8 ${wide ? "py-5 text-xs text-stone" : "py-6 text-sm text-stone"}`}>
        <p>© 2026 SCENE/044. Made in Chennai.</p>
        <p className={`flex ${wide ? "gap-4" : "gap-6"}`}>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/privacy" className="hover:text-ink">Terms</Link>
        </p>
      </div>
    </footer>
  );
}
