import { useEffect, useId, useMemo, useRef, useState } from 'react'
import FieldError from './FieldError'
import Dropdown from './Dropdown'
import BookingConfirmation, { type BookingSummary } from './BookingConfirmation'
import useReveal from './useReveal'
import type { Profile } from './AuthModal'
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
import courtyard from '../assets/venue/b1270.png'
import terrace from '../assets/venue/76a4b.png'
import longTable from '../assets/venue/ada0b.png'
import suite from '../assets/venue/10678.png'
import barista from '../assets/venue/25fa2.png'
import r1a from '../assets/venue/d337c.png'
import r1b from '../assets/venue/6def1.png'
import r1c from '../assets/venue/297f9.png'
import r2a from '../assets/venue/b2da5.png'
import r2b from '../assets/venue/df6e9.png'
import r2c from '../assets/venue/74cbf.png'
import r3a from '../assets/venue/db2c1.png'
import r3b from '../assets/venue/d3cd8.png'
import r3c from '../assets/venue/99e14.png'

const spaces = [
  {
    id: 'floor',
    tag: 'Best for meetups',
    name: 'First-floor event space',
    cap: '25–30 people',
    max: 30,
    price: 2000,
    desc: 'A flexible indoor floor for talks, workshops, recordings, and professional gatherings with full seating and projector setup.',
    img: '/assets/spaces/f33c5.png',
    photos: [
      { src: '/assets/spaces/f33c5.png', alt: 'First-floor event space wide view with presentation screen and projector setup' },
      { src: '/assets/spaces/89376.png', alt: 'First floor event hall looking towards the rear seating and ambient lighting' },
      { src: '/assets/spaces/b1270.png', alt: 'Event space floor with modular conference tables and audio speaker setup' },
      { src: '/assets/spaces/d2955.png', alt: 'Brightly lit daytime seating area in the first-floor event space' },
    ],
    alt: 'First-floor event space set up for a talk with rows of seating.',
  },
  {
    id: 'korean',
    tag: 'Best for evenings',
    name: 'Korean table',
    cap: 'Up to 8 people',
    max: 8,
    price: 1000,
    desc: 'A relaxed spot for focused work and quick team catch-ups with traditional low seating and warm wood craft.',
    img: '/assets/spaces/86081.png',
    photos: [
      { src: '/assets/spaces/86081.png', alt: 'Korean table with floor chairs and white marble dining tabletop' },
      { src: '/assets/spaces/f59d4.png', alt: 'Side view of Korean table setup showing low wood-back chairs' },
      { src: '/assets/spaces/10678.png', alt: 'Extended Korean table seating arrangement with cushioned bench seats' },
      { src: '/assets/spaces/43767.png', alt: 'Korean dining and meeting space with ambient evening background' },
    ],
    alt: 'Korean-style low table laid for a shared meal.',
  },
  {
    id: 'conversation',
    tag: 'For a small circle',
    name: 'Conversation table',
    cap: 'Up to 4 people',
    max: 4,
    price: 400,
    desc: 'A dedicated table for mentoring, interviews, and focused small-group conversations with library bookshelf backdrop.',
    img: '/assets/spaces/d5006.png',
    photos: [
      { src: '/assets/spaces/d5006.png', alt: 'Conversation table set for four with wooden bookcase and artwork' },
      { src: '/assets/spaces/c3056.png', alt: 'Angled perspective of conversation table and comfortable modern chairs' },
      { src: '/assets/spaces/25fa2.png', alt: 'Conversation table view facing the vintage wall decor and showcase' },
      { src: '/assets/spaces/c4313.png', alt: 'Conversation table with staircase railing and warm pendant fixture' },
      { src: '/assets/spaces/27065.png', alt: 'Warm cafe interior with team collaborative gathering around the table' },
    ],
    alt: 'Intimate conversation table beside a bright window.',
  },
  {
    id: 'terrace',
    tag: 'Social gatherings',
    name: 'Open terrace · BBQ table',
    cap: 'Up to 16 people',
    max: 16,
    price: 1500,
    desc: 'A rooftop terrace with a built-in BBQ grill, string lights, and Chennai skyline views — best for sundowners and casual evening cookouts.',
    img: '/assets/spaces/terrace_1.jpg',
    photos: [
      { src: '/assets/spaces/terrace_1.jpg', alt: 'Rooftop terrace dining table with overhead warm string bulbs at dusk' },
      { src: '/assets/spaces/terrace_2.jpg', alt: 'Long terrace dining table with ambient lighting and potted greenery' },
      { src: '/assets/spaces/terrace_3.jpg', alt: 'Open-air rooftop terrace BBQ dining setup under evening lights' },
    ],
    alt: 'Open-air terrace with potted plants and communal tables.',
  },
]

