"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import FieldError from './FieldError'
import Dropdown from './Dropdown'
import BookingConfirmation from './BookingConfirmation'
import useReveal from './useReveal'
import type { Profile } from './AuthModal'
import { useRouter } from 'next/navigation'
import { SiteFooter, SiteHeader } from './SiteChrome'
import { useVenueApp } from './VenueApp'
import { bookingCreated } from '@/lib/client/venueBookingStore'
import { useVenueBookingDraft } from '@/lib/client/useVenueBookingDraft'
import { amountDue, rateForSpace, VENUE_EVENT_TYPES, venueSearchHref } from '@/lib/venues'
import { matchingSpaces, type VenueSearchValues } from '@/lib/venueSearch'
import { publishedVenueReviews } from '@/lib/venueTestimonials'
import { ChandruTestimonial } from './ChandruTestimonial'
import { EventFit } from './EventFit'
import { validateVenueBookingWindow } from '@/lib/venueBookingValidation'
import type { CatalogVenue } from '@/lib/venueCatalog'
import { venueRoomPhotos } from '@/lib/venueRoomPhotos'
import ReviewFlow from './ReviewFlow'
import { submitVenueReviewWithPhotos } from '@/lib/client/venueReviewApi'
import type { VenueReview } from '@/lib/venueBookings'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Close,
  Coffee,
  Heart,
  MapPin,
  Mic,
  Projector,
  Quote,
  Scissors,
  Share,
  ShieldCheck,
  Star,
  Users,
  Volume,
  Wifi,
  Zap,
} from './icons'
const courtyard = '/venues/figma/venue-b1270.jpg'
const terrace = '/venues/figma/venue-76a4b.jpg'
const longTable = '/venues/figma/venue-ada0b.jpg'
const suite = '/venues/figma/venue-10678.jpg'
const barista = '/venues/figma/venue-25fa2.jpg'
const spaceDesigns = [
  {
    id: 'floor',
    dbId: 'first-floor',
    tag: 'Best for meetups',
    name: 'First-floor event space',
    cap: '25–30 people',
    max: 30,
    price: 2000,
    desc: 'A flexible indoor floor for talks, workshops, recordings, and professional gatherings.',
    img: '/venues/figma/spaces-f33c5.jpg',
    photos: [
      { src: '/venues/figma/spaces-f33c5.jpg', alt: 'First-floor event space wide view with presentation screen and projector setup' },
      { src: '/venues/figma/spaces-89376.jpg', alt: 'First floor event hall looking towards the rear seating and ambient lighting' },
      { src: '/venues/figma/spaces-b1270.jpg', alt: 'Event space floor with modular conference tables and audio speaker setup' },
      { src: '/venues/figma/spaces-d2955.jpg', alt: 'Brightly lit daytime seating area in the first-floor event space' },
    ],
    alt: 'First-floor event space set up for a talk with rows of seating.',
  },
  {
    id: 'korean',
    dbId: 'korean-table',
    tag: 'Best for evenings',
    name: 'Korean table',
    cap: 'Up to 8 people',
    max: 8,
    price: 1000,
    desc: 'A low, communal Korean-style table for shared meals, tastings, and relaxed evening sessions.',
    img: '/venues/figma/spaces-86081.jpg',
    photos: [
      { src: '/venues/figma/spaces-86081.jpg', alt: 'Korean table with floor chairs and white marble dining tabletop' },
      { src: '/venues/figma/spaces-f59d4.jpg', alt: 'Side view of Korean table setup showing low wood-back chairs' },
      { src: '/venues/figma/spaces-10678.jpg', alt: 'Extended Korean table seating arrangement with cushioned bench seats' },
      { src: '/venues/figma/spaces-43767.jpg', alt: 'Korean dining and meeting space with ambient evening background' },
    ],
    alt: 'Korean-style low table laid for a shared meal.',
  },
  {
    id: 'conversation',
    dbId: 'standard-table',
    tag: 'For a small circle',
    name: 'Conversation table',
    cap: 'Up to 4 people',
    max: 4,
    price: 400,
    desc: 'A dedicated table for mentoring, interviews, and focused small-group conversations.',
    img: '/venues/figma/spaces-d5006.jpg',
    photos: [
      { src: '/venues/figma/spaces-d5006.jpg', alt: 'Conversation table set for four with wooden bookcase and artwork' },
      { src: '/venues/figma/spaces-c3056.jpg', alt: 'Angled perspective of conversation table and comfortable modern chairs' },
      { src: '/venues/figma/spaces-25fa2.jpg', alt: 'Conversation table view facing the vintage wall decor and showcase' },
      { src: '/venues/figma/spaces-c4313.jpg', alt: 'Conversation table with staircase railing and warm pendant fixture' },
      { src: '/venues/figma/spaces-27065.jpg', alt: 'Warm cafe interior with team collaborative gathering around the table' },
    ],
    alt: 'Intimate conversation table beside a bright window.',
  },
  {
    id: 'terrace',
    dbId: 'terrace',
    tag: 'Under the sky',
    name: 'BBQ table',
    cap: 'Up to 16 people',
    max: 16,
    price: 1500,
    desc: 'A rooftop terrace with a built-in BBQ grill, string lights, and Chennai skyline views — best for sundowners and casual evening cookouts.',
    img: '/venues/time-cafe/bbq-table.png',
    photos: [
      { src: '/venues/time-cafe/bbq-table.png', alt: 'Time Cafe BBQ table under warm terrace string lights' },
      { src: '/venues/time-cafe/bbq-table-views.png', alt: 'Two views of the Time Cafe BBQ table and terrace' },
    ],
    alt: 'Open-air terrace with potted plants and communal tables.',
  },
]

