"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { BookingFlow } from "@/components/venues/BookingFlow";
import { VenueReviews } from "@/components/venues/VenueReviews";
import { VenueScore } from "@/components/venues/VenueScore";
import { VenueGallery } from "@/components/venues/VenueGallery";
import { VenueIcon, VenueKicker, VenueSectionHeading, venueButton, venueCard, venueLabel, type VenueIconName } from "@/components/venues/VenueUi";
import { VENUE_EVENT_TYPES, formatRupees, rateForSpace, venueMaxGuests, type VenueEventType } from "@/lib/venues";
import type { CatalogVenue } from "@/lib/venueCatalog";
import type { AspectScore, ReviewSummary, VenueReview } from "@/lib/venueBookings";

interface VenueDetailProps {
  venue: CatalogVenue;
  reviews: VenueReview[];
  reviewSummary: ReviewSummary;
  aspects: AspectScore[];
  initial: { date: string; time: string; people: number; eventType: string };
}

/** Pick a glyph from the amenity's own wording rather than its list position. */
function amenityIcon(label: string): VenueIconName {
  const text = label.toLowerCase();
  if (/projector|screen|display|\bav\b/.test(text)) return "projector";
  if (/wi-?fi|internet|broadband/.test(text)) return "wifi";
  if (/coffee|food|drink|cafe|menu|snack|kitchen/.test(text)) return "coffee";
  if (/power|backup|charg|socket|plug/.test(text)) return "bolt";
  if (/terrace|outdoor|open-air|patio|garden/.test(text)) return "spark";
  if (/seat|table|sofa|chair/.test(text)) return "people";
  return "check";
}

const selectClass =
  "mt-2 min-h-11 w-full border-[1.5px] border-foreground bg-white px-3 text-sm outline-none transition-shadow focus:shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary";

