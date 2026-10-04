"use client";

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SiteFooter, SiteHeader } from './SiteChrome'
import Dropdown from './Dropdown'
import Carousel from './Carousel'
import useReveal from './useReveal'
import HowItWorks from './HowItWorks'
import { ArrowRight, Check, Clock, Heart, MapPin, Search, ShieldCheck, Star } from './icons'
const exterior = '/venues/figma/1f1a5.jpg'
const hall = '/venues/figma/237e9.jpg'
const crowd = '/venues/figma/27065.jpg'
const heroImg1 = '/venues/figma/hero-carousel-1.jpg'
const heroImg2 = '/venues/figma/hero-carousel-2.jpg'
const heroImg3 = '/venues/figma/hero-carousel-3.jpg'
const heroImg4 = '/venues/figma/hero-carousel-4.jpg'
const heroImg5 = '/venues/figma/hero-carousel-5.jpg'
const heroImg6 = '/venues/figma/hero-carousel-6.jpg'
const jam = '/venues/figma/2010d.jpg'
const salon = '/venues/figma/5f65d.jpg'
const mixer = '/venues/figma/249eb.jpg'
const av1 = '/venues/figma/0e739.jpg'
const av2 = '/venues/figma/869ee.jpg'
const av3 = '/venues/figma/03451.jpg'

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


const reviews = [
  {
    img: jam,
    alt: 'Time Cafe courtyard set up for a design system jam with designers seated among greenery.',
    cap: "AI Build meetup · Nov '24",
    tags: ['Zero audio echo', 'South Indian filter brew'],
    r: '5.0',
    q: 'Hosted 35 product designers here. The courtyard airflow kept everyone energized, the AV cables were already connected, and the filter coffee kept flowing. Best venue in Nungambakkam by far!',
    name: 'Chandru',
    role: 'Founder · Doing things AI',
    av: av1,
    tilt: '-rotate-[1.5deg]',
  },
  {
    img: salon,
    alt: "AI Builders Salon in progress inside Time Cafe's main hall with attendees on laptops.",
    cap: "AI Builders Salon · Oct '24",
    tags: ['4K ultra-short throw', 'DG genset backup'],
    r: '5.0',
    q: 'The ultra-short throw projector and 500Mbps leased line meant zero technical hiccups for our live coding demo. Host Prisha even had extension boards pre-routed for all 40 laptops!',
    name: 'Karthik Subramanian',
    role: 'Founder · Madras Tech Guild & AI Builders',
    av: av2,
    tilt: 'rotate-[1deg] lg:translate-y-6',
  },
  {
    img: mixer,
    alt: "Founder Sunset Mixer on Time Cafe's terrace at golden hour with greenery and lounge seating.",
    cap: "Founder Sunset Mixer · Dec '24",
    tags: ['Sunset golden hour', 'Valet parking easy'],
    r: '4.9',
    q: "We transitioned from indoor pitch decks directly into the outdoor courtyard terrace for sundowner networking. Attendees wouldn't stop talking about how aesthetic the greenery and lighting was!",
    name: 'Priya Sundaram',
    role: 'Community Architect · Chennai SaaS Circle',
    av: av3,
    tilt: '-rotate-[0.75deg]',
  },
]

const Eyebrow = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <p className={`font-mono-b text-[11px] leading-4 tracking-[1.32px] uppercase text-flame ${className}`}>{children}</p>
)

/**
 * The venue landing page, verbatim from the Figma Make prototype. The only
 * changes: navigation goes to real routes, and sign-in uses the shared,
 * real-OTP modal from VenueApp.
 */