const gallery = [
  { src: '/assets/gallery/gal_8.jpg', alt: 'Paved outdoor cafe walkway flanked by tropical palm greenery and warm vintage carriage wall lamps.' },
  { src: '/assets/gallery/gal_4.jpg', alt: 'Naturally lit dining room with contemporary wooden chairs and tables.' },
  { src: '/assets/gallery/gal_5.jpg', alt: 'Intimate reading nook with wooden console, lampshade, and lush potted greenery.' },
  { src: '/assets/gallery/gal_6.jpg', alt: 'Korean-style low seating table with cushioned backrests and ambient lighting.' },
  { src: '/assets/gallery/gal_1.jpg', alt: 'Specialty iced layered caramel coffee served on a rustic timber tray.' },
  { src: '/assets/gallery/gal_2.jpg', alt: 'Gourmet slider burgers on toasted brioche buns with melted cheese.' },
  { src: '/assets/gallery/gal_3.jpg', alt: 'Fresh spaghetti tossed with roasted cherry tomatoes, olives, herbs, and shaved parmesan.' },
  { src: '/assets/gallery/gal_7.jpg', alt: 'Artisanal refreshing iced juices and cold brew beverages.' },
  { src: courtyard, alt: 'Time Cafe courtyard with mature greenery, wooden pergolas, and tables arranged for guests.' },
  { src: terrace, alt: 'Open-air cafe terrace with potted plants and communal tables.' },
  { src: longTable, alt: 'Long communal wooden table in a calm, naturally lit room.' },
  { src: suite, alt: 'Presentation suite with rows of seating facing a projector wall.' },
  { src: barista, alt: 'Barista counter with espresso machine and hanging pendant lights.' },
]

const fits = [
  { t: 'Podcast recording', s: 8, d: 'Wireless mics, quiet interior, intimate corners' },
  { t: 'Workshop', s: 9, d: 'Projector, supplies, flexible layout, fast wifi', top: true },
  { t: 'Tech meetup', s: 9, d: 'AV tech on-site, 500 Mbps, 45 seats, barista', top: true },
  { t: 'Networking event', s: 8, d: 'Courtyard + main hall flow, PA, parking' },
  { t: 'Product launch', s: 7, d: 'Atmospheric space; smaller audiences work best' },
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

const reviews = [
  {
    q: 'Good acoustics in the presentation suite and fast wifi for a hands-on workshop. Only note: it gets warm in the courtyard by afternoon, so we shifted talks indoors. Host flagged this upfront.',
    n: 'Faizal Rahman',
    imgs: [r1a, r1b, r1c],
  },
  {
    q: 'Ran a 40-person JavaScript meetup here. The projector and mic were genuinely production-grade, and the barista kept the room caffeinated. Priya even reset the room layout during our break.',
    n: 'Aravind Kumar',
    imgs: [r2a, r2b, r2c],
  },
  {
    q: 'We hosted an intimate launch in the courtyard at dusk. The greenery did all the work - we barely needed decor. Power backup kicked in seamlessly when the street lost supply.',
    n: 'Nithya Balaji',
    imgs: [r3a, r3b, r3c],
  },
]

const eventTypes = ['Tech meetup', 'Podcast recording', 'Workshop', 'Networking event', 'Product launch']
const startTimes = Array.from({ length: 13 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)
const hourOptions = [3, 4, 5, 6, 7, 8]

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
const monoLabel = 'font-mono-b text-[10px] leading-[15px] tracking-[0.8px] uppercase text-muted'
const fieldBox =
  'flex flex-col gap-1 border-[1.5px] border-ink bg-paper-2 p-3 transition-colors focus-within:bg-white focus-within:shadow-hard-sm has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:bg-danger-tint'
const MAP_QUERY = encodeURIComponent('Time Cafe & Spaces, Wallace Garden, Nungambakkam, Chennai 600006')

const inputCls =
  'w-full bg-transparent font-body-m text-sm text-ink placeholder:text-muted/60 focus:outline-none'

/**
 * Becomes true once the element has genuinely scrolled into the reading zone.
 * Waits for the page (images, fonts) to finish loading so layout shifts during
 * load can't trigger it early, then checks on scroll/resize.
 */
function useInView<T extends Element>(zone = 0.8, delay = 250) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    let done = false
    let timer: ReturnType<typeof setTimeout>
    const check = () => {
      const el = ref.current
      if (done || !el) return
      const r = el.getBoundingClientRect()
      if (r.top < window.innerHeight * zone && r.bottom > 0) {
        done = true
        detach()
        timer = setTimeout(() => setSeen(true), delay)
      }
    }
    const attach = () => {
      window.addEventListener('scroll', check, { passive: true })
      window.addEventListener('resize', check)
      check()
    }
    const detach = () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
      window.removeEventListener('load', attach)
    }
    if (document.readyState === 'complete') requestAnimationFrame(attach)
    else window.addEventListener('load', attach)
    return () => {
      done = true
      detach()
      clearTimeout(timer)
    }
  }, [zone, delay])
  return [ref, seen] as const
}

