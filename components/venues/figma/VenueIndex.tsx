"use client";

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { formatRupees, venueFromRate, venueMaxGuests } from '@/lib/venues'
import type { CatalogVenue } from '@/lib/venueCatalog'
import Carousel from './Carousel'
import {
  ArrowRight, ChevronLeft, ChevronRight, Coffee, Heart, MapPin, Mic, Projector, ShieldCheck, Star, Users, Wifi, Zap,
} from './icons'

/* "Available for reservation" — Figma node 503:1855 (Scene workflows Main).
 *
 * The old section gave every venue a full-width article (~900px on a phone),
 * so the page grew by a screen per venue. Mobile is the main audience, so on
 * phones the cards sit in one horizontal swipe rail: the section stays one card
 * tall however many venues are live. Tablet and desktop use the design's grid,
 * capped at LIMIT with a link to the full list.
 *
 * Only real catalog fields are shown. The frame's mock venues, "Free this
 * Saturday" availability and venue-type categories have no data behind them,
 * so: filters use the real `area`, and the availability slot carries the
 * no-charge-to-request promise the old section made. */

const LIMIT = 6

/** Design's amenity icons, matched to whatever wording a curator used. */
const AMENITY_ICONS: [RegExp, (p: { className?: string }) => React.ReactElement][] = [
  [/wi-?fi/i, Wifi],
  [/projector|screen/i, Projector],
  [/coffee|caf[eé]|food|beverage/i, Coffee],
  [/power/i, Zap],
  [/\bmic|audio|sound|\bpa\b/i, Mic],
]
const amenityIcon = (a: string) => AMENITY_ICONS.find(([re]) => re.test(a))?.[1]

/** "Best for meetups" / "Best for evenings" space eyebrows → "Meetups, evenings". */
function bestFor(venue: CatalogVenue) {
  const uses = [...new Set(
    venue.spaces.map((s) => /^best for\s+(.+)$/i.exec(s.eyebrow.trim())?.[1]?.toLowerCase()).filter(Boolean),
  )] as string[]
  if (!uses.length) return null
  const text = uses.slice(0, 2).join(', ')
  return text[0].toUpperCase() + text.slice(1)
}

function venueSlides(venue: CatalogVenue, fallback: { src: string; alt: string }[]) {
  const photos = venue.photos.length
    ? venue.photos
    : [...new Set(venue.spaces.flatMap((space) => [space.image, ...(space.photos ?? [])]).filter(Boolean))]
  return photos.length
    ? photos.map((src, i) => ({ src, alt: `${venue.name} — photo ${i + 1}` }))
    : venue.slug === 'time-cafe' ? fallback : []
}

const chip = 'press flex min-h-11 shrink-0 items-center gap-2 border-[1.5px] border-ink px-4 font-mono-b text-xs tracking-[0.72px] uppercase shadow-hard-sm'