export default function Landing() {
  const router = useRouter()
  const onOpenVenue = () => router.push('/venues/time-cafe')
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
          <form
            role="search"
            aria-label="Search venues"
            onSubmit={(e) => {
              e.preventDefault()
              document.getElementById('spaces')?.scrollIntoView()
            }}
            className="rise mt-20 grid rounded-md border-[1.5px] border-ink bg-white shadow-hard-md sm:grid-cols-2 lg:mt-16 lg:grid-cols-[1.2fr_1.15fr_1fr_1fr_68px]"
            style={{ '--d': '360ms' } as React.CSSProperties}
          >
            {[
              { l: 'Where', p: 'Any neighborhood', t: 'text', o: ['Nungambakkam'] },
              { l: 'Format', p: 'What are you planning', t: 'text', o: ['Tech meetup', 'Podcast recording', 'Workshop', 'Networking event', 'Product launch'] },
              { l: 'Date', p: 'Pick a date', t: 'date' },
              { l: 'Capacity', p: 'How many attendees', t: 'number' },
            ].map((f) => (
              <label
                key={f.l}
                className="flex flex-col border-b border-line px-5 py-4 transition-colors focus-within:bg-paper-2 sm:odd:border-r lg:border-r lg:border-b-0"
              >
                <span className="font-mono-b text-[10px] leading-[14px] tracking-[0.8px] uppercase text-stone">{f.l}</span>
                {f.o ? (
                  <Dropdown label={f.l} placeholder={f.p} options={f.o} />
                ) : (
                  <input
                    type={f.t}
                    min={f.t === 'number' ? 1 : undefined}
                    placeholder={f.p}
                    className="mt-0.5 w-full bg-transparent text-[13px] leading-5 text-ink placeholder:text-stone focus:outline-none"
                  />
                )}
              </label>
            ))}
            <button
              type="submit"
              aria-label="Search venues"
              className="flex items-center justify-center gap-2 rounded-b-[4px] bg-flame py-4 font-mono-b text-xs lg:rounded-b-none lg:rounded-r-[4px] tracking-[0.8px] text-white transition-[filter] hover:brightness-110 sm:col-span-2 lg:col-span-1"
            >
              <Search className="size-5" strokeWidth={2} />
              <span className="lg:sr-only">SEARCH</span>
            </button>
          </form>
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

          <article className="reveal mt-10 grid overflow-hidden border-[1.5px] border-ink bg-white shadow-hard lg:grid-cols-[594fr_425fr]">
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
                    <span className="text-ink">4.96</span> (42 meetups hosted)
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPin className="size-4" /> Wallace Garden, Nungambakkam, Chennai
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
                Up to 25-30 seated · Main Hall, open-air lush courtyard, and acoustic presentation suite. Ideal for
                technical meetups, design showcases, intimate product launches, and community mixers.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2" aria-label="Amenities">
                {['4K ultra-short projector', 'Full barista counter', '500Mbps leased line', 'DG power backup', 'Dedicated AV tech'].map(
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
                    ₹500 <span className="font-body text-sm text-stone">per hour</span>
                  </p>
                  <p className="mt-1 text-xs text-stone">minimum 3 hours</p>
                </div>
                <div className="flex flex-col items-start gap-2">
                  <button
                    type="button"
                    onClick={onOpenVenue}
                    className="press inline-flex items-center gap-2 rounded-md border-[1.5px] border-ink bg-flame px-5 py-3 font-body-sb text-sm text-white shadow-hard-md"
                  >
                    Request reservation <ArrowRight />
                  </button>
                  <p className="flex items-center gap-1.5 text-xs text-moss">
                    <ShieldCheck className="size-3.5" /> Host replies in 24h
                  </p>
                </div>
              </div>
            </div>
          </article>
          <p className="reveal mt-6 text-center text-sm text-stone">
            More independently owned Chennai venues are joining soon.
          </p>
        </section>

        {/* Testimonials */}
        <section className="relative overflow-hidden border-y-[1.5px] border-ink bg-flame text-white">
          <div className="mx-auto max-w-[1280px] px-5 py-20 md:px-8 md:py-24">
            <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="reveal inline-block border-[1.5px] border-ink bg-ink px-2.5 py-1 font-mono-b text-[11px] tracking-[1.32px] uppercase">
                  From people who have been there
                </p>
                <h2 className="reveal mt-4 max-w-[680px] font-head text-3xl leading-tight md:text-[40px]">
                  What organisers &amp; attendees say about Time Cafe ✨☕
                </h2>
                <p className="reveal mt-4 max-w-[600px] text-white/85">
                  48 meetups, design jams, and founder salons hosted with a 4.96★ rating. 100% verified organiser reviews.
                </p>
              </div>
              <ul className="reveal flex max-w-[420px] flex-wrap gap-2 lg:justify-end" aria-label="Highlights">
                {['House Cold Brew · 4.9★', '500 Mbps Dedicated Fiber', 'Lush Open Courtyard', 'Shure Podcast Studio', 'Plugs at Every Table'].map(
                  (t) => (
                    <li key={t} className="border-[1.5px] border-ink bg-paper px-2.5 py-1 font-body-m text-xs text-ink">
                      {t}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <ul className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {reviews.map((r, k) => (
                <li key={r.name} className="reveal" style={{ '--d': `${k * 120}ms` } as React.CSSProperties}>
                  <figure
                    className={`flex h-full flex-col border-[1.5px] border-ink bg-paper p-3 text-ink shadow-hard-lg transition-transform duration-500 hover:rotate-0 ${r.tilt}`}
                  >
                    <div className="relative overflow-hidden border-[1.5px] border-ink">
                      <img src={r.img} alt={r.alt} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105" />
                      <p className="absolute bottom-2 left-2 bg-ink px-2 py-0.5 font-mono-b text-[10px] tracking-[0.6px] text-white">
                        {r.cap}
                      </p>
                    </div>
                    <div className="flex flex-1 flex-col p-2 pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <ul className="flex flex-wrap gap-1.5">
                          {r.tags.map((t) => (
                            <li key={t} className="border border-line bg-paper-2 px-2 py-0.5 text-[11px] text-stone">
                              {t}
                            </li>
                          ))}
                        </ul>
                        <span className="flex items-center gap-1 font-mono-b text-xs">
                          <Star className="size-3.5 text-flame" />
                          <span className="sr-only">Rated </span>
                          {r.r}
                        </span>
                      </div>
                      <blockquote className="mt-5 flex-1 text-sm leading-[22.75px]">“{r.q}”</blockquote>
                      <figcaption className="mt-5 flex items-center gap-3 border-t border-line pt-4">
                        <img src={r.av} alt="" className="size-9 rounded-full border border-ink object-cover" />
                        <div className="min-w-0">
                          <p className="flex items-center gap-1 font-body-sb text-sm">
                            {r.name}
                            <ShieldCheck className="size-3.5 text-moss" />
                            <span className="sr-only">(verified organiser)</span>
                          </p>
                          <p className="truncate text-xs text-stone">{r.role}</p>
                        </div>
                      </figcaption>
                    </div>
                  </figure>
                </li>
              ))}
            </ul>
            <p className="reveal mt-14 flex flex-wrap items-center justify-center gap-x-2 text-sm text-white/90">
              <Star className="size-4 text-paper" />
              <strong className="font-body-sb text-white">4.96 out of 5</strong> · Based on 48 verified Chennai tech &amp;
              design community events
            </p>
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
              <figure className="reveal trust-quote mt-8 max-w-[480px] border-[1.5px] border-ink bg-paper p-6 shadow-hard">
                <div className="trust-stars flex gap-0.5 text-flame" role="img" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }).map((_, k) => (
                    <Star key={k} className="size-4" />
                  ))}
                </div>
                <blockquote className="mt-4 leading-7">
                  “I knew what the space cost, what was included and what to expect before we booked. That made planning
                  the event so much easier.”
                </blockquote>
                <figcaption className="mt-4 font-mono text-xs text-stone">— A SCENE/044 Organiser</figcaption>
              </figure>
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
                  Join 40+ curated independent spaces hosting Chennai’s top tech, design, and cultural gatherings. We
                  handle inquiries, schedule deposits, and on-site guest screening.
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3">
                  {[
                    ['₹1.8L – 3.2L', 'Average monthly space earnings'],
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