export function VenueDetail({ venue, reviews, reviewSummary, aspects, initial }: VenueDetailProps) {
  const reduceMotion = useReducedMotion();
  const initialSpace = venue.spaces.find((space) => space.maxGuests >= initial.people) ?? venue.spaces[0];
  const [spaceId, setSpaceId] = useState<string>(initialSpace.id);
  const [duration, setDuration] = useState(2);
  const [eventType, setEventType] = useState<VenueEventType>(
    (VENUE_EVENT_TYPES.includes(initial.eventType as VenueEventType) ? initial.eventType : "Tech meetup") as VenueEventType,
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const space = useMemo(() => venue.spaces.find((item) => item.id === spaceId) ?? venue.spaces[0], [spaceId, venue.spaces]);
  const maxGuests = venueMaxGuests(venue);
  const rate = rateForSpace(space, eventType);
  const total = rate === null ? null : rate * duration;
  const reveal = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 22 },
        whileInView: { opacity: 1, y: 0 },
        viewport: { once: true, amount: 0.12 },
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
      };

  function share() {
    navigator.clipboard?.writeText(window.location.href).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-0 lg:pt-9">
        <nav className="flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/venues" className="inline-flex items-center gap-1.5 py-1.5 hover:text-foreground">
            <VenueIcon name="arrow" className="size-3.5 rotate-180" /> Venues
          </Link>
          <span aria-hidden>|</span>
          <Link href="/venues/search" className="py-1.5 hover:text-foreground">Chennai</Link>
          <span aria-hidden>|</span>
          <span className="text-foreground">{venue.name}</span>
        </nav>

        <motion.div
          className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <VenueKicker>A place we love · {venue.area}</VenueKicker>
            <h1 className="mt-2 font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">{venue.name}</h1>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              {venue.rating !== null && (
                <a href={venue.ratingUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 py-1 font-semibold underline decoration-foreground/25 underline-offset-4">
                  <VenueIcon name="star" className="size-4 fill-current text-primary" /> {venue.rating}
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">dining rating</span>
                </a>
              )}
              {maxGuests !== null && (
                <span className="inline-flex items-center gap-1.5 font-semibold"><VenueIcon name="people" className="size-4" /> Up to {maxGuests} guests</span>
              )}
              <a href="#location" className="inline-flex items-center gap-1.5 py-1 text-muted-foreground underline decoration-foreground/25 underline-offset-4 hover:text-foreground">
                <VenueIcon name="map" className="size-4" /> {venue.address ?? `${venue.area}, ${venue.city}`}
              </a>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-signal-ink"><VenueIcon name="shield" className="size-4" /> Verified on-site</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-3">
            <button type="button" onClick={share} className={`${venueButton.outline} whitespace-nowrap`}>{copied ? "Link copied" : "Share"}</button>
            <button type="button" onClick={() => setBookingOpen(true)} className={`${venueButton.primary} whitespace-nowrap`}>Check availability</button>
          </div>
          <span className="sr-only" role="status">{copied ? "Link copied to clipboard" : ""}</span>
        </motion.div>

        <VenueGallery venueName={venue.name} photos={venue.photos} />

        {/* Pick your space — the one dark panel, so the choice that drives the
            price reads as the main decision on the page. */}
        <motion.section
          {...reveal}
          id="spaces"
          className="relative mt-12 scroll-mt-24 overflow-hidden border-[1.5px] border-foreground bg-foreground p-6 text-background shadow-hard-lg sm:p-10"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_100%_100%,rgba(255,45,22,.18),transparent_50%)]" />
          <div className="relative">
            <VenueKicker className="text-primary">Pick your space</VenueKicker>
            <h2 className="mt-2 max-w-2xl font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">Make the space work for your event</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-background/75 sm:text-base">
              Each option is booked separately. Pick a full floor, the terrace, or a table for a smaller conversation.
            </p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {venue.spaces.map((item) => {
                const selected = item.id === spaceId;
                const itemRate = rateForSpace(item, eventType);
                return (
                  <motion.button
                    layout
                    key={item.id}
                    type="button"
                    onClick={() => setSpaceId(item.id)}
                    aria-pressed={selected}
                    whileTap={reduceMotion ? undefined : { scale: 0.985 }}
                    className={`overflow-hidden border-[1.5px] bg-background/5 text-left transition-[border-color,box-shadow,translate] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background focus-visible:ring-offset-2 focus-visible:ring-offset-foreground ${
                      selected ? "border-primary shadow-[6px_6px_0_0_var(--color-primary)]" : "border-background/25 hover:border-background/60"
                    }`}
                  >
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, 40vw" className="object-cover transition-transform duration-500 hover:scale-[1.03] motion-reduce:transition-none" />
                      <span className="absolute left-3 top-3 bg-foreground/85 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-background">{item.eyebrow}</span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-display text-xl font-bold leading-tight">{item.name}</h3>
                        <span aria-hidden className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] ${selected ? "border-primary bg-primary text-white" : "border-background/40"}`}>
                          {selected && <VenueIcon name="check" className="size-3.5" />}
                        </span>
                      </div>
                      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs font-bold">
                        <span className="inline-flex items-center gap-1.5"><VenueIcon name="people" className="size-4 text-primary" /> {item.capacity}</span>
                        <span>{itemRate === null ? "Ask for a quote" : `${formatRupees(itemRate)} an hour`}</span>
                      </p>
                      <p className="mt-3 text-sm leading-6 text-background/75">{item.description}</p>
                      <p className={`mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.1em] ${selected ? "text-primary" : "text-background/60"}`}>{selected ? "Selected" : "Select this space"}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </motion.section>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0">
            <motion.section {...reveal} className="border-b border-foreground/15 pb-10">
              <VenueKicker>Why it works</VenueKicker>
              <h2 className="mt-2 max-w-2xl font-display text-3xl font-extrabold leading-[1.08] tracking-[-0.03em] sm:text-4xl">Bring the room together without taking over the whole cafe.</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                A light-filled first floor for talks and workshops, a terrace for relaxed evening sessions, and smaller tables when you only need a focused conversation.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {([
                  ["people", maxGuests ? `Up to ${maxGuests} guests` : "Group-friendly"],
                  ["projector", "Projector available"],
                  ["coffee", "Food & drinks downstairs"],
                ] as const).map(([icon, label]) => (
                  <div key={label} className={`${venueCard} flex items-center gap-3 !shadow-hard-sm p-4 text-sm font-bold`}>
                    <VenueIcon name={icon} className="size-5 text-primary-ink" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section {...reveal} className="border-b border-foreground/15 py-11">
              <VenueScore venue={venue} />
            </motion.section>

            {venue.amenities.length > 0 && (
              <motion.section {...reveal} className="border-b border-foreground/15 py-11">
                <VenueSectionHeading kicker="Included" title="What this space offers" description="Everything below comes with your booking." />
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {venue.amenities.map((amenity) => (
                    <div key={amenity} className={`${venueCard} flex min-h-24 items-center gap-4 !shadow-hard-sm p-4 text-sm font-bold`}>
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary-ink">
                        <VenueIcon name={amenityIcon(amenity)} className="size-5" />
                      </span>
                      {amenity}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">Need microphones, recording quiet, or a special furniture layout? Add it to your request and the host will confirm what&apos;s possible.</p>
              </motion.section>
            )}

            <motion.section {...reveal} id="location" className="scroll-mt-24 border-b border-foreground/15 py-11">
              <VenueSectionHeading kicker={venue.city} title="Easy to reach. Easy to find." description={venue.address ?? `${venue.area}, ${venue.city}`} />
              <div className={`${venueCard} relative mt-6 h-52 overflow-hidden bg-[#e7e6dc] sm:h-60`} role="img" aria-label={`Map preview showing ${venue.name} in ${venue.area}`}>
                <svg viewBox="0 0 900 230" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
                  <rect width="900" height="230" fill="#e7e6dc" />
                  <path d="M-30 178C115 130 217 154 342 117S604 31 941 81" fill="none" stroke="#fffef9" strokeWidth="28" />
                  <path d="M-30 178C115 130 217 154 342 117S604 31 941 81" fill="none" stroke="#c8c6b8" strokeWidth="2" strokeDasharray="9 8" />
                  <path d="M176-20c20 70 7 123 32 270M690-20c-18 68-4 137-42 270" fill="none" stroke="#f8f7f1" strokeWidth="18" />
                  <path d="M176-20c20 70 7 123 32 270M690-20c-18 68-4 137-42 270" fill="none" stroke="#cbc9bd" strokeWidth="2" />
                  <path d="M25 45h122v54H25zM268 20h94v51h-94zM748 132h114v68H748zM455 151h102v55H455z" fill="#dad8ca" stroke="#c8c6b8" />
                  <path d="M62 0v230M405 0v230M805 0v230M0 58h900M0 205h900" stroke="#d3d1c4" strokeWidth="1" strokeDasharray="3 7" opacity=".65" />
                </svg>
                <span className="absolute right-[8%] top-[15%] bg-venue-card/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{venue.area}</span>
                <motion.div initial={reduceMotion ? false : { y: -12, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ delay: 0.38, type: "spring", stiffness: 380, damping: 22 }} className="absolute left-[53%] top-[46%] -translate-x-1/2 -translate-y-1/2">
                  <div className="relative grid size-12 place-items-center border-[1.5px] border-foreground bg-primary text-white shadow-hard-sm">
                    <VenueIcon name="coffee" className="size-5" />
                    <span className="absolute -bottom-8 whitespace-nowrap bg-foreground px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-background">{venue.name}</span>
                  </div>
                </motion.div>
                {venue.mapUrl && (
                  <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="venue-press absolute left-3 top-3 border-[1.5px] border-foreground bg-venue-card px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] shadow-hard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                    Open in Maps ↗
                  </a>
                )}
              </div>
            </motion.section>

            <motion.section {...reveal} className="border-b border-foreground/15 py-11">
              <VenueSectionHeading kicker="Reviews" title="Organizer reviews" description="From SCENE bookings and from anyone who has hosted here before." />
              <VenueReviews venueSlug={venue.slug} venueName={venue.name} reviews={reviews} summary={reviewSummary} aspects={aspects} />
            </motion.section>

            {venue.policies.length > 0 && (
              <motion.section {...reveal} className="py-11">
                <VenueSectionHeading kicker="Good to know" title="A few clear house rules" description="Read these before you request the space. You won't see new rules at payment." />
                <div className={`${venueCard} mt-6 divide-y divide-foreground/15 !shadow-hard-sm px-5`}>
                  {venue.policies.map((policy, index) => (
                    <details key={policy} className="group py-4" open={index === 0}>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <span>{policy.split(".")[0]}</span>
                        <VenueIcon name="chevron" className="size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <p className="mt-2 pr-8 text-sm leading-6 text-muted-foreground">{policy}</p>
                    </details>
                  ))}
                </div>
              </motion.section>
            )}
          </div>

          <motion.aside
            className={`${venueCard} hidden !shadow-hard-lg p-6 lg:sticky lg:top-24 lg:block`}
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-label="Your booking"
          >
            <VenueKicker>Your booking</VenueKicker>
            <motion.div key={space.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em]">{space.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{space.capacity} · No charge until confirmed</p>
            </motion.div>
            <label className="mt-5 block">
              <span className={venueLabel}>Event type</span>
              <select value={eventType} onChange={(event) => setEventType(event.target.value as VenueEventType)} className={selectClass}>
                {VENUE_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-4 block">
              <span className={venueLabel}>How long?</span>
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className={selectClass}>
                {[1, 2, 3, 4, 5, 6].map((item) => <option value={item} key={item}>{item} {item === 1 ? "hour" : "hours"}</option>)}
              </select>
            </label>
            <div className="mt-5 border-y border-foreground/15 py-4">
              <motion.div key={`${space.id}-${eventType}-${duration}`} initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
                <div>
                  <p className={venueLabel}>Estimated total</p>
                  <p className="mt-1.5 font-display text-3xl font-extrabold">{total === null ? "Host quote" : formatRupees(total)}</p>
                </div>
                {rate !== null && <span className="pb-1 text-xs text-muted-foreground">{formatRupees(rate)}/hr</span>}
              </motion.div>
              {space.minimumFoodSpend && <p className="mt-3 text-xs leading-5 text-muted-foreground">You can also ask about a {formatRupees(space.minimumFoodSpend)} minimum food order instead of hourly rent.</p>}
            </div>
            <button type="button" onClick={() => setBookingOpen(true)} className={`${venueButton.primary} mt-5 w-full`}>Check availability <VenueIcon name="arrow" className="size-4" /></button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">No charge today. {venue.name} replies within 48 hours.</p>
            <div className="mt-5 flex items-start gap-3 border-[1.5px] border-dashed border-foreground/40 bg-venue-paper p-4 text-xs leading-5">
              <VenueIcon name="shield" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
              <span>If accepted, this time is held for 24 hours while you pay and confirm.</span>
            </div>
          </motion.aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t-[1.5px] border-foreground bg-white px-4 py-3 lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{space.name}</p>
            <p className="font-display text-xl font-extrabold">{total === null ? "Host quote" : formatRupees(total)}</p>
          </div>
          <button type="button" onClick={() => setBookingOpen(true)} className={venueButton.primary}>Check availability</button>
        </div>
      </div>
      <BookingFlow key={`${space.id}-${eventType}-${duration}`} open={bookingOpen} onClose={() => setBookingOpen(false)} space={space} initial={{ ...initial, eventType, duration }} />
    </>
  );
}
