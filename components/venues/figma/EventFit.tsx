'use client'

/* NOTE FOR CODEX — please keep these intact unless the owner says otherwise:
 *
 * 1. Scores are derived per venue in ./venueFit.ts from what the venue's own
 *    page lists, so the panel renders for every venue. Don't gate it back to
 *    Time Cafe or replace it with hand-entered numbers; improve the rubric in
 *    venueFit.ts instead, and keep each row's evidence note.
 * 2. The scroll motion. useInView, CountUp, FitBar and the gauge's dasharray
 *    transition are what run it; `.bar-fill.run` in app/globals.css depends on
 *    the trigger. Losing it is how the animation broke before (4f1b935).
 * 3. Accessibility. Visuals are aria-hidden and real values are in sr-only
 *    text, so screen readers hear "8 out of 10" once, not digits ticking.
 * 4. The gauge arc is drawn from the score (same circle as gauge-bg.svg:
 *    centre 48,48, r 44.4, a 260° sweep from 140°). Don't swap it back to a
 *    fixed image — it would show the wrong value for every other venue. */

/* "How well it fits your event" — Figma node 119:3413 (Scene workflows Main). */
import { useEffect, useRef, useState } from 'react'
import type { CatalogVenue } from '@/lib/venueCatalog'
import { venueFit } from './venueFit'


/** The design's three status-dot assets, by score tier. */
const dotFor = (score: number) =>
  score >= 9 ? '/venues/figma/fit/dot-cyan.svg' : score >= 8 ? '/venues/figma/fit/dot-amber.svg' : '/venues/figma/fit/dot-grey.svg'

/** Track and fill widths from the design (140px track, fill = score / 10). */
const TRACK_PX = 140
const BAR_PX = 6

/** Figma angles each fill's gradient along its own diagonal (183.07° at 112px,
 *  182.73° at 126px), so derive it rather than hardcoding one angle. */
const fillGradient = (width: number) =>
  `linear-gradient(${180 + (Math.atan(BAR_PX / width) * 180) / Math.PI}deg, #ff6b4a 25%, #f59e0b 75%)`

/** Fires once when the element's top crosses `zone` of the viewport height.
 *  Uses IntersectionObserver rather than waiting for window `load`: on a venue
 *  with many photos `load` can lag by seconds on a phone, and until it fired
 *  the panel sat at "0.0" with an empty gauge. */
function useInView<T extends Element>(zone = 0.8, delay = 250) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    if (!('IntersectionObserver' in window)) {
      timer = setTimeout(() => setSeen(true), delay)
      return () => clearTimeout(timer)
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        timer = setTimeout(() => setSeen(true), delay)
      },
      { rootMargin: `0px 0px -${Math.round((1 - zone) * 100)}% 0px` },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      clearTimeout(timer)
    }
  }, [zone, delay])
  return [ref, seen] as const
}

/** The track asset is an arc of r 44.4 around (48, 48), sweeping 260° from 140°
 *  (bottom-left) over the top. The active arc reuses that path and shows
 *  `score / 10` of it, so it is right for any venue. */
const R = 44.4
const at = (deg: number) => {
  const a = (deg * Math.PI) / 180
  return `${(48 + R * Math.cos(a)).toFixed(3)} ${(48 + R * Math.sin(a)).toFixed(3)}`
}
const ARC = `M ${at(140)} A ${R} ${R} 0 1 1 ${at(400)}`

function GaugeArc({ score, run }: { score: number; run: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 96 96" overflow="visible" className="absolute inset-0 size-[96px]"
      style={{ filter: 'drop-shadow(0 0 12px rgba(255,149,0,0.25))' }}>
      <defs>
        <linearGradient id="event-fit-arc" x1="48" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FF6B4A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
      </defs>
      <path
        d={ARC}
        pathLength={100}
        fill="none"
        stroke="url(#event-fit-arc)"
        strokeWidth={7.2}
        strokeLinecap="butt"
        strokeDasharray={`${run ? score * 10 : 0} 100`}
        className="transition-[stroke-dasharray] duration-[1100ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none"
      />
    </svg>
  )
}

