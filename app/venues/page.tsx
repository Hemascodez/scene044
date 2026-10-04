import type { Metadata } from "next";
import Link from "next/link";
import { VenueCard } from "@/components/venues/VenueCard";
import { VenueIcon, VenueKicker, venueButton } from "@/components/venues/VenueUi";
import { VenueReveal } from "@/components/venues/VenueReveal";
import { VenueSearchBar } from "@/components/venues/VenueSearchBar";
import { HeroCarousel } from "@/components/venues/landing/HeroCarousel";
import { HowItWorks } from "@/components/venues/landing/HowItWorks";
import { TrustSection, type TrustQuote } from "@/components/venues/landing/TrustSection";
import { Typewriter } from "@/components/venues/landing/Typewriter";
import { VENUES_IN_ONBOARDING, venueMaxGuests } from "@/lib/venues";
import { listPublicVenues, toVenueListing } from "@/lib/venueCatalog";
import { listVenueReviews } from "@/lib/venueBookings";

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

/** Kinds of event to cycle in the headline — all real booking-form options. */
const HEADLINE_EVENTS = ["Tech meetup", "Podcast recording", "Workshop", "Wellness session", "Photoshoot"] as const;

/**
 * What a venue partner actually gets today. Every figure here is one the
 * product enforces: the 10% fee and 90% payout are what the host dashboard
 * computes, 48 hours is the response window, and organizers are never charged
 * before a host approves. (The design this page was restyled from advertised
 * earnings and partner counts the product cannot substantiate; none of that is
 * carried over.)
 */
const HOST_FACTS = [
  ["90%", "Of every booking is yours, after SCENE's 10% fee"],
  ["48h", "To approve or decline — you stay in control"],
  ["₹0", "Charged to organizers before you say yes"],
] as const;