export function VenueIndex({
  venues,
  fallbackSlides,
  saved,
  onToggleSave,
  onOpenVenue,
  id = 'spaces',
  description = 'Compare capacity, price and amenities at a glance. Hosts reply within 48 hours.',
}: {
  venues: CatalogVenue[]
  /** Time Cafe's design photos, used only if it has no catalog photos yet. */
  fallbackSlides: { src: string; alt: string }[]
  saved: Record<string, boolean>
  onToggleSave: (slug: string) => void
  onOpenVenue: (slug: string) => void
  id?: string
  description?: string
}) {
  const [area, setArea] = useState<string | null>(null)
  const areas = useMemo(() => {
    const counts = new Map<string, number>()
    for (const v of venues) counts.set(v.area, (counts.get(v.area) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [venues])
  const filtered = area ? venues.filter((v) => v.area === area) : venues
  const shown = filtered.slice(0, LIMIT)

  // Mobile rail position, for the counter and the prev/next buttons.
  const rail = useRef<HTMLUListElement>(null)
  const [index, setIndex] = useState(0)
  const step = () => {
    const el = rail.current
    const card = el?.firstElementChild as HTMLElement | null
    if (!el || !card) return 0
    return card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0')
  }
  const onScroll = () => {
    const el = rail.current
    const w = step()
    if (el && w) setIndex(Math.min(shown.length - 1, Math.round(el.scrollLeft / w)))
  }
  const scrollToCard = (i: number) => {
    const el = rail.current
    if (!el) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: i * step(), behavior: smooth ? 'smooth' : 'auto' })
  }
  // A new filter starts the rail from the first card again.
  useEffect(() => {
    rail.current?.scrollTo({ left: 0 })
  }, [area])

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-16 md:px-8 md:py-24">
      <div className="max-w-[576px]">
        <p className="reveal font-mono-b text-xs leading-4 tracking-[2.16px] uppercase text-primary-ink">Curated Chennai index</p>
        <h2 id={`${id}-title`} className="reveal mt-2 font-head text-[28px] leading-tight tracking-[-0.6px] md:text-[36px] md:leading-[45px] md:tracking-[-0.9px]">
          Available for reservation
        </h2>
        <p className="reveal mt-2 text-[15px] leading-[22.5px] text-stone">
          {description}
        </p>
      </div>

      {/* Area filter. Only worth showing once there is more than one area; on a
          phone it scrolls sideways instead of wrapping into a tall block. */}
      {areas.length > 1 && (
        <div
          role="group"
          aria-label="Filter venues by area"
          className="reveal -mx-5 mt-7 flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {[{ label: 'All', value: null as string | null, count: venues.length }, ...areas.map(([a, c]) => ({ label: a, value: a, count: c }))].map((f) => {
            const active = area === f.value
            return (
              <button
                key={f.label}
                type="button"
                aria-pressed={active}
                onClick={() => setArea(f.value)}
                className={`${chip} ${active ? 'bg-ink text-white' : 'bg-white text-ink'}`}
              >
                {f.label}
                <span className={`px-1.5 py-0.5 text-[10px] leading-[13px] ${active ? 'bg-white/20' : 'bg-sand'}`}>{f.count}</span>
              </button>
            )
          })}
        </div>
      )}

      <p aria-live="polite" className={`font-mono text-xs leading-4 text-stone ${areas.length > 1 ? 'mt-2' : 'mt-7'}`}>
        Showing {shown.length === filtered.length ? '' : `${shown.length} of `}{filtered.length} {filtered.length === 1 ? 'venue' : 'venues'}
      </p>

      {venues.length === 0 ? (
        <p className="mt-6 border border-line bg-white p-5">No venues are currently open for booking. Please check back shortly.</p>
      ) : (
        <>
          <ul
            ref={rail}
            onScroll={onScroll}
            aria-label="Venues"
            className="reveal -mx-5 mt-5 flex items-start snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-3 [scrollbar-width:none] md:mx-0 md:grid md:items-stretch md:snap-none md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3 [&::-webkit-scrollbar]:hidden"
          >
            {shown.map((venue) => (
              <li
                key={venue.slug}
                className={`flex shrink-0 snap-start md:w-auto ${shown.length > 1 ? 'w-[86%] max-w-[380px]' : 'w-full'}`}
              >
                <VenueCard
                  venue={venue}
                  slides={venueSlides(venue, fallbackSlides)}
                  saved={!!saved[venue.slug]}
                  onToggleSave={() => onToggleSave(venue.slug)}
                  onOpen={() => onOpenVenue(venue.slug)}
                />
              </li>
            ))}
          </ul>

          {/* Phone-only rail controls: swiping works, these make position and
              the remaining count visible and give non-swipe users a way through. */}
          {shown.length > 1 && (
            <div className="mt-4 flex items-center justify-between md:hidden">
              <p className="font-mono-b text-xs tracking-[0.8px] text-stone" aria-hidden="true">
                {index + 1} / {shown.length}
              </p>
              <div className="flex gap-2">
                {[
                  { label: 'Previous venue', to: index - 1, I: ChevronLeft, off: index === 0 },
                  { label: 'Next venue', to: index + 1, I: ChevronRight, off: index >= shown.length - 1 },
                ].map(({ label, to, I, off }) => (
                  <button
                    key={label}
                    type="button"
                    aria-label={label}
                    disabled={off}
                    onClick={() => scrollToCard(to)}
                    className="press grid size-11 place-items-center border-[1.5px] border-ink bg-paper text-ink shadow-hard-sm disabled:opacity-40 disabled:shadow-none"
                  >
                    <I className="size-5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col items-center gap-4 text-center">
            {filtered.length > LIMIT && (
              <Link href="/venues/search" className={`${chip} bg-white text-ink`}>
                View all {filtered.length} venues <ArrowRight className="size-4" />
              </Link>
            )}
            <p className="flex items-center gap-2 text-sm text-stone">
              <ShieldCheck className="size-4 shrink-0 text-moss" />
              More independently owned Chennai venues are joining soon.
            </p>
          </div>
        </>
      )}
    </section>
  )
}

function VenueCard({
  venue,
  slides,
  saved,
  onToggleSave,
  onOpen,
}: {
  venue: CatalogVenue
  slides: { src: string; alt: string }[]
  saved: boolean
  onToggleSave: () => void
  onOpen: () => void
}) {
  const guests = venueMaxGuests(venue)
  const rate = venueFromRate(venue)
  const uses = bestFor(venue)
  // Some venues list amenities only on their rooms; fall back to those.
  const amenities = venue.amenities.length
    ? venue.amenities
    : [...new Map(venue.spaces.flatMap((s) => s.amenities).map((a) => [a.toLowerCase(), a.replace(/^./, (c) => c.toUpperCase())])).values()]
  const shownAmenities = amenities.slice(0, 3)
  const moreAmenities = amenities.length - shownAmenities.length
  const spaces = venue.spaces.length

  return (
    <article className="flex w-full min-w-0 flex-col border-[1.5px] border-ink bg-white shadow-hard">
      <div className="relative border-b-[1.5px] border-ink">
        <Carousel slides={slides} label={`${venue.name} photos`} className="aspect-[4/3]" arrowClassName="size-11" />
        <p className="pointer-events-none absolute left-3 top-3 bg-paper px-2.5 py-1 font-mono-b text-[10px] leading-[15px] tracking-[0.8px] uppercase">
          Venue partner
        </p>
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? `Remove ${venue.name} from saved spaces` : `Save ${venue.name} to spaces`}
          onClick={onToggleSave}
          className={`press absolute right-3 top-3 grid size-11 place-items-center border-[1.5px] border-ink shadow-hard-sm ${saved ? 'bg-flame text-white' : 'bg-paper text-ink'}`}
        >
          <Heart className={`size-[18px] ${saved ? 'anim-stamp fill-current' : ''}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="flex min-w-0 items-center gap-1 font-mono-b text-[11px] leading-[16.5px] tracking-[0.55px] uppercase text-stone">
            <MapPin className="size-[13px] shrink-0" />
            <span className="truncate">{venue.area}</span>
          </p>
          {venue.rating !== null && (
            <p className="flex shrink-0 items-center gap-1 font-mono text-xs leading-4 text-stone">
              <Star className="size-3 text-ink" />
              <span className="font-mono-b text-ink">{venue.rating}</span>
              {venue.ratingCount !== null && <span>({venue.ratingCount})</span>}
              <span>dining</span>
            </p>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 font-head text-xl leading-[27.5px]">{venue.name}</h3>
        <p className="flex flex-wrap items-center gap-x-2 text-sm leading-5 text-stone">
          {spaces > 0 && <span>{spaces} bookable {spaces === 1 ? 'space' : 'spaces'}</span>}
          {/* Same rule as VenueDetail's "Verified on-site" copy: only venues
              the team has visited. Move to a catalog field when one exists. */}
          {venue.slug === 'time-cafe' && (
            <span className="inline-flex items-center gap-1 text-moss">
              <ShieldCheck className="size-[13px]" /> Verified
            </span>
          )}
        </p>

        <dl className="mt-4 grid grid-cols-2 border-[1.5px] border-ink">
          <div className="min-w-0 border-r-[1.5px] border-ink p-3">
            <dt className="font-mono text-[10px] leading-[15px] tracking-[0.8px] uppercase text-stone">Fits</dt>
            <dd className="mt-0.5 flex items-center gap-1.5 font-head text-base leading-6">
              <Users className="size-[15px] shrink-0" />
              {guests === null ? 'Ask host' : `${guests} guests`}
            </dd>
          </div>
          <div className="min-w-0 p-3">
            <dt className="font-mono text-[10px] leading-[15px] tracking-[0.8px] uppercase text-stone">From</dt>
            <dd className="mt-0.5 leading-6">
              {rate === null ? (
                <span className="font-head text-base">Host quote</span>
              ) : (
                <>
                  <span className="font-head text-base">{formatRupees(rate)}</span>{' '}
                  {/* The space sits outside the nowrap span so the suffix can drop
                      to its own line on a narrow card instead of overflowing. */}
                  <span className="whitespace-nowrap text-xs leading-4 text-stone">/hr · 1h min</span>
                </>
              )}
            </dd>
          </div>
        </dl>

        {uses && (
          <p className="mt-4 text-sm leading-5 text-ink">
            <span className="font-mono-b text-[10px] tracking-[0.8px] uppercase text-stone">Best for </span>
            {uses}
          </p>
        )}

        {amenities.length > 0 && (
          <ul aria-label="Amenities" className="mt-3 flex flex-wrap gap-1.5">
            {shownAmenities.map((a) => {
              const I = amenityIcon(a)
              return (
                <li key={a} className="flex items-center gap-1.5 bg-sand px-2 py-1.5 text-xs leading-4 text-ink">
                  {I && <I className="size-[13px] shrink-0" />}
                  {a}
                </li>
              )
            })}
            {moreAmenities > 0 && (
              <li className="flex items-center bg-sand px-2 py-1.5 text-xs leading-4 text-stone">+{moreAmenities} more</li>
            )}
          </ul>
        )}

        <div className="@container mt-auto pt-5">
          <div className="flex flex-col gap-3 @[19.5rem]:flex-row @[19.5rem]:items-center @[19.5rem]:justify-between">
          <p className="flex items-center gap-1.5 font-mono-b text-[11px] leading-[16.5px] text-moss">
            <ShieldCheck className="size-[13px] shrink-0" /> No charge to request
          </p>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`View ${venue.name}`}
            className="press inline-flex min-h-11 items-center justify-center gap-2 border-[1.5px] border-ink bg-primary-ink px-4 font-mono-b text-xs tracking-[0.72px] uppercase text-white shadow-hard-sm"
          >
            View space <ArrowRight className="size-[15px]" />
          </button>
          </div>
        </div>
      </div>
    </article>
  )
}
