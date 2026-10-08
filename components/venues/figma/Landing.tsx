"use client";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteFooter, SiteHeader } from './SiteChrome'
import { VenueSearchBar } from '@/components/venues/VenueSearchBar'
import { readVenueSearchPreferences, venueDetailSearchHref } from '@/lib/venueSearch'
import { formatRupees, venueFromRate, venueMaxGuests } from '@/lib/venues'
import type { CatalogVenue } from '@/lib/venueCatalog'
import { LANDING_TESTIMONIALS, LANDING_TESTIMONIAL_SUMMARY } from '@/lib/venueTestimonials'
import Carousel from './Carousel'
import useReveal from './useReveal'
import HowItWorks from './HowItWorks'
import { ArrowRight, Check, Clock, Heart, MapPin, ShieldCheck, Star, VerifiedSeal } from './icons'
const exterior = '/venues/figma/1f1a5.jpg'
const hall = '/venues/figma/237e9.jpg'
const crowd = '/venues/figma/27065.jpg'
const heroImg1 = '/venues/figma/hero-carousel-1.jpg'
const heroImg2 = '/venues/figma/hero-carousel-2.jpg'
const heroImg3 = '/venues/figma/hero-carousel-3.jpg'
const heroImg4 = '/venues/figma/hero-carousel-4.jpg'
const heroImg5 = '/venues/figma/hero-carousel-5.jpg'
const heroImg6 = '/venues/figma/hero-carousel-6.jpg'
const phrases = ['Tech meetup', 'Podcast recording', 'Workshop', 'Networking event', 'Product launch']

function Typewriter() {
  const [text, setText] = useState(phrases[0])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let i = 0
    let n = 0
    let del = false
    let t: ReturnType<typeof setTimeout>
    const tick = () => {
      const word = phrases[i]
      n += del ? -1 : 1
      setText(word.slice(0, n))
      let wait = del ? 35 : 80
      if (!del && n === word.length) {
        del = true
        wait = 1600
      } else if (del && n === 0) {
        del = false
        i = (i + 1) % phrases.length
        wait = 350
      }
      t = setTimeout(tick, wait)
    }
    n = phrases[0].length
    del = true
    t = setTimeout(tick, 1600)
    return () => clearTimeout(t)
  }, [])

  return (
    <>
      <span className="sr-only">{phrases.join(', ')}</span>
      <span aria-hidden="true" className="whitespace-nowrap bg-gradient-to-r from-flame to-[#ff9a3c] bg-clip-text text-transparent">
        {text}
        <span className="caret ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] bg-flame" />
      </span>
    </>
  )
}

const slides = [
  { src: exterior, alt: 'Time Cafe storefront at dusk with warm lights and potted palms.' },
  { src: hall, alt: 'Main hall with marble tables, ceiling fans and recessed lighting.' },
  { src: crowd, alt: 'Builders working on laptops during a meetup inside Time Cafe.' },
  { src: heroImg1, alt: 'Main hall seating with projector screen and warm ambient lighting set up for workshops.' },
  { src: heroImg2, alt: 'Long shared communal table and intimate seating areas in the cafe hall.' },
  { src: heroImg3, alt: 'Sunlit cafe floor with handcrafted wooden chairs and cane-backed seats.' },
  { src: heroImg4, alt: 'Open-air terrace rooftop space with string festoon lighting and outdoor tables.' },
  { src: heroImg5, alt: 'Private dining and meeting nook with wooden bookshelf and custom artwork.' },
  { src: heroImg6, alt: 'Low-cushioned bench seating with long table arrangement for collaborative group discussions.' },
]


const Eyebrow = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`font-mono-b text-[11px] leading-4 tracking-[1.32px] uppercase text-flame ${className}`}>{children}</p>
)

/**
 * Venue landing in the approved visual system, with real navigation/auth.
 * Prototype testimonials and fabricated booking statistics are not published.
 */