const gallery = [
  { src: '/venues/figma/gallery-gal_8.jpg', alt: 'Paved outdoor cafe walkway flanked by tropical palm greenery and warm vintage carriage wall lamps.' },
  { src: '/venues/figma/gallery-gal_4.jpg', alt: 'Naturally lit dining room with contemporary wooden chairs and tables.' },
  { src: '/venues/figma/gallery-gal_5.jpg', alt: 'Intimate reading nook with wooden console, lampshade, and lush potted greenery.' },
  { src: '/venues/figma/gallery-gal_6.jpg', alt: 'Korean-style low seating table with cushioned backrests and ambient lighting.' },
  { src: '/venues/figma/gallery-gal_1.jpg', alt: 'Specialty iced layered caramel coffee served on a rustic timber tray.' },
  { src: '/venues/figma/gallery-gal_2.jpg', alt: 'Gourmet slider burgers on toasted brioche buns with melted cheese.' },
  { src: '/venues/figma/gallery-gal_3.jpg', alt: 'Fresh spaghetti tossed with roasted cherry tomatoes, olives, herbs, and shaved parmesan.' },
  { src: '/venues/figma/gallery-gal_7.jpg', alt: 'Artisanal refreshing iced juices and cold brew beverages.' },
  { src: courtyard, alt: 'Time Cafe courtyard with mature greenery, wooden pergolas, and tables arranged for guests.' },
  { src: terrace, alt: 'Open-air cafe terrace with potted plants and communal tables.' },
  { src: longTable, alt: 'Long communal wooden table in a calm, naturally lit room.' },
  { src: suite, alt: 'Presentation suite with rows of seating facing a projector wall.' },
  { src: barista, alt: 'Barista counter with espresso machine and hanging pendant lights.' },
]


const amenities = [
  { I: Projector, t: '4K ultra-short projector', d: '120-inch matte wall + HDMI/USB-C' },
  { I: Volume, t: 'PA speaker system', d: 'Stereo floor monitors, 2× 15-inch' },
  { I: Mic, t: 'Wireless handheld mics', d: '2× Shure BLX24 included' },
  { I: Wifi, t: '500 Mbps leased line', d: 'Wired uplink on request' },
  { I: Coffee, t: 'Full barista counter', d: 'Filter, espresso & chai, staffed' },
  { I: Zap, t: 'Device charging station', d: 'USB-A & USB-C, 10 ports' },
  { I: ShieldCheck, t: 'DG power backup', d: 'Zero-gap switchover' },
  { I: Users, t: 'Dedicated AV technician', d: 'On-site for the full booking' },
  { I: MapPin, t: 'Street & valet parking', d: '6 cars, 2-wheeler space' },
  { I: Scissors, t: 'Craft & workshop supplies', d: 'Scissors, tape, markers, pins' },
]

const eventTypes: string[] = [...VENUE_EVENT_TYPES]
const hourOptions = [1, 2, 3, 4, 5, 6, 7, 8]

type TimeCafeDraft = {
  spaceId: string
  eventType: string
  date: string
  start: string
  hours: number
  guests: string
  social: string
  message: string
}

const initialBookingDraft: TimeCafeDraft = {
  spaceId: 'first-floor', eventType: '', date: '', start: '11:00', hours: 1,
  guests: '25', social: '', message: '',
}

function parseTimeCafeDraft(data: unknown, spaceId: string): TimeCafeDraft | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const saved = data as Record<string, unknown>
  if (saved.kind !== 'figma') return null
  return {
    // Resume older on-device drafts, but all new saves use catalog space keys.
    spaceId: spaceDesigns.find(s => s.id === spaceId)?.dbId ?? spaceId,
    eventType: typeof saved.eventType === 'string' && eventTypes.includes(saved.eventType) ? saved.eventType : '',
    date: typeof saved.date === 'string' ? saved.date : '',
    start: typeof saved.start === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(saved.start) ? saved.start : '11:00',
    hours: typeof saved.hours === 'number' && hourOptions.includes(saved.hours) ? saved.hours : 1,
    guests: typeof saved.guests === 'string' ? saved.guests : '25',
    social: typeof saved.social === 'string' ? saved.social : '',
    message: typeof saved.message === 'string' ? saved.message : '',
  }
}

function serializeTimeCafeDraft(value: TimeCafeDraft): Record<string, unknown> {
  return { kind: 'figma', eventType: value.eventType, date: value.date, start: value.start,
    hours: value.hours, guests: value.guests, social: value.social, message: value.message }
}

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
const monoLabel = 'font-mono-b text-[10px] leading-[15px] tracking-[0.8px] uppercase text-stone'
const fieldBox =
  'flex flex-col gap-1 border-[1.5px] border-ink bg-paper-2 p-3 transition-colors focus-within:bg-white focus-within:shadow-hard-sm has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:bg-danger-tint'

const inputCls =
  'w-full bg-transparent font-body-m text-sm text-ink placeholder:text-stone/60 focus:outline-none'


function Lightbox({ index, onIndex, onClose, gallery }: { index: number | null; onIndex: (i: number) => void; onClose: () => void; gallery: { src: string; alt: string }[] }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (index !== null && !d.open) d.showModal()
    if (index === null && d.open) d.close()
  }, [index])
  const go = (dir: number) => onIndex((((index ?? 0) + dir) % gallery.length + gallery.length) % gallery.length)
  const item = gallery[index ?? 0]
  return (
    <dialog
      ref={ref}
      aria-label="Venue photo gallery"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') go(1)
        if (e.key === 'ArrowLeft') go(-1)
      }}
      className="m-auto w-[min(960px,94vw)] border-[1.5px] border-ink bg-ink p-0 text-white shadow-hard-lg backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {index !== null && (
        <div className="anim-pop">
          <div className="flex items-center justify-between px-4 py-3">
            <p className="font-mono-b text-[11px] tracking-[1px] uppercase" aria-live="polite">
              Photo {index + 1} of {gallery.length}
            </p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close gallery"
              className="grid size-10 place-items-center transition-transform hover:rotate-90"
            >
              <Close className="size-5" />
            </button>
          </div>
          <div className="relative">
            <img key={index} src={item.src} alt={item.alt} className="anim-fade aspect-[16/10] w-full object-cover" />
            {(['prev', 'next'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => go(d === 'next' ? 1 : -1)}
                aria-label={d === 'next' ? 'Next photo' : 'Previous photo'}
                className={`press absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center border-[1.5px] border-ink bg-paper text-ink shadow-hard-sm ${d === 'next' ? 'right-3' : 'left-3'}`}
              >
                {d === 'next' ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
              </button>
            ))}
          </div>
          <p className="px-4 py-3 text-sm text-white/80">{item.alt}</p>
        </div>
      )}
    </dialog>
  )
}

