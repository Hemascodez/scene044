import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { VenueCard } from "@/components/venues/VenueCard";
import { VenueIcon, VenueKicker, VenueSectionHeading, venueButton } from "@/components/venues/VenueUi";
import { VenueReveal } from "@/components/venues/VenueReveal";
import { VenueSearchBar } from "@/components/venues/VenueSearchBar";
import { VENUES_IN_ONBOARDING } from "@/lib/venues";
import { listPublicVenues, toVenueListing } from "@/lib/venueCatalog";

const TITLE = "Book Event Venues in Chennai — SCENE/044";
const DESCRIPTION =
  "Browse verified Chennai venues for meetups, workshops, podcasts and shoots. Real capacity and rates, request-based booking, pay only after the host approves.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/venues" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/venues", type: "website" },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const STEPS = [
  ["01", "Search", "Tell us where, when, and how many people."],
  ["02", "Compare", "Real capacity, real rates, and what's included — before you commit."],
  ["03", "Request", "Share the event plan directly with the host."],
  ["04", "Pay", "Pay only after the venue approves your request."],
  ["05", "Host", "Arrive with a confirmed booking and clear plan."],
] as const;

/**
 * The organizer's reasons to use this instead of DMing a cafe.
 *
 * The partner page has always had a sharp four-point value stack; the organizer
 * side had only the repeated "pay after approval" line, so the demand side read
 * as thinner than the supply side. Every claim here is one the product actually
 * keeps today.
 */
const ORGANIZER_VALUE = [
  ["wallet", "Nothing upfront", "You pay only once the host says yes. Declined means never charged."],
  ["people", "Real capacity, stated", "Room-by-room guest limits, so you don't arrive over the line."],
  ["shield", "Visited & verified", "We check photos, rooms, and pricing with the owner before listing."],
  ["clock", "A reply in 48 hours", "One request with your plan attached — no chasing for a quote."],
] as const;

export default async function VenuesLandingPage() {
  const venues = await listPublicVenues();
  const live = venues.filter((venue) => venue.status === "live").map(toVenueListing);
  const upcoming = venues.filter((venue) => venue.status === "coming-soon").map(toVenueListing);
  const comingCount = upcoming.length + VENUES_IN_ONBOARDING;

  return (
    <>
      <section className="relative overflow-hidden border-b border-foreground/15 bg-foreground text-background">
        <div className="absolute inset-0" aria-hidden>
          <Image
            src="/venues/time-cafe/venue-search-hero-v1.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="venue-hero-image object-cover object-[68%_center] opacity-75"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(20,19,13,.98)_0%,rgba(20,19,13,.92)_35%,rgba(20,19,13,.54)_68%,rgba(20,19,13,.32)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_100%,rgba(255,45,22,.16),transparent_42%)]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
          <VenueReveal className="max-w-3xl">
            <VenueKicker className="text-primary">Chennai event spaces · verified in person</VenueKicker>
            <h1 className="mt-5 max-w-3xl font-display text-[clamp(3.15rem,7vw,6.8rem)] font-black leading-[0.86] tracking-[-0.075em]">
              Book the room.<br /><span className="text-primary">Skip the DMs.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-background/72 sm:text-lg">
              Real capacity, real hourly rates, and what&apos;s actually included — for meetups, workshops,
              podcasts and shoots. Send one request and pay nothing until the venue says yes.
            </p>
          </VenueReveal>
          <VenueReveal className="relative z-10 mt-10 max-w-6xl text-foreground" delay={0.12}>
            <VenueSearchBar />
            <p className="mt-3 flex items-center gap-2 pl-1 text-xs text-background/55"><VenueIcon name="shield" className="size-4" /> You pay only after the host approves your request.</p>
          </VenueReveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <VenueSectionHeading
          kicker="Now booking"
          title="A space that fits the room"
          description={`${live.length} ${live.length === 1 ? "venue" : "venues"} open for requests${
            comingCount > 0 ? `, ${comingCount} more launching soon` : ""
          }. Each one visited and verified before it goes up.`}
          action={
            <Link href="/venues/search" className={venueButton.outline}>
              Browse spaces <VenueIcon name="arrow" className="size-4" />
            </Link>
          }
        />
        <VenueReveal className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_.75fr]" delay={0.05}>
          <div className="space-y-6">
            {live.map((venue, index) => (
              <VenueCard key={venue.slug} venue={venue} priority={index === 0} />
            ))}
            {upcoming.map((venue) => (
              <VenueCard key={venue.slug} venue={venue} />
            ))}
          </div>
          <aside className="flex h-fit flex-col gap-8 self-start overflow-hidden rounded-[24px] bg-primary p-6 text-white sm:p-8">
            <div>
              <VenueKicker className="text-white/70">Why book here</VenueKicker>
              <h3 className="mt-3 font-display text-4xl font-black leading-[0.98] tracking-[-0.05em]">
                No quotes.<br />No guessing.
              </h3>
            </div>
            <div className="space-y-4">
              {ORGANIZER_VALUE.map(([icon, title, text]) => (
                <div key={title} className="border-t border-white/25 pt-4">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <VenueIcon name={icon} className="size-4 shrink-0" /> {title}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/80">{text}</p>
                </div>
              ))}
            </div>
          </aside>
        </VenueReveal>
      </section>

      <section className="border-y border-foreground/15 bg-card">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <VenueSectionHeading kicker="How it works" title="From search to showtime" description="A request-first flow protects the organizer and gives the venue time to check the fit." />
          <div className="mt-10 grid gap-px overflow-hidden rounded-[24px] border border-foreground/15 bg-foreground/15 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map(([number, title, text]) => (
              <div key={number} className="min-h-52 bg-[#f7f5ee] p-5 sm:p-6">
                <span className="font-mono text-xs font-bold text-primary-ink">{number}</span>
                <h3 className="mt-12 font-display text-2xl font-black tracking-[-0.04em]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="relative overflow-hidden rounded-[28px] border border-foreground bg-foreground p-7 sm:p-10 lg:p-14">
          <div className="absolute -right-10 -top-12 size-52 rounded-full border-[38px] border-primary" aria-hidden />
          <div className="relative max-w-2xl">
            <VenueKicker className="text-primary">For cafes, studios &amp; gathering spaces</VenueKicker>
            <h2 className="mt-3 font-display text-4xl font-black leading-[0.95] tracking-[-0.05em] text-primary sm:text-5xl">Have a venue Chennai should know?</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-primary/80 sm:text-base">We&apos;re onboarding the first partners personally so listings, capacity, pricing, and availability start clean. Leave your details—we&apos;ll do the setup with you.</p>
            <Link href="/venues/partner" className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-foreground transition-[transform,background-color] duration-200 hover:bg-background active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground">Register your venue <VenueIcon name="arrow" className="size-4" /></Link>
          </div>
        </div>
      </section>
    </>
  );
}
