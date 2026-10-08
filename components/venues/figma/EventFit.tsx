'use client'

/* "How well it fits your event" — Figma node 119:3413 (Scene workflows Main).
 *
 * Editorial, not computed. The owner supplied these scores and notes for Time
 * Cafe from the SCENE team's own on-site visit; they match the original Figma
 * Make prototype, which the owner confirmed holds real content. That is why
 * this can say "8.2 / 10" where components/venues/VenueScore.tsx deliberately
 * refuses to invent a number: these are not derived from amenities, they are
 * someone's judgement. Change them only with owner input. */
import { useEffect, useRef, useState } from 'react'

const TIME_CAFE_FIT = {
  overall: 8.2,
  verdict: 'Great fit',
  headline: 'Strong fit for your kind of event',
  summary: 'Highly specialized space optimal for tech community and high-production content recording.',
  events: [
    { name: 'Podcast recording', score: 8, note: 'Wireless mics, quiet interior, intimate corners' },
    { name: 'Workshop', score: 9, note: 'Projector, supplies, flexible layout, fast wifi', topRated: true },
    { name: 'Tech meetup', score: 9, note: 'AV tech on-site, 500 Mbps, 45 seats, barista', topRated: true },
    { name: 'Networking event', score: 8, note: 'Courtyard + main hall flow, PA, parking' },
    { name: 'Product launch', score: 7, note: 'Atmospheric space; smaller audiences work best' },
  ],
} as const

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
 *  Restored from the original port (37d18b3); it was dropped along with the
 *  old score panel in 4f1b935, which is why the bars stopped animating. */
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

export function EventFit() {
  const fit = TIME_CAFE_FIT
  const [ref, seen] = useInView<HTMLElement>(0.75, 350)
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
          We made an on-site visit for you.
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
          {/* The active arc asset is drawn for the 8.2 score above. */}
          <div aria-hidden="true" className="absolute left-1/2 top-1/2 size-[96px] -translate-x-1/2 -translate-y-1/2">
            <div className="absolute inset-[-12.5%_-12.15%_5.36%_-12.5%]">
              <img alt="" src="/venues/figma/fit/gauge-active.svg" className="block size-full max-w-none" />
            </div>
          </div>
          <p className="sr-only">Overall fit: {fit.overall} out of 10</p>
          <div aria-hidden="true" className="absolute left-1/2 top-[calc(50%-2px)] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center whitespace-nowrap">
            <span className="font-head text-[28px] font-extrabold leading-none text-white tabular-nums"><CountUp to={fit.overall} run={seen} /></span>
            <span className="mt-0.5 font-body text-[10px] font-semibold text-[#9b97b1]">/10</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5">
          <span className="rounded-full bg-[rgba(0,240,255,0.08)] px-2.5 py-1 font-body text-[10px] font-bold uppercase text-[#22c55e]">
            {fit.verdict}
          </span>
          <p className="font-head text-[18px] text-white">{fit.headline}</p>
          <p className="font-body text-[13px] text-[#9b97b1]">{fit.summary}</p>
        </div>
      </div>

      {/* Per-event scores */}
      <ul className="relative flex flex-col gap-3">
        {fit.events.map((e) => {
          return (
            <li
              key={e.name}
              className="flex flex-col gap-2.5 rounded-[12px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-4 backdrop-blur-[8px]"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
                <div className="flex items-center gap-2.5">
                  <img alt="" aria-hidden="true" src={dotFor(e.score)} className="size-2 shrink-0" />
                  <h3 className="whitespace-nowrap font-head text-base font-semibold text-white">{e.name}</h3>
                  {'topRated' in e && e.topRated && (
                    <span className="whitespace-nowrap rounded-[4px] border border-[#10b981] px-2 py-[3px] font-body text-[9px] font-bold text-[#10b981]">
                      TOP RATED
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
    </section>
  )
}