function SpaceCardCarousel({
  space,
  isSelected,
  onSelect,
  onKeyDown,
  index,
}: {
  space: Omit<(typeof spaceDesigns)[number], 'price'> & { price: number | null }
  isSelected: boolean
  onSelect: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  index: number
}) {
  const [activePhoto, setActivePhoto] = useState(0)
  const [isHovered, setIsHovered] = useState(false)
  const [isIntersectingMobile, setIsIntersectingMobile] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLUListElement>(null)
  const photos = space.photos || [{ src: space.img, alt: space.alt }]

  // Detect when card is scrolled into viewport on mobile
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsIntersectingMobile(entry.isIntersecting && entry.intersectionRatio >= 0.5)
      },
      { threshold: [0.2, 0.5, 0.8] }
    )
    observer.observe(card)
    return () => observer.disconnect()
  }, [])

  // Scroll to specific photo index
  const scrollToPhoto = (idx: number, smooth = true) => {
    const nextIdx = (idx + photos.length) % photos.length
    setActivePhoto(nextIdx)
    const track = trackRef.current
    if (track) {
      const targetLeft = nextIdx * track.clientWidth
      track.scrollTo({ left: targetLeft, behavior: smooth ? 'smooth' : 'auto' })
    }
  }

  // Auto-scroll ONLY when user hovers (desktop) OR when card is scrolled into view (mobile)
  useEffect(() => {
    if (photos.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    const shouldAutoAdvance = isHovered || (isMobile && isIntersectingMobile)

    if (!shouldAutoAdvance) return

    const timer = setInterval(() => {
      setActivePhoto((prev) => {
        const next = (prev + 1) % photos.length
        const track = trackRef.current
        if (track) {
          track.scrollTo({ left: next * track.clientWidth, behavior: 'smooth' })
        }
        return next
      })
    }, 2800)

    return () => clearInterval(timer)
  }, [isHovered, isIntersectingMobile, photos.length])

  // Keep active photo indicator synced on manual drag / swipe
  const handleScroll = () => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    const scrollPos = track.scrollLeft
    const newIdx = Math.round(scrollPos / track.clientWidth)
    if (newIdx !== activePhoto && newIdx >= 0 && newIdx < photos.length) {
      setActivePhoto(newIdx)
    }
  }

  return (
    <div
      ref={cardRef}
      data-space-card
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setIsHovered(true)}
      onBlurCapture={() => setIsHovered(false)}
      className={`anim-fade group relative flex flex-col overflow-hidden rounded-2xl border bg-white/[0.04] backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 ${
        isSelected
          ? 'border-flame/80 shadow-[6px_6px_0_0_#ff432a,0_0_40px_-8px_rgba(255,67,42,0.55)]'
          : 'border-white/15 shadow-[0_20px_40px_-24px_rgba(255,67,42,0.45)] hover:border-white/35 hover:shadow-[4px_4px_0_0_rgba(255,67,42,0.7)]'
      }`}
      style={{ '--d': `${index * 90}ms` } as React.CSSProperties}
    >
      {/* Carousel Section */}
      <div className="relative m-2 overflow-hidden rounded-xl bg-black/40">
        <ul
          ref={trackRef}
          onScroll={handleScroll}
          aria-label={`${space.name} photos`}
          className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((item, k) => (
            <li key={k} className="relative w-full shrink-0 snap-center">
              <img
                src={item.src}
                alt={item.alt || `${space.name}, photo ${k + 1} of ${photos.length}`}
                loading="lazy"
                decoding="async"
                className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </li>
          ))}
        </ul>

        {/* Tag Pill */}
        <span className="pointer-events-none absolute top-3 left-3 rounded-full border border-white/20 bg-black/50 px-2.5 py-1 font-mono-b text-[10px] tracking-[0.8px] uppercase text-white backdrop-blur-md">
          {space.tag}
        </span>

        {/* Active Index Badge */}
        <div className="pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/60 px-2.5 py-1 font-mono text-[11px] text-white backdrop-blur-md">
          {(isHovered || isIntersectingMobile) && photos.length > 1 && (
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-flame" title="Auto-scrolling" />
          )}
          <span>
            {activePhoto + 1} / {photos.length} photos
          </span>
        </div>

        {/* Dot indicators */}
        {photos.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
            {photos.map((_, dotIdx) => (
              <span
                key={dotIdx}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  dotIdx === activePhoto ? 'w-5 bg-flame' : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Previous / Next buttons */}
        {photos.length > 1 && (
          <>
            <button
              type="button"
              aria-label={`Previous photo of ${space.name}`}
              onClick={(e) => {
                e.stopPropagation()
                scrollToPhoto(activePhoto - 1)
              }}
              className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/55 text-white opacity-100 backdrop-blur-md transition hover:scale-105 hover:bg-flame hover:border-flame focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label={`Next photo of ${space.name}`}
              onClick={(e) => {
                e.stopPropagation()
                scrollToPhoto(activePhoto + 1)
              }}
              className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/25 bg-black/55 text-white opacity-100 backdrop-blur-md transition hover:scale-105 hover:bg-flame hover:border-flame focus-visible:opacity-100 md:opacity-0 md:group-hover:opacity-100"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {/* Card Details (Below Photo) */}
      <button
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={onSelect}
        onKeyDown={onKeyDown}
        tabIndex={isSelected ? 0 : -1}
        className="flex flex-1 flex-col px-5 pt-3 pb-5 text-left focus-visible:outline-offset-[-4px]"
      >
        <span className="flex items-start justify-between gap-3">
          <span className="font-head text-xl leading-7">{space.name}</span>
          <span
            aria-hidden="true"
            className={`mt-1 grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] transition ${
              isSelected ? 'border-flame bg-flame' : 'border-white/40'
            }`}
          >
            {isSelected && <Check className="anim-stamp size-3.5 text-white" strokeWidth={3} />}
          </span>
        </span>
        <span className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[13px] text-white/85">
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-flame" /> {space.cap}
          </span>
          <span className="font-mono-b text-white">{space.price === null ? 'Host quote' : `${money(space.price)} an hour`}</span>
        </span>
        <span className="mt-3 block text-sm leading-[22px] text-[#c8c6c5]">{space.desc}</span>
        <span
          className={`mt-4 font-mono-b text-[11px] tracking-[1.2px] uppercase ${
            isSelected ? 'text-flame' : 'text-white/60'
          }`}
        >
          {isSelected ? 'Selected' : 'Select this space'}
        </span>
      </button>
    </div>
  )
}

/**
 * Time Cafe's approved visual layout, wired to real booking/auth, published
 * reviews and catalog location data. Organisers pay the listed venue price;
 * commission is host-side. Detailed equipment copy still needs owner verification.
 */
export default function VenueDetail({ venue, publishedReviews = [], search, initialSpaceId }: {
  venue: CatalogVenue; publishedReviews?: VenueReview[]; search?: VenueSearchValues; initialSpaceId?: string
}) {
  // Photos the host manages in their workspace replace the design art once they
  // add any; venues with an empty gallery still render the approved design.
  const photos = venue.photos.length
    ? venue.photos.map((src, i) => ({ src, alt: `${venue.name} photo ${i + 1}` }))
    : gallery
  // Keep the approved design, but booking facts come from the same
  // catalog record used by the POST and Razorpay handlers.
  const spaces = venue.spaces.map(s => {
    const design = spaceDesigns.find(d => d.dbId === s.id)
    return { ...spaceDesigns[0], ...design, id: s.id, dbId: s.id,
      name: s.name, tag: s.eyebrow, desc: s.description, cap: s.capacity, max: s.maxGuests,
      img: s.image, alt: s.name, photos: venueRoomPhotos(s.image, s.name, design?.photos, s.photos),
      price: rateForSpace(s, '') }
  })
  const reviews = publishedVenueReviews(publishedReviews).map(r => ({ id: r.id, n: r.organizerName || 'Organiser', q: r.comment || '',
    imgs: r.photoConsent ? r.photoIds.map(id => `/api/poster/${id}`) : [], rating: r.rating,
    date: new Date(r.createdAt).toLocaleDateString('en-IN'), event: r.eventType || '', source: r.source }));
  const reviewAverage = reviews.length ? (reviews.reduce((sum,r) => sum + r.rating, 0) / reviews.length).toFixed(2) : null;
  const mapQuery = encodeURIComponent(venue.address || [venue.name, venue.area, venue.city].join(', '));
  const router = useRouter()
  const { profile, authReady, requireAuth } = useVenueApp()
  const onBack = () => router.push(search ? venueSearchHref(search) : '/venues')
  useReveal()
  const searchedSpace = venue.spaces.find(s => s.id === initialSpaceId)
    ?? matchingSpaces(venue.spaces, search?.people ?? '')[0] ?? venue.spaces[0]
  const selection: Partial<TimeCafeDraft> = {
    ...(search?.eventType ? { eventType: search.eventType } : {}),
    ...(search?.date && /^\d{4}-\d{2}-\d{2}$/.test(search.date) ? { date: search.date } : {}),
    ...(search?.time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(search.time) ? { start: search.time } : {}),
    ...(search?.people.trim() ? { guests: search.people } : {}),
    ...(initialSpaceId || search?.people.trim() ? { spaceId: searchedSpace?.id } : {}),
  }
  const { value: draft, update: updateDraft, saveStatus, clear: clearDraft } = useVenueBookingDraft({
    venueSlug: 'time-cafe', initial: { ...initialBookingDraft,
      spaceId: searchedSpace?.id ?? 'first-floor', guests: String(Math.min(25, searchedSpace?.maxGuests ?? 25)), ...selection }, profilePhone: profile?.phone ?? null,
    authReady, parse: parseTimeCafeDraft, serialize: serializeTimeCafeDraft, selection,
  })
  const { spaceId, eventType, date, start, hours, guests, social, message } = draft
  const space = spaces.find((s) => s.id === spaceId) ?? spaces[0]
  const catalogSpace = venue.spaces.find(s => s.id === space?.dbId)
  const hourlyRate = catalogSpace ? rateForSpace(catalogSpace, eventType) : null
  const [saved, setSaved] = useState(false)
  const [photo, setPhoto] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'form' | 'sending' | 'sent'>('form')
  const [submitError, setSubmitError] = useState('')
  const sending = useRef(false)

  const title = useRef<HTMLHeadingElement>(null)
  const sentTitle = useRef<HTMLHeadingElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const bookingRef = useRef<HTMLElement>(null)
  const idBase = useId()
  const hostName = 'Time Cafe team'

  useEffect(() => {
    document.title = 'Time Cafe · SCENE/044'
    title.current?.focus({ preventScroll: true })
    return () => {
      document.title = 'SCENE/044'
    }
  }, [])

  const subtotal = hourlyRate === null ? null : hourlyRate * hours
  const total = subtotal === null ? null : amountDue(subtotal)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

  const validate = () => {
    const e: Record<string, string> = {}
    if (!eventType) e.type = 'Choose what you are planning.'
    const windowError = validateVenueBookingWindow(date, start, hours)
    if (windowError) e[windowError.field] = windowError.error
    const g = Number(guests)
    if (!guests || !Number.isInteger(g) || g < 1) e.guests = 'Enter a whole number of guests.'
    else if (g > space.max) e.guests = `This space fits up to ${space.max} guests.`
    if (!social.trim()) e.social = 'Add a LinkedIn or Instagram link so the host knows who you are.'
    if (message.trim().length < 10) e.message = 'Tell the host a little about your plan (at least 10 characters).'
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)
      ;(el?.matches('input,textarea,select') ? el : el?.querySelector('button'))?.focus()
    }
    return !first
  }

  /** Sends the real booking request (POST /api/venue-bookings). */
  const send = async (who: Profile) => {
    if (sending.current || !validate()) return
    sending.current = true
    setStatus('sending')
    setSubmitError('')
    const link = social.trim()
    try {
      const res = await fetch('/api/venue-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          venueSlug: 'time-cafe',
          spaceId: space.dbId,
          date,
          time: start,
          duration: hours,
          people: Number(guests),
          eventType,
          description: message.trim(),
          name: who.name,
          email: who.email,
          phone: who.phone,
          trustType: /instagram/i.test(link) ? 'Instagram' : /linkedin/i.test(link) ? 'LinkedIn' : 'Website',
          trustUrl: /^https?:\/\//i.test(link) ? link : `https://${link}`,
          whatsappOptIn: true,
          emailOptIn: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not send your request. Try again shortly.')
      bookingCreated()
      await clearDraft().catch(() => undefined)
      setStatus('sent')
      setConfirmOpen(true)
    } catch (err) {
      setStatus('form')
      setSubmitError(err instanceof Error ? err.message : 'Could not send your request.')
    } finally {
      sending.current = false
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending' || !validate()) return
    // Signed-in organisers with an email go straight through; anyone else
    // verifies their number first, then the request is sent automatically.
    if (profile?.email && profile.role === 'Organiser') send(profile)
    else requireAuth((p) => send(p))
  }


  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: 'Time Cafe · SCENE/044', url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      }
    } catch {
      /* dismissed */
    }
  }

  const pickSpace = (id: string) => {
    const max = spaces.find((s) => s.id === id)!.max
    updateDraft((current) => ({ ...current, spaceId: id }))
    setErrors((e) => ({ ...e, guests: Number(guests) > max ? `This space fits up to ${max} guests. Your group size has not been changed.` : '' }))
    bookingRef.current?.classList.remove('flash')
    void bookingRef.current?.offsetWidth
    bookingRef.current?.classList.add('flash')
  }

  const err = (k: string) => (errors[k] ? `${idBase}-${k}` : undefined)
  // A render helper, not a component: defining a component inside render
  // remounts it on every keystroke.
  const errorText = (k: string) =>
    errors[k] ? (
      <FieldError id={`${idBase}-${k}`} className="mt-1.5">
        {errors[k]}
      </FieldError>
    ) : null

  const dateNice = date ? new Date(`${date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  if (!space) return <div className="min-h-screen bg-paper"><SiteHeader wide /><main className="mx-auto max-w-3xl px-5 py-20"><h1 className="font-head text-3xl">Time Cafe</h1><p className="mt-4">No spaces are currently available for booking. Please check back shortly.</p></main><SiteFooter wide /></div>

  return (
    <div className="page-in min-h-screen bg-paper text-ink">
      <SiteHeader wide />

      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-20 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="group flex min-h-8 items-center gap-2 font-mono-b text-xs tracking-[0.96px] uppercase text-stone transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /> {search ? 'Back to your search' : 'Chennai | event spaces'}
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={share}
              className="flex min-h-10 items-center gap-1.5 px-3 font-mono-b text-xs tracking-[0.72px] uppercase underline underline-offset-4"
            >
              <Share className="size-4" /> Share
            </button>
            <button
              type="button"
              aria-pressed={saved}
              onClick={() => setSaved((v) => !v)}
              className="flex min-h-10 items-center gap-1.5 px-3 font-mono-b text-xs tracking-[0.72px] uppercase underline underline-offset-4"
            >
              <Heart className={`size-4 ${saved ? 'anim-stamp fill-flame text-flame' : ''}`} /> {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
        <p role="status" className="sr-only">
          {copied ? 'Link copied to clipboard' : ''}
        </p>
        {copied && (
          <p aria-hidden="true" className="anim-pop fixed bottom-6 left-1/2 z-40 -translate-x-1/2 border-[1.5px] border-ink bg-paper px-4 py-2 font-mono-b text-xs uppercase shadow-hard-sm">
            Link copied
          </p>
        )}

        <header className="rise mt-4">
          <p className="font-mono-b text-[11px] tracking-[1.32px] uppercase text-flame">A Place we love · Nungambakkam</p>
          <h1 ref={title} tabIndex={-1} className="mt-2 font-p-display text-[40px] leading-[1.05] tracking-[-1.2px] focus:outline-none md:text-[56px]">
            Time Cafe
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-stone">
            <span className="flex items-center gap-1.5">
              <Star className="size-4 text-flame" />
              <span className="font-body-m text-ink">{venue.rating ?? "—"}</span>
              <span className="font-mono-b text-[11px] tracking-[0.6px] uppercase">(Public cafe rating, not SCENE bookings)</span>
            </span>
            <span aria-hidden="true">·</span>
            <a href={venue.mapUrl || `https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 underline underline-offset-4">
              <MapPin className="size-4 shrink-0" /> {venue.area}, {venue.city} · Google Maps<span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 font-mono-b text-xs tracking-[0.72px] uppercase text-moss">
              <ShieldCheck className="size-[15px]" /> Verified on-site
            </span>
          </p>
          <p className="mt-3 text-sm leading-6 text-stone">Explore the spaces and location first. A booking request is not a confirmed booking, and no payment is taken here.</p>
          <details className="mt-4 border border-line bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium">View map &amp; exact address</summary>
            <p className="mt-3 text-sm">{venue.address || `${venue.area}, ${venue.city}`}</p>
            <iframe title={`Location of ${venue.name}`} src={venue.mapEmbedUrl || `https://www.google.com/maps?q=${mapQuery}&z=16&output=embed`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="mt-4 block h-60 w-full border-0" />
          </details>
        </header>

        <section aria-label="Photos" className="rise mt-6" style={{ '--d': '120ms' } as React.CSSProperties}>
          <div className="flex h-[300px] snap-x snap-mandatory gap-[1.5px] overflow-x-auto overscroll-x-contain border-[1.5px] border-ink bg-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:h-[380px] lg:grid lg:h-[448px] lg:snap-none lg:grid-cols-4 lg:grid-rows-2 lg:overflow-hidden">
            {photos.slice(0, 5).map((g, i) => (
              <button
                key={g.src}
                type="button"
                onClick={() => setPhoto(i)}
                aria-label={`Open photo ${i + 1}: ${g.alt}`}
                className={`group relative overflow-hidden bg-sand h-full w-[85%] shrink-0 snap-start sm:w-[60%] lg:w-auto lg:shrink ${i === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}`}
              >
                <img
                  src={g.src}
                  alt=""
                  loading={i === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                  className="size-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                />
                {i === 4 && (
                  <span className="absolute bottom-3 right-3 border-[1.5px] border-ink bg-paper px-3 py-2 font-mono-b text-[10px] tracking-[0.6px] uppercase shadow-hard-sm">
                    Show all {photos.length} photos
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
        <Lightbox index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} gallery={photos} />

        <section aria-labelledby="spaces-title" className="reveal mt-12 border-[1.5px] border-ink bg-[#0a0812] p-6 text-white shadow-hard md:p-10">
          <p className="font-mono-b text-[11px] tracking-[1.76px] uppercase text-flame">Pick your space</p>
          <h2 id="spaces-title" className="mt-2 max-w-[672px] font-head text-[28px] leading-tight tracking-[-0.9px] md:text-4xl">
            Make the space work for your event
          </h2>
          <p className="mt-2 max-w-[672px] text-[15px] leading-[24px] text-[#c8c6c5]">
            Each option is booked separately. Pick a full floor, a shared table, a quiet corner, or the open rooftop terrace for a BBQ
            under the sky.
          </p>
          <div role="radiogroup" aria-label="Choose a space" className="mt-8 grid gap-6 md:grid-cols-2 md:gap-7">
            {spaces.map((s, i) => {
              const on = s.id === spaceId
              return (
                <SpaceCardCarousel
                  key={s.id}
                  space={s}
                  isSelected={on}
                  onSelect={() => pickSpace(s.id)}
                  onKeyDown={(e) => {
                    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
                    if (!d) return
                    e.preventDefault()
                    const j = (i + d + spaces.length) % spaces.length
                    pickSpace(spaces[j].id)
                    e.currentTarget.closest('[role="radiogroup"]')?.querySelectorAll<HTMLElement>('[role="radio"]')[j]?.focus()
                  }}
                  index={i}
                />
              )
            })}
          </div>
        </section>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            {profile && (
              <div className="anim-pop flex items-center justify-between gap-4 border-b border-line pb-6">
                <div>
                  <h2 className="font-head text-xl">Hosted by {hostName}</h2>
                  <p className="mt-1 text-sm text-stone">Host response window: 48 hours</p>
                </div>
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-flame font-head text-sm text-white">
                  TC
                </span>
              </div>
            )}

            <ul className="reveal grid gap-6 border-b border-line py-8 sm:grid-cols-3">
              {[
                { I: Users, t: `Room for up to ${space.max} guests`, d: `${space.name}: ${space.cap}. Each space is booked separately; capacities cannot be combined into one request.` },
                { I: ShieldCheck, t: 'Verified on-site', d: 'Our team visited in person, measured every room, and confirmed the AV, power backup, and access claims.' },
                { I: Clock, t: 'Host response window: 48h', d: 'Time Cafe reviews your request. Track its status in Your bookings; nothing is charged when you submit.' },
              ].map(({ I, t, d }) => (
                <li key={t}>
                  <I className="size-5 text-flame" />
                  <h3 className="mt-3 font-head text-[15px]">{t}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-stone">{d}</p>
                </li>
              ))}
            </ul>

            <section aria-labelledby="about-title" className="reveal border-b border-line py-8">
              <h2 id="about-title" className="font-head text-xl">About this space</h2>
              <p className="mt-4 max-w-[640px] text-sm leading-[22.75px] text-stone">
                Time Cafe is a vibrant, contemporary cafe in Nungambakkam, Chennai, making it an ideal venue for meetups and events thanks
                to its central accessibility, warm, conversational ambience, and modular seating that smoothly adapts to different group sizes.
              </p>
              <p className="mt-3 max-w-[640px] text-sm leading-[22.75px] text-stone">
                Paired with a versatile, crowd-pleasing menu spanning artisan coffees to hearty continental bites, it provides organizers with
                an inviting, low-friction space that comfortably bridges the gap between casual hangout and professional gathering.
              </p>
            </section>

            <EventFit />

            <section aria-labelledby="offers-title" className="reveal border-b border-line py-10">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="offers-title" className="font-head text-xl">What this space offers</h2>
                  <p className="mt-1 text-sm text-stone">Everything below is included in your booking.</p>
                </div>
                <span className="inline-flex items-center gap-1.5 border-[1.5px] border-ink bg-white px-2.5 py-1 font-mono-b text-[11px] tracking-[0.7px] uppercase">
                  <Check className="size-3.5 text-moss" /> {amenities.length} included
                </span>
              </div>
              <div className="mt-7 space-y-9">
                {[
                  { g: 'Present & perform', n: 'Screen, sound and stage', cols: 'sm:grid-cols-3', items: amenities.slice(0, 3) },
                  { g: 'Stay connected & fed', n: 'Power, network and refreshments', cols: 'sm:grid-cols-3', items: [amenities[3], amenities[4], amenities[5]] },
                  { g: 'Support on the day', n: 'People and practicalities', cols: 'sm:grid-cols-2', items: [amenities[6], amenities[7], amenities[8], amenities[9]] },
                ].map(({ g, n, cols, items }, gi) => (
                  <div key={g}>
                    <div className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full border-[1.5px] border-ink bg-flame font-mono-b text-[10px] text-white">{gi + 1}</span>
                      <h3 className="font-head text-[15px]">{g}</h3>
                      <span className="hidden text-xs text-stone sm:inline">{n}</span>
                      <span aria-hidden="true" className="h-px flex-1 bg-line" />
                    </div>
                    <ul className={`mt-4 grid gap-3 ${cols}`}>
                      {items.map(({ I, t, d }, i) => (
                        <li
                          key={t}
                          style={{ '--d': `${gi * 80 + i * 70}ms` } as React.CSSProperties}
                          className="reveal group relative overflow-hidden border-[1.5px] border-ink bg-white p-4 shadow-hard-sm transition-[transform,box-shadow] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-md"
                        >
                          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-flame transition-transform duration-300 group-hover:scale-x-100" />
                          <span className="grid size-11 place-items-center rounded-full bg-[#ffe3dd] text-flame transition-[background-color,color,transform] duration-200 group-hover:scale-110 group-hover:bg-flame group-hover:text-white">
                            <I className="size-5" />
                          </span>
                          <span className="mt-3 block font-head text-[14px] leading-5 text-ink">{t}</span>
                          <span className="mt-1 block text-[13px] leading-5 text-stone">{d}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            <section aria-labelledby="reviews-title" className="reveal py-10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 id="reviews-title" className="font-head text-xl">Organisers who have hosted here</h2>
                  {reviews.length > 0 && <p className="mt-1 flex items-center gap-2 text-sm text-stone">
                    <Star className="size-4 text-flame" /> <span className="text-ink">{reviewAverage ?? "No reviews yet"}</span> · {reviews.length} published review{reviews.length === 1 ? "" : "s"}
                  </p>}
                </div>
                <button type="button" onClick={() => profile ? setReviewOpen(true) : requireAuth(() => setReviewOpen(true))} className="press min-h-11 border-[1.5px] border-ink bg-white px-4 py-3 font-mono-b text-xs uppercase shadow-hard-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
                  Add review
                </button>
              </div>
              {!reviews.length && <div className="mt-6"><ChandruTestimonial /></div>}
              <ul className="mt-6 grid gap-5 md:grid-cols-2">
                {reviews.map((r, i) => (
                  <li
                    key={r.id}
                    className="reveal border-[1.5px] border-ink bg-white p-5 shadow-hard transition-transform duration-300 hover:-translate-y-1"
                    style={{ '--d': `${i * 100}ms` } as React.CSSProperties}
                  >
                    <Quote className="size-6 text-flame" />
                    <blockquote className="mt-3 text-sm leading-[22px] text-ink">{r.q}</blockquote>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {r.imgs.map((src) => (
                        <img key={src} src={src} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                      ))}
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="font-head text-sm">{r.n}</p>
                        <p className="text-xs text-stone">{r.date} · {r.event} · {r.source === "booking" ? "Booked through SCENE" : "Curator-approved review"}</p>
                      </div>
                      <p className="flex gap-0.5 text-flame" role="img" aria-label={`${r.rating} out of 5 stars`}>
                        {Array.from({ length: r.rating }, (_, k) => (
                          <Star key={k} className="size-3.5" />
                        ))}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="where-title" className="reveal border-t border-line py-10">
              <h2 id="where-title" className="font-head text-xl">Where you will be</h2>
              <p className="mt-1 text-sm text-stone">{venue.address || [venue.area, venue.city].join(', ')}</p>
              <div className="relative mt-5 overflow-hidden border-[1.5px] border-ink bg-sand">
                <iframe
                  title={`Google Map showing ${venue.name}, ${venue.area}`}
                  src={`https://www.google.com/maps?q=${mapQuery}&z=16&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="block h-[260px] w-full border-0 sm:h-[320px]"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press absolute bottom-3 left-3 flex items-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-2.5 font-mono-b text-[11px] tracking-[0.7px] uppercase text-white shadow-hard-sm"
                >
                  <MapPin className="size-4" /> Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
              <p className="mt-4 max-w-[640px] text-sm leading-[22.75px] text-stone">
                Use the map above to plan your visit to Time Cafe. Confirm any accessibility or parking needs with the host before booking.
              </p>
            </section>

            <section aria-labelledby="rules-title" className="reveal border-t border-line pt-10">
              <h2 id="rules-title" className="font-head text-xl">Before you book</h2>
              <div className="mt-5 grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">House rules</h3>
                  <ul className="mt-3 space-y-2">
                    {['1-hour minimum booking', 'No open flame or fog machines indoors', 'Amplified music until 9:30 PM', 'Outside catering welcome (kitchen not included)'].map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm text-stone">
                        <Check className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={2.25} /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">Cancellation</h3>
                  <p className="mt-3 text-sm leading-[22.75px] text-stone">
                    Free cancellation up to 7 days before your event. Cancel within 7 days and the deposit is held as credit toward a future
                    booking. No charge is taken until the host confirms.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside id="booking-request" ref={bookingRef} aria-label="Booking request panel" tabIndex={0} className="booking min-w-0 self-start scroll-mt-24 focus-visible:outline-2 focus-visible:outline-primary-ink lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-y-contain lg:pb-2 lg:pr-2">
            {status !== 'sent' ? (
              <form
                ref={formRef}
                onSubmit={submit}
                noValidate
                className="anim-pop border-[1.5px] border-ink bg-white p-5 shadow-hard sm:p-6"
                aria-label={`Request ${space.name}`}
              >
                <p className="flex items-baseline gap-1.5">
                  <span key={hourlyRate} className="anim-fade font-head text-2xl">{hourlyRate === null ? 'Host quote' : money(hourlyRate)}</span>
                  <span className="font-mono-b text-xs tracking-[0.48px] uppercase text-stone">/ hour</span>
                  <span className="ml-auto flex items-center gap-1 text-sm text-stone">
                    <Star className="size-3.5 text-flame" /> {reviewAverage ?? "No SCENE reviews yet"}
                  </span>
                </p>
                <div className="mt-3 border-y border-line py-3" aria-live="polite">
                  <h2 className="mb-2 font-head text-lg">Send a booking request</h2>
                  <p key={space.id} className="anim-fade font-head text-sm">{space.name}</p>
                  <p className="mt-0.5 text-xs text-stone">1-hour minimum · Pay only after host approval</p>
                </div>
                {profile && (
                  <p className="rise mt-3 flex items-center gap-2 bg-moss/10 px-3 py-2 text-xs text-moss">
                    <Check className="size-3.5 shrink-0" strokeWidth={2.5} /> Signed in as {profile.name}
                  </p>
                )}

                <div className="mt-4 space-y-3">
                  <div>
                    <div className={fieldBox}>
                      <span id={`${idBase}-type-l`} className={monoLabel}>Event type <span className="text-flame">*</span></span>
                      <div data-field="type">
                        <Dropdown
                          label="Event type"
                          placeholder="Select your event type…"
                          options={eventTypes}
                          value={eventType}
                          onChange={(v) => {
                            updateDraft((current) => ({ ...current, eventType: v }))
                            setErrors((e) => ({ ...e, type: '' }))
                          }}
                          invalid={!!errors.type}
                          describedBy={err('type')}
                          className="text-sm font-body-m"
                          listClassName="-left-3 -right-3 top-[calc(100%+12px)]"
                        />
                      </div>
                    </div>
                    {errorText('type')}
                  </div>

                  <div>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Event date <span className="text-flame">*</span></span>
                      <input
                        data-field="date"
                        type="date"
                        min={today}
                        value={date}
                        onChange={(e) => {
                          updateDraft((current) => ({ ...current, date: e.target.value }))
                          setErrors((x) => ({ ...x, date: '' }))
                        }}
                        aria-invalid={!!errors.date}
                        aria-describedby={err('date')}
                        className={inputCls}
                      />
                    </label>
                    {errorText('date')}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className={fieldBox}>
                      <span className={monoLabel}>Start</span>
                      <input type="time" data-field="start" aria-invalid={!!errors.start} aria-describedby={err('start')} value={start} onChange={(e) => { updateDraft((current) => ({ ...current, start: e.target.value })); setErrors(x => ({ ...x, start: '', hours: '', date: '' })) }} className={inputCls} />
                    </label>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Hours</span>
                      <select data-field="hours" aria-invalid={!!errors.hours} aria-describedby={err('hours')} value={hours} onChange={(e) => { updateDraft((current) => ({ ...current, hours: Number(e.target.value) })); setErrors(x => ({ ...x, hours: '' })) }} className={`${inputCls} cursor-pointer`}>
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>{h} {h === 1 ? 'hour' : 'hours'}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {errorText('start')}
                  {errorText('hours')}

                  <div>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Guests (max {space.max})</span>
                      <input
                        data-field="guests"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={space.max}
                        value={guests}
                        onChange={(e) => {
                          updateDraft((current) => ({ ...current, guests: e.target.value }))
                          setErrors((x) => ({ ...x, guests: '' }))
                        }}
                        aria-invalid={!!errors.guests}
                        aria-describedby={err('guests')}
                        className={inputCls}
                      />
                    </label>
                    {errorText('guests')}
                  </div>

                  <div>
                    <label className={fieldBox}>
                      <span className={monoLabel}>LinkedIn or Instagram <span className="text-flame">*</span></span>
                      <input
                        data-field="social"
                        type="text"
                        autoComplete="url"
                        value={social}
                        onChange={(e) => {
                          updateDraft((current) => ({ ...current, social: e.target.value }))
                          setErrors((x) => ({ ...x, social: '' }))
                        }}
                        placeholder="linkedin.com/in/you or instagram.com/you"
                        aria-invalid={!!errors.social}
                        aria-describedby={err('social')}
                        className={inputCls}
                      />
                    </label>
                    {errorText('social')}
                  </div>

                  <div>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Message to host <span className="text-flame">*</span></span>
                      <textarea
                        data-field="message"
                        rows={3}
                        value={message}
                        onChange={(e) => {
                          updateDraft((current) => ({ ...current, message: e.target.value }))
                          setErrors((x) => ({ ...x, message: '' }))
                        }}
                        placeholder="Tell Time Cafe what you're planning, how many people, any setup needs…"
                        aria-invalid={!!errors.message}
                        aria-describedby={err('message')}
                        className={`${inputCls} resize-none`}
                      />
                    </label>
                    {errorText('message')}
                  </div>
                </div>

                <p className="mt-3 text-xs text-stone"><span className="text-flame">*</span> Required fields</p>
                {saveStatus !== 'idle' && <p role="status" className="mt-2 text-xs text-stone">
                  {saveStatus === 'saving' ? 'Saving your draft…' : saveStatus === 'saved' ? 'Draft saved to your account' : 'Draft saved on this device'}
                </p>}

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  aria-busy={status === 'sending'}
                  className="press mt-4 flex w-full items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-3.5 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase text-white shadow-hard-md disabled:cursor-wait disabled:opacity-70"
                >
                  {status === 'sending' ? (
                    <>
                      <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Sending request…
                    </>
                  ) : profile ? (
                    <>Send booking request <ArrowRight /></>
                  ) : (
                    <>Continue to verify &amp; request <ArrowRight /></>
                  )}
                </button>
                <p className="mt-3 text-xs leading-5 text-stone">This sends a request only. The host must approve it before you can pay and confirm the booking.</p>

                {submitError && <FieldError className="mt-3">{submitError}</FieldError>}

                <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between text-stone">
                    <dt>{hourlyRate === null ? 'Price confirmed by host' : `${money(hourlyRate)} × ${hours} ${hours === 1 ? 'hour' : 'hours'}`}</dt>
                    <dd key={subtotal} className="anim-fade">{subtotal === null ? 'Host quote' : money(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3 font-head">
                    <dt>Estimated total</dt>
                    <dd key={total} className="anim-fade">{total === null ? 'Host quote' : money(total)}</dd>
                  </div>
                </dl>
              </form>
            ) : (
              <div role="status" className="anim-pop border-[1.5px] border-ink bg-white p-6 shadow-hard">
                <span className="anim-stamp grid size-12 place-items-center border-[1.5px] border-ink bg-moss text-white shadow-hard-sm">
                  <Check className="size-6" strokeWidth={2.5} />
                </span>
                <h2 ref={sentTitle} tabIndex={-1} className="rise mt-4 font-head text-xl focus:outline-none">
                  Request sent to Time Cafe
                </h2>
                <p className="rise mt-2 text-sm leading-[22px] text-stone" style={{ '--d': '80ms' } as React.CSSProperties}>
                  Your request is saved in Your bookings. Time Cafe has a 48-hour response window. You only pay after approval; nothing has been charged now.
                </p>
                <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
                  {[
                    ['Host', hostName],
                    ['Event', eventType],
                    ['Space', space.name],
                    ['Date', dateNice],
                    ['Window', `${start} · ${hours}h`],
                    ['Guests', guests],
                    ['Estimate', total === null ? 'Host quote' : money(total)],
                  ].map(([k, v], i) => (
                    <div key={k} className="rise flex justify-between gap-4 py-2.5" style={{ '--d': `${140 + i * 50}ms` } as React.CSSProperties}>
                      <dt className="font-mono-b text-[11px] tracking-[0.6px] uppercase text-stone">{k}</dt>
                      <dd className="text-right font-body-m">{v}</dd>
                    </div>
                  ))}
                </dl>
                <button
                  type="button"
                  onClick={() => setStatus('form')}
                  className="press mt-5 w-full border-[1.5px] border-ink bg-paper px-4 py-3 font-mono-b text-xs tracking-[0.72px] uppercase shadow-hard-sm"
                >
                  Edit request
                </button>
              </div>
            )}
          </aside>
        </div>
      </main>

      {confirmOpen && (
        <BookingConfirmation
          summary={{
            firstName: profile?.name.split(' ')[0] ?? 'there',
            venue: 'Time Cafe',
            eventType,
            space: space.name,
            image: space.img,
            date: dateNice,
            window: `${start} · ${hours} ${hours === 1 ? 'hour' : 'hours'}`,
            guests,
          }}
          onClose={() => setConfirmOpen(false)}
          onEdit={() => {
            setConfirmOpen(false)
            setStatus('form')
            setTimeout(() => bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
          }}
          onBookings={() => {
            setConfirmOpen(false)
            router.push('/bookings')
          }}
          onBrowse={() => {
            setConfirmOpen(false)
            onBack()
          }}
        />
      )}

      {reviewOpen && <ReviewFlow role="organiser" defaultName={profile?.name ?? ''} subject={venue.name}
        moderationPending onClose={() => setReviewOpen(false)}
        onSubmit={result => submitVenueReviewWithPhotos(venue.slug, result)} />}
      <SiteFooter wide />
    </div>
  )
}