export default function Landing({ venue }: { venue: CatalogVenue | null }) {
  const router = useRouter()
  const onOpenVenue = () => router.push(venueDetailSearchHref('time-cafe', readVenueSearchPreferences()))
  const onListVenue = () => router.push('/venues/partner')
  useReveal()
  const [saved, setSaved] = useState(false)

  return (
    <div className="min-h-screen bg-paper text-ink">
      <SiteHeader onLanding />

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-[1152px] px-5 pt-12 pb-16 md:px-8 md:pt-20 md:pb-24">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,431fr)_minmax(0,527fr)] lg:gap-16">
            <div className="max-w-[576px]">
              <p className="rise inline-flex items-center gap-2 rounded-full border-[1.5px] border-ink bg-paper-2 px-3 py-1 font-mono text-xs leading-4 tracking-[0.3px] text-stone">
                <ShieldCheck className="size-3.5 text-moss" /> Curated event spaces in Chennai
              </p>
              <h1
                className="rise mt-6 font-p-display text-[42px] leading-[1.02] tracking-[-1.2px] sm:text-[52px] lg:text-[60px]"
                style={{ '--d': '80ms' } as React.CSSProperties}
              >
                Find a space that <em className="font-p-display-i text-flame">actually fits</em> your event.
              </h1>
              <p
                className="rise mt-6 text-base leading-7 text-stone md:text-lg md:leading-[29.25px]"
                style={{ '--d': '160ms' } as React.CSSProperties}
              >
                No calls, no endless WhatsApp threads. See capacity, pricing, and what’s included up front — then send
                one clear request and know exactly what happens next.
              </p>
              <div className="rise mt-8" style={{ '--d': '240ms' } as React.CSSProperties}>
                <a
                  href="#spaces"
                  className="press inline-flex items-center gap-2 rounded-md border-[1.5px] border-ink bg-flame px-6 py-3.5 font-mono-b text-base leading-6 text-white shadow-hard"
                >
                  EXPLORE VENUES <ArrowRight className="size-5" />
                </a>
              </div>
              <p className="rise mt-5 text-sm leading-5 text-stone" style={{ '--d': '300ms' } as React.CSSProperties}>
                You pay only after a host approves your request. No charge to enquire.
              </p>
            </div>

            <div className="rise relative" style={{ '--d': '200ms' } as React.CSSProperties}>
              <Carousel
                slides={slides}
                label="Time Cafe photos"
                autoplay
                className="aspect-[4/4.1] w-full border-[1.5px] border-ink shadow-hard lg:aspect-auto lg:h-[544px]"
              />
              <figure className="absolute -bottom-8 left-3 w-[220px] border-[1.5px] border-ink bg-paper-2 p-4 shadow-hard sm:w-[240px] lg:-left-6 lg:bottom-auto lg:top-[444px]">
                <figcaption className="flex items-center gap-1.5 font-body-m text-xs leading-4 text-moss">
                  <ShieldCheck className="size-[15px] shrink-0" /> Visited &amp; verified by SCENE/044
                </figcaption>
                <p className="mt-2 font-body-b text-lg leading-[22.5px] font-bold">Time Cafe</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm leading-5 text-stone">
                  <MapPin className="size-3.5" /> Nungambakkam
                </p>
              </figure>
            </div>
          </div>

          {/* Venue search */}
          <div className="rise mt-20 lg:mt-16" style={{ '--d': '360ms' } as React.CSSProperties}>
            <VenueSearchBar />
          </div>
        </section>

        {/* Process */}
        <section id="how" className="scroll-mt-20 border-y border-line bg-paper-2">
          <div className="mx-auto max-w-[1152px] px-5 py-20 md:px-8 md:py-24">
            <Eyebrow className="reveal">How booking works</Eyebrow>
            <h2 className="reveal mt-3 max-w-[640px] font-head text-3xl leading-tight tracking-[-0.6px] md:text-[40px]">
              You host <Typewriter />
              <span className="mt-1 block">we&apos;ll find the perfect venue.</span>
            </h2>
            <p className="reveal mt-4 max-w-[560px] text-base leading-7 text-stone">
              Send a request first. The host confirms what&apos;s possible, and only then do you pay and lock it in.
            </p>
            <HowItWorks />
            <ul className="reveal mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-stone">
              <li className="flex items-center gap-2">
                <Clock className="size-4 text-ink" /> Hosts respond within 48 hours
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-ink" /> Every venue visited in person
              </li>
            </ul>
          </div>
        </section>

        {/* Spaces */}
        <section id="spaces" className="mx-auto max-w-[1280px] scroll-mt-20 px-5 py-20 md:px-8 md:py-24">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow className="reveal">Curated architecture index</Eyebrow>
              <h2 className="reveal mt-3 font-head text-3xl leading-tight tracking-[-0.6px] md:text-[40px]">
                Available for reservation
              </h2>
            </div>
            <p className="reveal font-mono-b text-[11px] tracking-[1px] uppercase text-stone">
              Featured venue partner · Nungambakkam
            </p>
          </div>

          {venue?.status === 'live' ? <article className="reveal mt-10 grid overflow-hidden border-[1.5px] border-ink bg-white shadow-hard lg:grid-cols-[594fr_425fr]">
            <div className="relative">
              <Carousel
                slides={[slides[1], slides[2], slides[0]]}
                label="Time Cafe spaces"
                className="aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[512px]"
              />
              <p className="absolute left-4 top-4 bg-paper/95 px-2.5 py-1 font-mono-b text-[10px] tracking-[0.8px] uppercase">
                Verified on-site · Headquarters
              </p>
            </div>
            <div className="flex flex-col border-t-[1.5px] border-ink p-6 md:p-8 lg:border-t-0 lg:border-l-[1.5px]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5 text-sm text-stone">
                  <p className="flex items-center gap-1.5">
                    <Star className="size-4 text-flame" />
                    <span className="text-ink">Time Cafe</span> · Our current venue partner
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-4 shrink-0" />
                    <a href={venue.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue.address || `${venue.name}, ${venue.area}, ${venue.city}`)}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{venue.address || `${venue.area}, ${venue.city}`}<span className="sr-only"> (Google Maps, opens in a new tab)</span></a>
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={saved}
                  aria-label={saved ? 'Remove Time Cafe from saved spaces' : 'Save Time Cafe to spaces'}
                  onClick={() => setSaved((v) => !v)}
                  className={`press grid size-10 shrink-0 place-items-center border-[1.5px] border-ink shadow-hard-sm ${saved ? 'bg-flame text-white' : 'bg-paper'}`}
                >
                  <Heart className={`size-5 ${saved ? 'anim-stamp fill-current' : ''}`} />
                </button>
              </div>
              <h3 className="mt-6 font-head text-[32px] leading-tight">Time Cafe</h3>
              <p className="mt-3 text-sm leading-[22.75px] text-stone">
                Largest space: up to {venueMaxGuests(venue)} people. {venue.summary}
              </p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Amenities">
                {venue.amenities.map(
                  (a) => (
                    <li key={a} className="border border-line bg-paper px-2.5 py-1 text-xs text-ink">
                      {a}
                    </li>
                  ),
                )}
              </ul>
              <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
                <div className="border-[1.5px] border-ink bg-paper-2 px-4 py-3">
                  <p className="font-mono-b text-[10px] tracking-[0.8px] uppercase text-stone">Starting from</p>
                  <p className="font-p-display text-[28px] leading-none">
                    {venueFromRate(venue) === null ? 'Host quote' : formatRupees(venueFromRate(venue)!)} <span className="font-body text-sm text-stone">per hour</span>
                  </p>
                  <p className="mt-1 text-xs text-stone">minimum 3 hours</p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    onClick={onOpenVenue}
                    className="press inline-flex items-center gap-2 rounded-md border-[1.5px] border-ink bg-flame px-5 py-3 font-body-sb text-sm text-white shadow-hard-md"
                  >
                    View venue &amp; spaces <ArrowRight />
                  </button>
                  <p className="flex items-center gap-1.5 text-xs text-moss">
                    <ShieldCheck className="size-3.5" /> Browse first. No booking or charge.
                  </p>
                </div>
              </div>
            </div>
          </article> : <p className="mt-8 border border-line bg-white p-5">No venues are currently open for booking. Please check back shortly.</p>}
          <p className="reveal mt-6 text-center text-sm text-stone">
            Time Cafe is our current venue partner.
          </p>
        </section>

        {/* "What changed when they found SCENE/044" — the approved Figma frame
            (Scene workflows Main, node 230:1286). Copy, photos and ratings are
            owner-supplied editorial content (lib/venueTestimonials.ts), kept
            separate from database reviews. */}
        <section aria-labelledby="organiser-feedback-title" className="relative overflow-hidden border-y-[1.5px] border-ink bg-flame text-white">
          <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-24">
            <div className="flex flex-col gap-8 border-b-[1.5px] border-ink/30 pb-8 lg:flex-row lg:items-end">
              <div className="min-w-0 flex-1">
                <p className="reveal inline-flex items-center gap-2 bg-ink px-3 py-1.5 font-mono-b text-[10px] leading-[15px] tracking-[1.2px] text-paper-2 uppercase">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-flame" />
                  {LANDING_TESTIMONIAL_SUMMARY.eyebrow}
                </p>
                <h2 id="organiser-feedback-title" className="reveal mt-4 max-w-[555px] font-p-display text-[32px] leading-[1.1] tracking-[-1px] text-paper-2 md:text-[40px] md:leading-[44px]">
                  {LANDING_TESTIMONIAL_SUMMARY.heading}
                </h2>
                <p className="reveal mt-4 max-w-[555px] text-[15px] leading-[24.375px] text-ink">
                  {LANDING_TESTIMONIAL_SUMMARY.intro}
                </p>
              </div>
              {/* Badge then chips, right-aligned — the Figma frame scatters these;
                  a right-aligned wrap keeps that read and stays responsive. */}
              <div className="reveal flex shrink-0 flex-col items-end gap-2 lg:w-[320px]">
                <p className="bg-white px-2.5 py-1.5 font-mono-b text-[10px] leading-[15px] tracking-[0.4px] text-flame">
                  {LANDING_TESTIMONIAL_SUMMARY.badge}
                </p>
                <ul className="flex flex-wrap justify-end gap-2" aria-label="What organisers say changed">
                  {LANDING_TESTIMONIAL_SUMMARY.chips.map((chip) => (
                    <li key={chip} className="bg-ink px-2.5 py-1.5 font-mono-b text-[10px] leading-[15px] tracking-[0.4px] text-paper-2">
                      {chip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ul className="mt-10 grid items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3" aria-label="Organiser reviews">
              {LANDING_TESTIMONIALS.map((t, i) => (
                <li
                  key={t.id}
                  className="reveal relative flex min-w-0 flex-col gap-3 border-[1.5px] border-ink bg-ink px-5 pb-5 pt-7 shadow-[3px_3px_0_0_#111]"
                  style={{ '--d': `${i * 90}ms` } as React.CSSProperties}
                >
                  <span aria-hidden="true" className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg leading-7">{t.pin}</span>

                  {/* Polaroid: tilted white frame with a printed caption. */}
                  <figure className={`${t.tilt} mx-auto w-full max-w-[243px] border-[1.5px] border-ink bg-white px-2 pb-3 pt-2 shadow-[2px_2px_0_0_#111]`}>
                    <img
                      src={t.eventPhoto}
                      alt={t.eventPhotoAlt}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <figcaption className="pt-2 text-center font-mono-b text-[11px] leading-[16.5px] tracking-[-0.275px] text-[#111]">
                      {t.caption}
                    </figcaption>
                  </figure>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <p className="bg-moss/20 px-2 py-1 font-mono-b text-[10px] leading-[15px] tracking-[0.4px] text-[#10b981] uppercase">
                      {t.outcome}
                    </p>
                    <p className="flex shrink-0 items-center gap-1 bg-[#0f2b20] px-2 py-1 font-mono-b text-[10px] leading-[15px] tracking-[0.4px] text-[#8bf0bd]">
                      <Star className="size-[11px]" />
                      <span className="sr-only">Rated </span>{t.rating}
                      <span className="sr-only"> out of 5</span>
                    </p>
                  </div>

                  <blockquote className="text-sm leading-[22.75px] text-paper-2">{t.quote}</blockquote>

                  <figcaption className="mt-auto flex items-center gap-3 border-t border-[#5f5e5e]/50 pt-4">
                    <img
                      src={t.profilePhoto}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="size-10 shrink-0 rounded-full border border-white/25 object-cover"
                    />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 font-head text-sm leading-5 text-paper-2">
                        {t.name}
                        <VerifiedSeal className="size-4 shrink-0 text-moss" />
                        <span className="sr-only">(verified organiser)</span>
                      </p>
                      <p className="pt-0.5 font-mono text-[11px] leading-[15.125px] text-[#c8c6c5]">
                        <span className="font-mono-b">{t.role}</span>
                        <br />
                        {t.org}
                      </p>
                    </div>
                  </figcaption>
                </li>
              ))}
            </ul>

            <div className="reveal mt-10 flex flex-wrap items-center gap-2 border-t border-ink/30 pt-6">
              <p className="flex items-center gap-1.5 font-head text-[15px] leading-[22.5px] text-paper-2">
                <Star className="size-[15px]" />
                {LANDING_TESTIMONIAL_SUMMARY.rating}
              </p>
              <p className="text-[13px] leading-[19.5px] text-ink">{LANDING_TESTIMONIAL_SUMMARY.ratingNote}</p>
            </div>
          </div>
        </section>

        {/* Trust */}
        <section id="why" className="scroll-mt-20 border-b border-line bg-paper-2">
          <div className="mx-auto grid max-w-[1152px] gap-12 px-5 py-20 md:px-8 md:py-24 lg:grid-cols-2">
            <div>
              <Eyebrow className="reveal">Why SCENE/044</Eyebrow>
              <h2 className="reveal mt-3 font-head text-3xl leading-tight tracking-[-0.6px] md:text-[40px]">
                Trust earned before we ask you for anything.
              </h2>
              <p className="reveal mt-4 max-w-[480px] text-stone">
                SCENE/044 helps people in Chennai find well-curated events. Venue booking extends that same care to the
                spaces those events happen in.
              </p>
              <div className="reveal mt-8 max-w-[480px] border-[1.5px] border-ink bg-paper p-6 shadow-hard">
                <p className="font-head text-lg">The price you see is the venue price.</p>
                <p className="mt-3 leading-7 text-stone">Send a request, wait for Time Cafe&apos;s approval, then pay to confirm. SCENE&apos;s commission is handled with the host, not added to your total.</p>
              </div>
            </div>
            <ul className="space-y-4 self-center">
              {[
                { I: ShieldCheck, t: 'Every space is seen in person', d: 'We visit each venue, check the real capacity, and photograph it honestly. What you see is what you book.' },
                { I: Check, t: 'Clear pricing, no surprises', d: 'Starting prices, inclusions, and house rules are shown before you enquire. Fees are always explained.' },
                { I: Clock, t: 'You always know your status', d: 'Request sent, approved, or confirmed — plain words tell you exactly where your booking stands.' },
              ].map(({ I, t, d }, k) => (
                <li
                  key={t}
                  className="reveal trust-card flex gap-4 border-[1.5px] border-ink bg-paper p-5 shadow-hard-md"
                  style={{ '--d': `${k * 100}ms` } as React.CSSProperties}
                >
                  <span className={`trust-icon t-i-${k} grid size-10 shrink-0 place-items-center border-[1.5px] border-ink bg-flame text-white`}>
                    <I className="size-5" />
                  </span>
                  <div>
                    <h3 className="font-head text-lg leading-6">{t}</h3>
                    <p className="mt-1.5 text-sm leading-[22.75px] text-stone">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Host band */}
        <section id="hosts" className="scroll-mt-20 px-5 py-20 md:px-8 md:py-24">
          <div className="reveal relative mx-auto max-w-[1216px] overflow-hidden border-[1.5px] border-ink bg-ink p-8 text-white shadow-hard-lg md:p-12">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px]"
            />
            <div className="relative grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div>
                <Eyebrow>Space curators invitation</Eyebrow>
                <h2 className="mt-3 max-w-[560px] font-head text-3xl leading-tight md:text-[40px]">
                  Your space could be someone else&apos;s next great event.
                </h2>
                <p className="mt-4 max-w-[520px] text-white/70">
                  Time Cafe is our first venue partner. List your space to welcome Chennai’s tech, design,
                  and community gatherings, with booking requests and check-in in one place.
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
                  {[
                    ['Time Cafe', 'Our first venue partner'],
                    ['₹0', 'Upfront listing or software fees'],
                    ['100%', 'Verified organiser identity'],
                  ].map(([t, d]) => (
                    <div key={t} className="border-l-2 border-flame pl-3">
                      <dt className="font-p-display text-xl">{t}</dt>
                      <dd className="mt-1 text-xs text-white/60">{d}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="flex flex-col gap-3 lg:items-end">
                <button
                  type="button"
                  onClick={onListVenue}
                  className="press inline-flex items-center justify-center gap-2 border-[1.5px] border-white bg-flame px-6 py-3.5 font-mono-b text-xs tracking-[0.72px] uppercase text-white"
                >
                  List your space on SCENE/044 <ArrowRight />
                </button>
                <a href="#hosts" className="inline-flex items-center gap-2 px-2 py-2 font-mono-b text-xs tracking-[0.72px] uppercase text-white/80 underline-offset-4 hover:underline">
                  Read host economics <ArrowRight />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