function CountUp({ to, run, decimals = 1 }: { to: number; run: boolean; decimals?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to)
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 1100)
      setV(to * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run, to])
  return <>{v.toFixed(decimals)}</>
}

function Lightbox({ index, onIndex, onClose }: { index: number | null; onIndex: (i: number) => void; onClose: () => void }) {
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

function FitBar({ label, score }: { label: string; score: number }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.9, 400)
  return (
    <div
      ref={ref}
      role="progressbar"
      aria-label={`${label} fit`}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={score}
      className="mt-2 h-1.5 overflow-hidden bg-white/10"
    >
      <div
        className={`bar-fill h-full bg-gradient-to-r from-flame to-[#ff9a3c] ${seen ? 'run' : ''}`}
        style={{ width: `${score * 10}%` }}
      />
    </div>
  )
}

function FitScore() {
  const [ref, seen] = useInView<HTMLDivElement>(0.75, 350)
  const R = 34
  const C = 2 * Math.PI * R
  return (
    <section
      ref={ref}
      aria-labelledby="fit-title"
      className="reveal relative mt-10 overflow-hidden border-[1.5px] border-ink bg-[#0a0812] p-6 text-white shadow-hard md:p-10"
    >
      <span aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-flame/25 blur-3xl" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-[#6a4cff]/20 blur-3xl" />
      <p className="relative font-mono-b text-[11px] tracking-[1.76px] uppercase text-flame">How well it fits your event</p>
      <h2 id="fit-title" className="relative mt-2 font-head text-2xl leading-tight tracking-[-0.5px] md:text-[32px]">
        We made an on-site visit for you.
      </h2>

      <div className="relative mt-6 flex items-center gap-5 border border-white/15 bg-white/5 p-5">
        <div className="relative size-[88px] shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="7" />
            <circle
              cx="40"
              cy="40"
              r={R}
              fill="none"
              stroke="#ff432a"
              strokeWidth="7"
              strokeLinecap="butt"
              strokeDasharray={C}
              strokeDashoffset={seen ? C * (1 - 0.82) : C}
              className="gauge-ring"
            />
          </svg>
          <p className="absolute inset-0 grid place-items-center text-center font-head text-xl leading-none">
            <span>
              <CountUp to={8.2} run={seen} />
              <span className="block pt-0.5 font-mono text-[10px] text-white/60">/10</span>
            </span>
          </p>
        </div>
        <div>
          <p className="inline-flex items-center gap-1.5 bg-moss/20 px-2 py-0.5 font-mono-b text-[10px] tracking-[0.8px] uppercase text-[#5be3a8]">
            <Check className="size-3" strokeWidth={2.5} /> Great Fit
          </p>
          <p className="mt-2 font-head text-lg leading-6">Strong fit for your kind of event</p>
          <p className="mt-1 text-sm leading-[22px] text-[#c8c6c5]">
            Highly specialized space optimal for tech community and high-production content recording.
          </p>
        </div>
      </div>

      <ul className="relative mt-6 divide-y divide-white/10">
        {fits.map((f, i) => (
          <li key={f.t} className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="flex items-center gap-2 font-head text-[15px]">
                {f.t}
                {f.top && (
                  <span className="bg-moss/25 px-1.5 py-0.5 font-mono-b text-[9px] tracking-[0.6px] uppercase text-[#5be3a8]">
                    Top rated
                  </span>
                )}
              </p>
              <p className="font-mono-b text-sm">
                <span className="sr-only">Score: </span>
                {f.s}/10
              </p>
            </div>
            <FitBar label={f.t} score={f.s} />
            <p className="mt-2 text-xs text-[#c8c6c5]">{f.d}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

function SpaceCardCarousel({
  space,
  isSelected,
  onSelect,
  onKeyDown,
  index,
  totalSpaces,
}: {
  space: (typeof spaces)[number]
  isSelected: boolean
  onSelect: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void
  index: number
  totalSpaces: number
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
    if (photos.length <= 1) return

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
          <span className="font-mono-b text-white">{money(space.price)} an hour</span>
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

export default function VenueDetail({
  profile,
  onAuth,
  onBack,
  onBookings,
  submitSignal,
}: {
  profile: Profile | null
  onAuth: () => void
  onBack: () => void
  onBookings: (s: BookingSummary) => void
  submitSignal: number
}) {
  useReveal()
  const [spaceId, setSpaceId] = useState('floor')
  const space = spaces.find((s) => s.id === spaceId)!
  const [saved, setSaved] = useState(false)
  const [photo, setPhoto] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const [eventType, setEventType] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('11:00')
  const [hours, setHours] = useState(3)
  const [guests, setGuests] = useState('25')
  const [social, setSocial] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'form' | 'sending' | 'sent'>('form')

  const title = useRef<HTMLHeadingElement>(null)
  const sentTitle = useRef<HTMLHeadingElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const bookingRef = useRef<HTMLElement>(null)
  const idBase = useId()
  const hostName = 'Priya Menon'

  useEffect(() => {
    document.title = 'Time Cafe · SCENE/044'
    window.scrollTo(0, 0)
    title.current?.focus({ preventScroll: true })
    return () => {
      document.title = 'SCENE/044'
    }
  }, [])

  const subtotal = space.price * hours
  const fee = Math.round(subtotal * 0.08)
  const total = subtotal + fee
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])

  const clampGuests = (v: string, max: number) => {
    const n = Number(v)
    return v === '' || Number.isNaN(n) ? v : String(Math.min(Math.max(1, n), max))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!eventType) e.type = 'Choose what you are planning.'
    if (!date) e.date = 'Pick an event date.'
    else if (date < today) e.date = 'Choose a date that has not passed.'
    const g = Number(guests)
    if (!guests || g < 1) e.guests = 'Enter how many guests are coming.'
    else if (g > space.max) e.guests = `This space fits up to ${space.max} guests.`
    if (!social.trim()) e.social = 'Add a LinkedIn or Instagram link so the host knows who you are.'
    if (message.trim().length < 10) e.message = 'Tell the host a little about your plan (at least 10 characters).'
    setErrors(e)
    const first = Object.keys(e)[0]
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)
      ;(el?.matches('input,textarea') ? el : el?.querySelector('button'))?.focus()
    }
    return !first
  }

  const send = () => {
    setStatus('sending')
    setTimeout(() => {
      setStatus('sent')
      setConfirmOpen(true)
    }, 900)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (status === 'sending' || !validate()) return
    if (!profile) onAuth()
    else send()
  }

  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (submitSignal > 0) send()
  }, [submitSignal])

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
    setSpaceId(id)
    const max = spaces.find((s) => s.id === id)!.max
    setGuests((g) => clampGuests(g, max))
    setErrors((e) => ({ ...e, guests: '' }))
    bookingRef.current?.classList.remove('flash')
    void bookingRef.current?.offsetWidth
    bookingRef.current?.classList.add('flash')
    if (window.matchMedia('(max-width: 1023px)').matches)
      bookingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const err = (k: string) => (errors[k] ? `${idBase}-${k}` : undefined)
  const ErrorText = ({ k }: { k: string }) =>
    errors[k] ? (
      <FieldError id={`${idBase}-${k}`} className="mt-1.5">
        {errors[k]}
      </FieldError>
    ) : null

  const firstName = profile?.name.split(' ')[0]
  const dateNice = date ? new Date(`${date}T00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

  return (
    <div className="page-in min-h-screen bg-paper text-ink">
      <a
        href="#venue-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <button type="button" onClick={onBack} aria-label="SCENE/044 home" className="font-mono-b text-sm tracking-[2.52px]">
            SCENE<span className="text-flame">/044</span>
          </button>
          <ul className="hidden items-center gap-8 md:flex">
            {['How it works', 'Spaces', 'Why SCENE', 'For hosts'].map((l) => (
              <li key={l}>
                <button type="button" onClick={onBack} className="text-sm text-muted transition-colors hover:text-ink">
                  {l}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            {firstName && (
              <button
                type="button"
                onClick={() => (window.location.hash = '#/bookings')}
                className="hidden rounded-full px-4 py-2 font-body-m text-sm leading-5 text-ink transition-colors hover:bg-sand sm:block"
              >
                Your bookings
              </button>
            )}
            <button
              type="button"
              onClick={firstName ? () => (window.location.hash = '#/bookings') : onAuth}
              className="press flex items-center gap-1.5 rounded-md border-[1.5px] border-ink bg-flame px-4 py-2 font-body-sb text-sm leading-5 text-white shadow-hard-sm"
            >
              {firstName ? `Hi, ${firstName}` : 'Login/signup'}
              <ArrowRight />
            </button>
          </div>
        </nav>
      </header>

      <main id="venue-main" className="mx-auto max-w-[1280px] px-5 pb-20 pt-6 md:px-8">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="group flex min-h-8 items-center gap-2 font-mono-b text-xs tracking-[0.96px] uppercase text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" /> Chennai | event spaces
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
          <h1 ref={title} tabIndex={-1} className="mt-2 font-display text-[40px] leading-[1.05] tracking-[-1.2px] focus:outline-none md:text-[56px]">
            Time Cafe
          </h1>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Star className="size-4 text-flame" />
              <span className="font-body-m text-ink">4.70</span>
              <span className="font-mono-b text-[11px] tracking-[0.6px] uppercase">(Rating from Google Maps)</span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4" /> valluvar kottam, Nungambakkam, Chennai
            </span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1.5 font-mono-b text-xs tracking-[0.72px] uppercase text-moss">
              <ShieldCheck className="size-[15px]" /> Verified on-site
            </span>
          </p>
        </header>

        <section aria-label="Photos" className="rise mt-6" style={{ '--d': '120ms' } as React.CSSProperties}>
          <div className="flex h-[300px] snap-x snap-mandatory gap-[1.5px] overflow-x-auto overscroll-x-contain border-[1.5px] border-ink bg-ink [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:h-[380px] lg:grid lg:h-[448px] lg:snap-none lg:grid-cols-4 lg:grid-rows-2 lg:overflow-hidden">
            {gallery.slice(0, 5).map((g, i) => (
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
                    Show all {gallery.length} photos
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
        <Lightbox index={photo} onIndex={setPhoto} onClose={() => setPhoto(null)} />

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
                  totalSpaces={spaces.length}
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
                  <p className="mt-1 text-sm text-muted">Superhost · Hosting since 2021 · Responds within 24 hours</p>
                </div>
                <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-flame font-head text-sm text-white">
                  PM
                </span>
              </div>
            )}

            <ul className="reveal grid gap-6 border-b border-line py-8 sm:grid-cols-3">
              {[
                { I: Users, t: 'Room for 25-30 seated', d: 'Main Hall flexes from a 45-seat lecture set-up to a 30-guest cabaret with the courtyard as breakout space.' },
                { I: ShieldCheck, t: 'Verified on-site', d: 'Our team visited in person, measured every room, and confirmed the AV, power backup, and access claims.' },
                { I: Clock, t: 'Replies within 24h', d: 'Priya, the host, confirms most weekday requests the same evening. Weekend requests may take a little longer.' },
              ].map(({ I, t, d }) => (
                <li key={t}>
                  <I className="size-5 text-flame" />
                  <h3 className="mt-3 font-head text-[15px]">{t}</h3>
                  <p className="mt-1 text-[13px] leading-5 text-muted">{d}</p>
                </li>
              ))}
            </ul>

            <section aria-labelledby="about-title" className="reveal border-b border-line py-8">
              <h2 id="about-title" className="font-head text-xl">About this space</h2>
              <p className="mt-4 max-w-[640px] text-sm leading-[22.75px] text-muted">
                Time Cafe is a vibrant, contemporary cafe in Nungambakkam, Chennai, making it an ideal venue for meetups and events thanks
                to its central accessibility, warm, conversational ambience, and modular seating that smoothly adapts to different group sizes.
              </p>
              <p className="mt-3 max-w-[640px] text-sm leading-[22.75px] text-muted">
                Paired with a versatile, crowd-pleasing menu spanning artisan coffees to hearty continental bites, it provides organizers with
                an inviting, low-friction space that comfortably bridges the gap between casual hangout and professional gathering.
              </p>
            </section>

            <FitScore />

            <section aria-labelledby="offers-title" className="reveal border-b border-line py-10">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 id="offers-title" className="font-head text-xl">What this space offers</h2>
                  <p className="mt-1 text-sm text-muted">Everything below is included in your booking.</p>
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
                      <span className="hidden text-xs text-muted sm:inline">{n}</span>
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
                          <span className="mt-1 block text-[13px] leading-5 text-muted">{d}</span>
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
                  <p className="mt-1 flex items-center gap-2 text-sm text-muted">
                    <Star className="size-4 text-flame" /> <span className="text-ink">4.96</span> · 42 Events hosted
                  </p>
                </div>
                <button type="button" className="press border-[1.5px] border-ink bg-flame px-4 py-2 font-mono-b text-[11px] tracking-[0.7px] uppercase text-white shadow-hard-sm">
                  View all reviews
                </button>
              </div>
              <ul className="mt-6 grid gap-5 md:grid-cols-2">
                {reviews.map((r, i) => (
                  <li
                    key={r.n}
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
                        <p className="text-xs text-muted">2 days ago · Tech meetup</p>
                      </div>
                      <p className="flex gap-0.5 text-flame" role="img" aria-label="5 out of 5 stars">
                        {Array.from({ length: 5 }, (_, k) => (
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
              <p className="mt-1 text-sm text-muted">Wallace Garden, Nungambakkam, Chennai 600006</p>
              <div className="relative mt-5 overflow-hidden border-[1.5px] border-ink bg-sand">
                <iframe
                  title="Google Map showing Time Cafe & Spaces, Wallace Garden, Nungambakkam, Chennai"
                  src={`https://www.google.com/maps?q=${MAP_QUERY}&z=16&output=embed`}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                  className="block h-[260px] w-full border-0 sm:h-[320px]"
                />
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${MAP_QUERY}`}
                  target="_blank"
                  rel="noreferrer"
                  className="press absolute bottom-3 left-3 flex items-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-2.5 font-mono-b text-[11px] tracking-[0.7px] uppercase text-white shadow-hard-sm"
                >
                  <MapPin className="size-4" /> Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
              <p className="mt-4 max-w-[640px] text-sm leading-[22.75px] text-muted">
                A 4-minute walk from Nungambakkam station and steps from the Wallace Garden cafes. Metro, bus, and app cabs all reach the
                gate. Exact address is shared once your request is confirmed.
              </p>
            </section>

            <section aria-labelledby="rules-title" className="reveal border-t border-line pt-10">
              <h2 id="rules-title" className="font-head text-xl">Before you book</h2>
              <div className="mt-5 grid gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">House rules</h3>
                  <ul className="mt-3 space-y-2">
                    {['3-hour minimum booking', 'No open flame or fog machines indoors', 'Amplified music until 9:30 PM', 'Outside catering welcome (kitchen not included)'].map((r) => (
                      <li key={r} className="flex items-start gap-2 text-sm text-muted">
                        <Check className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={2.25} /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">Cancellation</h3>
                  <p className="mt-3 text-sm leading-[22.75px] text-muted">
                    Free cancellation up to 7 days before your event. Cancel within 7 days and the deposit is held as credit toward a future
                    booking. No charge is taken until the host confirms.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <aside ref={bookingRef} aria-label="Booking" className="booking self-start scroll-mt-24 lg:sticky lg:top-24">
            {status !== 'sent' ? (
              <form
                ref={formRef}
                onSubmit={submit}
                noValidate
                className="anim-pop border-[1.5px] border-ink bg-white p-5 shadow-hard sm:p-6"
                aria-label={`Request ${space.name}`}
              >
                <p className="flex items-baseline gap-1.5">
                  <span key={space.price} className="anim-fade font-head text-2xl">{money(space.price)}</span>
                  <span className="font-mono-b text-xs tracking-[0.48px] uppercase text-muted">/ hour</span>
                  <span className="ml-auto flex items-center gap-1 text-sm text-muted">
                    <Star className="size-3.5 text-flame" /> 4.96
                  </span>
                </p>
                <div className="mt-3 border-y border-line py-3" aria-live="polite">
                  <p key={space.id} className="anim-fade font-head text-sm">{space.name}</p>
                  <p className="mt-0.5 text-xs text-muted">3-hour minimum · No charge until confirmed</p>
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
                            setEventType(v)
                            setErrors((e) => ({ ...e, type: '' }))
                          }}
                          invalid={!!errors.type}
                          describedBy={err('type')}
                          className="text-sm font-body-m"
                          listClassName="-left-3 -right-3 top-[calc(100%+12px)]"
                        />
                      </div>
                    </div>
                    <ErrorText k="type" />
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
                          setDate(e.target.value)
                          setErrors((x) => ({ ...x, date: '' }))
                        }}
                        aria-invalid={!!errors.date}
                        aria-describedby={err('date')}
                        className={inputCls}
                      />
                    </label>
                    <ErrorText k="date" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className={fieldBox}>
                      <span className={monoLabel}>Start</span>
                      <select value={start} onChange={(e) => setStart(e.target.value)} className={`${inputCls} cursor-pointer`}>
                        {startTimes.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Hours</span>
                      <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={`${inputCls} cursor-pointer`}>
                        {hourOptions.map((h) => (
                          <option key={h} value={h}>{h} hours</option>
                        ))}
                      </select>
                    </label>
                  </div>

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
                          setGuests(e.target.value)
                          setErrors((x) => ({ ...x, guests: '' }))
                        }}
                        aria-invalid={!!errors.guests}
                        aria-describedby={err('guests')}
                        className={inputCls}
                      />
                    </label>
                    <ErrorText k="guests" />
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
                          setSocial(e.target.value)
                          setErrors((x) => ({ ...x, social: '' }))
                        }}
                        placeholder="linkedin.com/in/you or instagram.com/you"
                        aria-invalid={!!errors.social}
                        aria-describedby={err('social')}
                        className={inputCls}
                      />
                    </label>
                    <ErrorText k="social" />
                  </div>

                  <div>
                    <label className={fieldBox}>
                      <span className={monoLabel}>Message to host <span className="text-flame">*</span></span>
                      <textarea
                        data-field="message"
                        rows={3}
                        value={message}
                        onChange={(e) => {
                          setMessage(e.target.value)
                          setErrors((x) => ({ ...x, message: '' }))
                        }}
                        placeholder="Tell Priya what you're planning, how many people, any setup needs…"
                        aria-invalid={!!errors.message}
                        aria-describedby={err('message')}
                        className={`${inputCls} resize-none`}
                      />
                    </label>
                    <ErrorText k="message" />
                  </div>
                </div>

                <p className="mt-3 text-xs text-muted"><span className="text-flame">*</span> Required fields</p>

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
                    <>Request reservation <ArrowRight /></>
                  ) : (
                    <>Continue to verify &amp; request <ArrowRight /></>
                  )}
                </button>

                <dl className="mt-5 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between text-muted">
                    <dt>{money(space.price)} × {hours} hours</dt>
                    <dd key={subtotal} className="anim-fade">{money(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between text-muted">
                    <dt>Service fee</dt>
                    <dd key={fee} className="anim-fade">{money(fee)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-line pt-3 font-head">
                    <dt>Estimated total</dt>
                    <dd key={total} className="anim-fade">{money(total)}</dd>
                  </div>
                </dl>
              </form>
            ) : (
              <div role="status" className="anim-pop border-[1.5px] border-ink bg-white p-6 shadow-hard">
                <span className="anim-stamp grid size-12 place-items-center border-[1.5px] border-ink bg-moss text-white shadow-hard-sm">
                  <Check className="size-6" strokeWidth={2.5} />
                </span>
                <h2 ref={sentTitle} tabIndex={-1} className="rise mt-4 font-head text-xl focus:outline-none">
                  Request sent to Priya
                </h2>
                <p className="rise mt-2 text-sm leading-[22px] text-muted" style={{ '--d': '80ms' } as React.CSSProperties}>
                  You'll hear back within 24 hours. Nothing is charged until the booking is confirmed. We've emailed you a copy of the request.
                </p>
                <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
                  {[
                    ['Host', hostName],
                    ['Event', eventType],
                    ['Space', space.name],
                    ['Date', dateNice],
                    ['Window', `${start} · ${hours}h`],
                    ['Guests', guests],
                    ['Estimate', money(total)],
                  ].map(([k, v], i) => (
                    <div key={k} className="rise flex justify-between gap-4 py-2.5" style={{ '--d': `${140 + i * 50}ms` } as React.CSSProperties}>
                      <dt className="font-mono-b text-[11px] tracking-[0.6px] uppercase text-muted">{k}</dt>
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
            onBookings({ firstName: '', venue: 'Time Cafe', eventType, space: space.name, image: space.img, date: dateNice, window: `${start} · ${hours} ${hours === 1 ? 'hour' : 'hours'}`, guests })
          }}
          onBrowse={() => {
            setConfirmOpen(false)
            onBack()
          }}
        />
      )}

      <footer className="border-t border-line bg-paper-2">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
          <div>
            <p className="font-mono-b text-sm tracking-[2.52px]">SCENE<span className="text-flame">/044</span></p>
            <p className="mt-3 max-w-[260px] text-sm text-muted">Curated event spaces in Chennai. Book with clarity, host with calm.</p>
          </div>
          {[
            ['Organisers', ['Explore venues', 'How booking works', 'My bookings', 'Pricing']],
            ['Hosts', ['List your venue', 'Host dashboard', 'Check-in tools', 'Payouts']],
            ['SCENE/044', ['About', 'Events', 'Contact', 'Help centre']],
          ].map(([h, items]) => (
            <nav key={h as string} aria-label={h as string}>
              <h2 className="font-mono-b text-[11px] tracking-[0.9px] uppercase">{h}</h2>
              <ul className="mt-3 space-y-2">
                {(items as string[]).map((i) => (
                  <li key={i} className="text-sm text-muted">{i}</li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-3 border-t border-line px-5 py-5 text-xs text-muted md:px-8">
          <p>© 2026 SCENE/044. Made in Chennai.</p>
          <p className="flex gap-4"><span>Privacy</span><span>Terms</span></p>
        </div>
      </footer>
    </div>
  )
}