export default async function VenuesLandingPage() {
  const venues = await listPublicVenues();
  const liveVenues = venues.filter((venue) => venue.status === "live");
  const live = liveVenues.map(toVenueListing);
  const upcoming = venues.filter((venue) => venue.status === "coming-soon").map(toVenueListing);
  const comingCount = upcoming.length + VENUES_IN_ONBOARDING;

  const featured = liveVenues[0];
  const slides = (featured?.photos ?? []).map((src, index) => ({
    src,
    alt: `${featured?.name} event space in ${featured?.area}, photo ${index + 1}`,
  }));

  // A real, published review or nothing — never an invented testimonial.
  const reviews = featured ? await listVenueReviews(featured.slug, 10).catch(() => []) : [];
  const best = reviews.find((review) => review.comment && review.rating >= 4);
  const quote: TrustQuote | null = best?.comment
    ? { comment: best.comment, author: [best.organizerName ?? "An organizer", best.eventType].filter(Boolean).join(" · "), rating: best.rating }
    : null;

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pb-24 md:pt-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,431fr)_minmax(0,527fr)] lg:gap-16">
          <div className="max-w-[576px]">
            <VenueReveal>
              <p className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-foreground bg-venue-card px-3 py-1 font-mono text-xs tracking-[0.02em] text-muted-foreground">
                <VenueIcon name="shield" className="size-3.5 text-signal-ink" /> Curated event spaces in Chennai
              </p>
            </VenueReveal>
            <VenueReveal delay={0.08}>
              <h1 className="mt-6 font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-[52px] lg:text-[60px]">
                Find a space that <em className="italic text-primary">actually fits</em> your event.
              </h1>
            </VenueReveal>
            <VenueReveal delay={0.16}>
              <p className="mt-6 text-base leading-7 text-muted-foreground md:text-lg md:leading-[29px]">
                No calls, no endless WhatsApp threads. See capacity, pricing, and what&rsquo;s included up front — then send one clear request and know exactly what happens next.
              </p>
            </VenueReveal>
            <VenueReveal delay={0.24}>
              <div className="mt-8">
                <a href="#spaces" className={`${venueButton.primary} !min-h-12 !px-6 !py-3.5 !text-sm !shadow-hard`}>
                  Explore venues <VenueIcon name="arrow" className="size-5" />
                </a>
              </div>
              <p className="mt-5 text-sm leading-5 text-muted-foreground">You pay only after a host approves your request. No charge to enquire.</p>
            </VenueReveal>
          </div>

          {featured && slides.length > 0 && (
            <VenueReveal delay={0.2} className="relative">
              <HeroCarousel
                slides={slides}
                label={`${featured.name} photos`}
                className="aspect-[4/4.1] w-full border-[1.5px] border-foreground shadow-hard lg:aspect-auto lg:h-[544px]"
              />
              <figure className="absolute -bottom-8 left-3 w-[220px] border-[1.5px] border-foreground bg-venue-card p-4 shadow-hard sm:w-[240px] lg:-left-6 lg:bottom-auto lg:top-[444px]">
                <figcaption className="flex items-center gap-1.5 text-xs font-medium leading-4 text-signal-ink">
                  <VenueIcon name="shield" className="size-[15px] shrink-0" /> Visited &amp; verified by SCENE/044
                </figcaption>
                <p className="mt-2 font-display text-lg font-bold leading-[22px]">{featured.name}</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm leading-5 text-muted-foreground">
                  <VenueIcon name="map" className="size-3.5" /> {featured.area}
                </p>
              </figure>
            </VenueReveal>
          )}
        </div>

        <VenueReveal className="relative z-10 mt-20 lg:mt-16" delay={0.3}>
          <VenueSearchBar />
        </VenueReveal>
      </section>

      <section id="how" className="scroll-mt-20 border-y-[1.5px] border-foreground bg-secondary/50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <VenueKicker>How booking works</VenueKicker>
          <h2 className="mt-3 max-w-[640px] font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
            You host <Typewriter phrases={HEADLINE_EVENTS} />
            <span className="mt-1 block">we&rsquo;ll find the perfect venue.</span>
          </h2>
          <p className="mt-4 max-w-[560px] text-base leading-7 text-muted-foreground">
            Send a request first. The host confirms what&rsquo;s possible, and only then do you pay and lock it in.
          </p>
          <HowItWorks venueName={featured?.name ?? "Your venue"} maxGuests={featured ? venueMaxGuests(featured) : null} />
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2"><VenueIcon name="clock" className="size-4 text-foreground" /> Hosts respond within 48 hours</li>
            <li className="flex items-center gap-2"><VenueIcon name="map" className="size-4 text-foreground" /> Every venue visited in person</li>
          </ul>
        </div>
      </section>

      <section id="spaces" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-foreground pb-5">
          <div>
            <VenueKicker>Now booking</VenueKicker>
            <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">Available for reservation</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">
              {live.length} {live.length === 1 ? "venue" : "venues"} open for requests
              {comingCount > 0 ? `, ${comingCount} more launching soon` : ""}. Each one visited and verified before it goes up.
            </p>
          </div>
          <Link href="/venues/search" className={venueButton.outline}>
            Browse spaces <VenueIcon name="arrow" className="size-4" />
          </Link>
        </div>
        <div className="mt-10 space-y-8">
          {live.map((venue, index) => (
            <VenueReveal key={venue.slug} delay={0.04 * index}>
              <VenueCard venue={venue} priority={index === 0} />
            </VenueReveal>
          ))}
          {upcoming.map((venue) => (
            <VenueCard key={venue.slug} venue={venue} />
          ))}
        </div>
        {comingCount > 0 && <p className="mt-6 text-center text-sm text-muted-foreground">More independently owned Chennai venues are joining soon.</p>}
      </section>

      <TrustSection quote={quote} />

      <section id="hosts" className="scroll-mt-20 px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="relative mx-auto max-w-[1216px] overflow-hidden border-[1.5px] border-foreground bg-foreground p-8 text-background shadow-hard-lg md:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px]"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
            <div>
              <VenueKicker className="text-primary">For cafes, studios &amp; gathering spaces</VenueKicker>
              <h2 className="mt-3 max-w-[560px] font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
                Have a venue Chennai should know?
              </h2>
              <p className="mt-4 max-w-[520px] text-background/70">
                We&rsquo;re onboarding the first partners personally so listings, capacity, pricing, and availability start clean. Leave your details — we&rsquo;ll do the setup with you.
              </p>
              <dl className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {HOST_FACTS.map(([figure, label]) => (
                  <div key={figure} className="border-l-2 border-primary pl-3">
                    <dt className="font-display text-xl font-bold">{figure}</dt>
                    <dd className="mt-1 text-xs leading-5 text-background/60">{label}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="flex flex-col gap-3 lg:items-end">
              <Link href="/venues/partner" className="venue-press inline-flex min-h-12 items-center justify-center gap-2 border-[1.5px] border-background bg-primary px-6 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.06em] text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground">
                Register your venue <VenueIcon name="arrow" className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
