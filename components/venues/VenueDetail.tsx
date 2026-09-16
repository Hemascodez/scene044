"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { BookingFlow } from "@/components/venues/BookingFlow";
import { VenueReviews } from "@/components/venues/VenueReviews";
import { VenueScore } from "@/components/venues/VenueScore";
import { VenueGallery } from "@/components/venues/VenueGallery";
import { VenueIcon, VenueKicker, VenueSectionHeading, venueButton } from "@/components/venues/VenueUi";
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

export function VenueDetail({ venue, reviews, reviewSummary, aspects, initial }: VenueDetailProps) {
  const reduceMotion = useReducedMotion();
  const initialSpace =
    venue.spaces.find((space) => space.maxGuests >= initial.people) ?? venue.spaces[0];
  const [spaceId, setSpaceId] = useState<string>(initialSpace.id);
  const [duration, setDuration] = useState(2);
  const [eventType, setEventType] = useState<VenueEventType>(
    (VENUE_EVENT_TYPES.includes(initial.eventType as VenueEventType)
      ? initial.eventType
      : "Tech meetup") as VenueEventType,
  );
  const [bookingOpen, setBookingOpen] = useState(false);
  const space = useMemo(
    () => venue.spaces.find((item) => item.id === spaceId) ?? venue.spaces[0],
    [spaceId, venue.spaces],
  );
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

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-0 lg:pt-9">
        <nav className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <Link href="/venues" className="hover:text-foreground">Venues</Link>
          <span>/</span>
          <Link href="/venues/search" className="hover:text-foreground">Chennai</Link>
          <span>/</span>
          <span className="text-foreground">{venue.name}</span>
        </nav>

        <motion.div
          className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <VenueKicker>{venue.area} · Cafe &amp; gathering space</VenueKicker>
            <h1 className="mt-2 font-display text-5xl font-black tracking-[-0.065em] sm:text-6xl lg:text-7xl">{venue.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              {venue.rating !== null && (
                <>
                  <a href={venue.ratingUrl ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-bold underline decoration-foreground/20 underline-offset-4">
                    <VenueIcon name="star" className="size-4 fill-current" /> {venue.rating} dining rating
                  </a>
                  <span className="text-foreground/20">•</span>
                </>
              )}
              {maxGuests !== null && (
                <>
                  <span className="inline-flex items-center gap-1.5 font-semibold"><VenueIcon name="people" className="size-4" /> Up to {maxGuests} guests</span>
                  <span className="text-foreground/20">•</span>
                </>
              )}
              <a href="#location" className="font-semibold underline decoration-foreground/20 underline-offset-4">View location</a>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => navigator.clipboard?.writeText(window.location.href)} className={venueButton.outline}>Share</button>
            <button type="button" onClick={() => setBookingOpen(true)} className={venueButton.primary}>Check availability</button>
          </div>
        </motion.div>

        <motion.section
          id="location"
          className="mt-7 grid overflow-hidden rounded-[24px] border border-foreground/15 bg-card lg:grid-cols-[1.4fr_.6fr]"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative h-52 overflow-hidden bg-[#e7e6dc] sm:h-56" role="img" aria-label={`Map preview showing ${venue.name} in ${venue.area}`}>
            <svg viewBox="0 0 900 230" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
              <rect width="900" height="230" fill="#e7e6dc" />
              <path d="M-30 178C115 130 217 154 342 117S604 31 941 81" fill="none" stroke="#fffef9" strokeWidth="28" />
              <path d="M-30 178C115 130 217 154 342 117S604 31 941 81" fill="none" stroke="#c8c6b8" strokeWidth="2" strokeDasharray="9 8" />
              <path d="M176-20c20 70 7 123 32 270M690-20c-18 68-4 137-42 270" fill="none" stroke="#f8f7f1" strokeWidth="18" />
              <path d="M176-20c20 70 7 123 32 270M690-20c-18 68-4 137-42 270" fill="none" stroke="#cbc9bd" strokeWidth="2" />
              <path d="M25 45h122v54H25zM268 20h94v51h-94zM748 132h114v68H748zM455 151h102v55H455z" fill="#dad8ca" stroke="#c8c6b8" />
              <path d="M62 0v230M405 0v230M805 0v230M0 58h900M0 205h900" stroke="#d3d1c4" strokeWidth="1" strokeDasharray="3 7" opacity=".65" />
            </svg>
            <span className="absolute right-[8%] top-[15%] rounded-full bg-card/85 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">{venue.area}</span>
            <motion.div initial={reduceMotion ? false : { y: -12, scale: 0.8, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ delay: 0.38, type: "spring", stiffness: 380, damping: 22 }} className="absolute left-[53%] top-[46%] -translate-x-1/2 -translate-y-1/2">
              <div className="relative grid size-12 place-items-center rounded-full border-4 border-card bg-primary text-white shadow-[0_10px_25px_rgba(196,27,9,.28)]"><VenueIcon name="coffee" className="size-5" /><span className="absolute -bottom-7 whitespace-nowrap rounded-full bg-foreground px-2.5 py-1 text-[10px] font-bold text-background">{venue.name}</span></div>
            </motion.div>
            {venue.mapUrl && (
              <a href={venue.mapUrl} target="_blank" rel="noreferrer" className="absolute left-3 top-3 rounded-full border border-foreground/15 bg-card/95 px-3 py-2 text-xs font-bold shadow-sm backdrop-blur hover:border-foreground">Open in Maps ↗</a>
            )}
          </div>
          <div className="flex flex-col justify-between border-t border-foreground/12 p-5 lg:border-l lg:border-t-0 lg:p-6">
            <div>
              <VenueKicker>{venue.city}</VenueKicker>
              <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.04em]">Easy to reach. Easy to find.</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{venue.address ?? `${venue.area}, ${venue.city}`}</p>
            </div>
            {venue.mapUrl && (
              <a href={venue.mapUrl} target="_blank" rel="noreferrer" className={`${venueButton.outline} mt-5 w-fit`}>
                Open in Google Maps <VenueIcon name="arrow" className="size-4" />
              </a>
            )}
          </div>
        </motion.section>

        <VenueGallery />

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="min-w-0">
            <motion.section {...reveal} className="border-b border-foreground/15 pb-10">
              <VenueKicker>Why it works</VenueKicker>
              <h2 className="mt-2 max-w-2xl font-display text-3xl font-black tracking-[-0.045em] sm:text-4xl">Bring the room together without taking over the whole cafe.</h2>
              <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
                A light-filled first floor for talks and workshops, a terrace for relaxed evening sessions, and smaller tables when you only need a focused conversation.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {([[
                  "people",
                  "Up to 30 guests",
                ], ["projector", "Projector available"], ["coffee", "Food & drinks downstairs"]] as const).map(([icon, label]) => (
                  <div key={label} className="flex items-center gap-3 rounded-2xl bg-card p-4 text-sm font-bold">
                    <VenueIcon name={icon} />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.section>

            <motion.section {...reveal} className="border-b border-foreground/15 py-11">
              <VenueScore venue={venue} />
            </motion.section>

            <motion.section {...reveal} className="py-11" id="spaces">
              <VenueSectionHeading
                kicker="Pick your space"
                title="Choose what fits your event"
                description="Each option is booked separately. Pick a full floor, the terrace, or a table for a smaller conversation."
              />
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                      className={`overflow-hidden rounded-[22px] border text-left transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 ${
                        selected
                          ? "border-primary shadow-[0_0_0_2px_var(--color-primary),0_18px_35px_rgba(20,19,13,0.08)]"
                          : "border-foreground/15 bg-card hover:border-foreground/35"
                      }`}
                    >
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <Image src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, 40vw" className="object-cover transition-transform duration-500 hover:scale-[1.025]" />
                        {selected && (
                          <motion.span initial={reduceMotion ? false : { scale: 0 }} animate={{ scale: 1 }} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-primary text-white shadow-lg">
                            <VenueIcon name="check" className="size-4" />
                          </motion.span>
                        )}
                      </div>
                      <div className="p-5">
                        <VenueKicker>{item.eyebrow}</VenueKicker>
                        <h3 className="mt-2 font-display text-xl font-black tracking-[-0.035em]">{item.name}</h3>
                        <p className="mt-1 text-sm font-semibold">{item.capacity}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                        <p className="mt-4 font-display text-lg font-black">{itemRate === null ? "Ask for a quote" : `${formatRupees(itemRate)} an hour`}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.section>

            {venue.amenities.length > 0 && (
              <motion.section {...reveal} className="border-t border-foreground/15 py-11">
                <VenueSectionHeading kicker="Included" title="What comes with the space" />
                <div className="mt-6 grid gap-px overflow-hidden rounded-[22px] border border-foreground/15 bg-foreground/15 sm:grid-cols-2">
                  {venue.amenities.map((amenity, index) => (
                    <div key={amenity} className="flex min-h-16 items-center gap-3 bg-card p-4 text-sm font-semibold">
                      <VenueIcon name={index === 0 ? "projector" : index === 3 ? "coffee" : "check"} className="size-5 text-primary-ink" />
                      {amenity}
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">Need microphones, recording quiet, or a special furniture layout? Add it to your request and the host will confirm what&apos;s possible.</p>
              </motion.section>
            )}

            <motion.section {...reveal} className="border-t border-foreground/15 py-11">
              <VenueSectionHeading
                kicker="Reviews"
                title="Organizer reviews"
                description="From SCENE bookings and from anyone who has hosted here before."
              />
              <VenueReviews venueSlug={venue.slug} venueName={venue.name} reviews={reviews} summary={reviewSummary} aspects={aspects} />
            </motion.section>

            {venue.policies.length > 0 && (
            <motion.section {...reveal} className="border-t border-foreground/15 py-11">
              <VenueSectionHeading kicker="Good to know" title="A few clear house rules" description="Read these before you request the space. You won&apos;t see new rules at payment." />
              <div className="mt-5 divide-y divide-foreground/12 rounded-[22px] border border-foreground/15 bg-card px-5">
                {venue.policies.map((policy, index) => (
                  <details key={policy} className="group py-4" open={index === 0}>
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold">
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
            className="hidden rounded-[24px] border border-foreground/15 bg-card p-6 shadow-[0_20px_60px_rgba(20,19,13,0.1)] lg:sticky lg:top-24 lg:block"
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <VenueKicker>Your booking</VenueKicker>
            <motion.div key={space.id} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <h2 className="mt-2 font-display text-2xl font-black tracking-[-0.045em]">{space.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{space.capacity}</p>
            </motion.div>
            <label className="mt-5 block text-xs font-bold">
              Event type
              <select value={eventType} onChange={(event) => setEventType(event.target.value as VenueEventType)} className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 text-sm outline-none focus:border-primary">
                {VENUE_EVENT_TYPES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-4 block text-xs font-bold">
              How long?
              <select value={duration} onChange={(event) => setDuration(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded-xl border border-foreground/20 bg-[#fffef9] px-3 text-sm outline-none focus:border-primary">
                {[1, 2, 3, 4, 5, 6].map((item) => <option value={item} key={item}>{item} {item === 1 ? "hour" : "hours"}</option>)}
              </select>
            </label>
            <div className="mt-5 border-y border-foreground/12 py-4">
              <motion.div key={`${space.id}-${eventType}-${duration}`} initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} className="flex items-end justify-between gap-3">
                <div><p className="text-xs text-muted-foreground">Estimated total</p><p className="mt-1 font-display text-3xl font-black">{total === null ? "Host quote" : formatRupees(total)}</p></div>
                {rate !== null && <span className="pb-1 text-xs text-muted-foreground">{formatRupees(rate)}/hr</span>}
              </motion.div>
              {space.minimumFoodSpend && <p className="mt-3 text-xs leading-5 text-muted-foreground">You can also ask about a {formatRupees(space.minimumFoodSpend)} minimum food order instead of hourly rent.</p>}
            </div>
            <button type="button" onClick={() => setBookingOpen(true)} className={`${venueButton.primary} mt-5 w-full`}>Check availability <VenueIcon name="arrow" className="size-4" /></button>
            <p className="mt-3 text-center text-xs leading-5 text-muted-foreground">No charge today. {venue.name} replies within 48 hours.</p>
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary p-4 text-xs leading-5">
              <VenueIcon name="shield" className="mt-0.5 size-4 shrink-0" />
              <span>If accepted, this time is held for 24 hours while you pay and confirm.</span>
            </div>
          </motion.aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-foreground/15 bg-card/95 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
          <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{space.name}</p><p className="font-display text-xl font-black">{total === null ? "Host quote" : formatRupees(total)}</p></div>
          <button type="button" onClick={() => setBookingOpen(true)} className={venueButton.primary}>Check availability</button>
        </div>
      </div>
      <BookingFlow key={`${space.id}-${eventType}-${duration}`} open={bookingOpen} onClose={() => setBookingOpen(false)} space={space} initial={{ ...initial, eventType, duration }} />
    </>
  );
}