function CountUp({ to, run, decimals = 1 }: { to: number; run: boolean; decimals?: number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reduced motion skips the count-up animation and shows the final value
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

/** Each bar triggers on its own as it scrolls in, so lower rows still animate
 *  on a phone where the section is taller than the screen. The grow itself is
 *  `.bar-fill.run` in globals.css (pv-bar-grow), reduced-motion aware. */
function FitBar({ score }: { score: number }) {
  const [ref, seen] = useInView<HTMLDivElement>(0.9, 400)
  const fill = (TRACK_PX * score) / 10
  return (
    <div ref={ref} aria-hidden="true" className="flex h-1.5 flex-1 overflow-clip rounded-[3px] bg-[rgba(255,255,255,0.4)] sm:w-[140px] sm:flex-none">
      <div className={`bar-fill h-full ${seen ? 'run' : ''}`} style={{ width: `${score * 10}%`, backgroundImage: fillGradient(fill) }} />
    </div>
  )
}

export function EventFit({ venue, verifiedOnSite = false }: {
  venue: CatalogVenue
  /** Only claim a visit where one happened — VenueDetail limits its
   *  "Verified on-site" copy to venues the team has actually visited. */
  verifiedOnSite?: boolean
}) {
  const fit = venueFit(venue)
  const [ref, seen] = useInView<HTMLElement>(0.75, 350)
  if (!fit) return null
  const strong = fit.verdict === 'Great fit' || fit.verdict === 'Good fit'
  return (
    <section
      ref={ref}
      aria-labelledby="event-fit-title"
      className="reveal relative mt-10 flex flex-col gap-8 overflow-hidden border border-white bg-[#252525] p-6 shadow-[4px_4px_0px_0px_#ff6b4a] md:p-10"
    >
      {/* Ambient glow orbs (decorative). */}
      <div aria-hidden="true" className="pointer-events-none absolute right-[-41px] top-[-41px] size-[280px]">
        <div className="absolute inset-[-35.71%]">
          <img alt="" src="/venues/figma/fit/glow-orb-top.svg" className="block size-full max-w-none" />
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[-97px] left-[-81px] size-[300px]">
        <div className="absolute inset-[-40%]">
          <img alt="" src="/venues/figma/fit/glow-orb-bottom.svg" className="block size-full max-w-none" />
        </div>
      </div>

      <header className="relative flex flex-col gap-2">
        <p className="font-body text-[11px] font-bold uppercase text-[#f97316]">How well it fits your event</p>
        <h2 id="event-fit-title" className="font-head text-[26px] leading-[34px] text-white md:text-[32px] md:leading-[40px]">
          {verifiedOnSite ? 'We made an on-site visit for you.' : 'Here’s how it matches your event.'}
        </h2>
      </header>

      {/* Hero gauge plate */}
      <div className="relative flex flex-col items-start gap-6 rounded-[16px] border border-[rgba(255,205,28,0.45)] bg-[rgba(255,255,255,0.02)] p-6 backdrop-blur-[10px] sm:flex-row sm:items-center">
        <div className="relative flex size-[96px] shrink-0 flex-col items-center justify-center">
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[96px] -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-[0_0_17.86%_0]">
              <img alt="" src="/venues/figma/fit/gauge-bg.svg" className="block size-full max-w-none" />
            </div>
          </div>
          <GaugeArc score={fit.overall} run={seen} />
          <p className="sr-only">Overall fit: {fit.overall} out of 10</p>
          <div aria-hidden="true" className="absolute left-1/2 top-[calc(50%-2px)] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center whitespace-nowrap">
            <span className="font-head text-[28px] font-extrabold leading-none text-white tabular-nums"><CountUp to={fit.overall} run={seen} /></span>
            <span className="mt-0.5 font-body text-[10px] font-semibold text-[#9b97b1]">/10</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <span className={`rounded-full px-2.5 py-1 font-body text-[10px] font-bold uppercase ${strong ? 'bg-[rgba(0,240,255,0.08)] text-[#22c55e]' : 'bg-[rgba(245,158,11,0.12)] text-[#f59e0b]'}`}>
            {fit.verdict}
          </span>
          <p className="font-head text-[18px] text-white">{fit.headline}</p>
          <p className="font-body text-[13px] text-[#9b97b1]">{fit.summary}</p>
        </div>
      </div>

      {/* Per-event scores */}
      <ul className="relative flex flex-col gap-3">
        {fit.rows.map((e) => {
          return (
            <li
              key={e.name}
              className="flex flex-col gap-2.5 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4 backdrop-blur-[8px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <img alt="" aria-hidden="true" src={dotFor(e.score)} className="size-2 shrink-0" />
                  <h3 className="font-head text-base font-semibold text-white">{e.name}</h3>
                  {e.bestMatch && (
                    <span className="whitespace-nowrap rounded-[4px] border border-[#10b981] px-2 py-[3px] font-body text-[9px] font-bold text-[#10b981]">
                      BEST MATCH
                    </span>
                  )}
                </div>
                <div className="flex w-full items-center gap-4 sm:w-auto">
                  <FitBar score={e.score} />
                  <p className="whitespace-nowrap font-head text-base text-white">
                    <span className="sr-only">{e.score} out of 10</span>
                    <span aria-hidden="true">{e.score}/10</span>
                  </p>
                </div>
              </div>
              <p className="font-body text-[13px] leading-[18px] text-[#9b97b1]">{e.note}</p>
            </li>
          )
        })}
      </ul>
      <p className="relative -mt-4 font-body text-[13px] leading-[18px] text-[#9b97b1]">
        Scored from the rooms, capacity and amenities listed on this page. A missing item means it isn&apos;t listed yet — ask the host.
      </p>
    </section>
  )
}
