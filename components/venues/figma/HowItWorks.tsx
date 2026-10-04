"use client";

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Check } from './icons'

const STEPS = [
  { n: '01', t: 'Send a request', d: 'Pick a space, date and crowd size. Free to ask.' },
  { n: '02', t: 'The host approves', d: 'A real person says yes within 48 hours.' },
  { n: '03', t: "You're booked", d: 'Pay, get your pass, show it at the door.' },
]
const DWELL = 4200

/** Deterministic 9×9 QR-ish pattern with finder corners. */
const QR = (() => {
  const cells: [number, number][] = []
  let seed = 44
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const finder = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5)
      seed = (seed * 9301 + 49297) % 233280
      if (finder || seed / 233280 > 0.5) cells.push([x, y])
    }
  return cells
})()

const d = (ms: number) => ({ '--d': `${ms}ms` }) as CSSProperties

export default function HowItWorks() {
  const [step, setStep] = useState(0)
  const [paused, setPaused] = useState(false)
  const [inView, setInView] = useState(false)
  const [reduced, setReduced] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs with the prefers-reduced-motion media query, an external system
    setReduced(mq.matches)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 })
    if (root.current) io.observe(root.current)
    return () => {
      mq.removeEventListener('change', on)
      io.disconnect()
    }
  }, [])

  const playing = inView && !paused && !reduced
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setStep((s) => (s + 1) % 3), DWELL)
    return () => clearTimeout(t)
  }, [playing, step])

  return (
    <div
      ref={root}
      className="hiw reveal mt-12 grid overflow-hidden border-[1.5px] border-ink bg-white shadow-hard-lg lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setPaused(false)}
    >
      {/* Step rail */}
      <ol className="flex flex-col divide-y-[1.5px] divide-ink border-b-[1.5px] border-ink lg:border-r-[1.5px] lg:border-b-0">
        {STEPS.map((s, i) => {
          const on = i === step
          const done = i < step
          return (
            <li key={s.n} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={on ? 'step' : undefined}
                className={`group relative flex h-full w-full items-start gap-4 px-6 py-5 text-left transition-colors duration-300 md:py-6 ${on ? 'bg-ink text-white' : 'bg-white text-ink hover:bg-sand'}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center border-[1.5px] font-mono-b text-xs transition-all duration-300 ${
                    on ? 'border-flame bg-flame text-white' : done ? 'border-ink bg-moss text-white' : 'border-ink bg-paper text-ink'
                  }`}
                >
                  {done ? <Check className="size-4" strokeWidth={3} /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block font-head text-lg leading-6 md:text-xl">{s.t}</span>
                  <span className={`mt-1 block text-sm leading-5 transition-colors ${on ? 'text-white/70' : 'text-stone'}`}>{s.d}</span>
                </span>
                {/* Dwell progress */}
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 overflow-hidden">
                  {on && (
                    <span
                      key={`${step}-${playing}`}
                      className="hiw-progress block h-full origin-left bg-flame"
                      style={{ animationDuration: `${DWELL}ms`, animationPlayState: playing ? 'running' : 'paused' }}
                    />
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {/* Stage: one slip that transforms through the three states */}
      <div className="hiw-stage relative flex min-h-[380px] items-center justify-center overflow-hidden bg-paper-2 px-6 py-10 md:min-h-[420px]" aria-hidden="true">
        <div className="relative w-full max-w-[340px]">
          <div
            key={`slip-${step === 1}`}
            className={`hiw-slip relative border-[1.5px] border-ink bg-white shadow-hard transition-transform duration-500 ${step === 1 ? '-rotate-1' : step === 2 ? 'rotate-1' : ''}`}
          >
            {/* The slip dips as it leaves the sender, which links step 1 to step 2. */}
            <div className={step === 1 && playing ? 'hiw-depart' : ''}>
            {/* Header */}
            <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-ink/30 px-5 py-3">
              <span className="font-mono-b text-[10px] tracking-[1.4px] text-stone uppercase">Scene/044 · {step === 2 ? 'Pass' : 'Request'}</span>
              <span key={step} className={`anim-pop inline-flex items-center gap-1.5 font-mono-b text-[10px] tracking-[1px] uppercase ${step === 0 ? 'text-flame' : 'text-moss'}`}>
                <span className={`size-1.5 rounded-full ${step === 0 ? 'hiw-pulse bg-flame' : 'bg-moss'}`} />
                {['Sending', 'Approved', 'Confirmed'][step]}
              </span>
            </div>

            {/* Body — fields stay put, which keeps the transformation feeling continuous */}
            <dl className="grid gap-3 px-5 py-4">
              {[
                ['Venue', 'Time Cafe & Spaces'],
                ['Date', 'Sat, 18 Oct · 6–10 PM'],
                ['Guests', '40 people · Book launch'],
              ].map(([k, v], i) => (
                <div key={k} className="flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[10px] tracking-[1px] text-stone uppercase">{k}</dt>
                  <dd className="relative truncate font-body-sb text-sm text-ink">
                    <span key={`${k}-${step === 0}`} className={step === 0 ? 'hiw-type inline-block' : ''} style={d(250 + i * 380)}>
                      {v}
                    </span>
                  </dd>
                </div>
              ))}
            </dl>

            {/* Footer morphs per step */}
            <div className="relative min-h-[112px] border-t-[1.5px] border-ink/15 px-5 py-4">
              {step === 0 && (
                <div key="s0" className="hiw-swap flex h-full items-center justify-between gap-3">
                  <span className="text-xs leading-5 text-stone">No charge to enquire.</span>
                  <span className="hiw-send relative inline-flex items-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-2.5 font-mono-b text-[10px] tracking-[1px] text-white uppercase shadow-hard-sm" style={d(1500)}>
                    Send request
                    <svg viewBox="0 0 24 24" className="hiw-plane size-3.5" style={d(2100)} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                    </svg>
                  </span>
                </div>
              )}
              {step === 1 && (
                <div key="s1" className="hiw-swap flex items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-sand font-head text-sm">P</span>
                  <div className="min-w-0">
                    <p className="font-body-sb text-sm text-ink">Priya, host</p>
                    <p className="hiw-type text-xs leading-5 text-stone" style={d(300)}>
                      &quot;The terrace is yours. See you on the 18th!&quot;
                    </p>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div key="s2" className="hiw-swap flex items-center justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] tracking-[1px] text-stone uppercase">Booking code</p>
                    <p className="mt-1 font-head text-xl tracking-[2px] text-ink">SCN-7KQ4</p>
                    <p className="mt-2 inline-flex items-center gap-1.5 font-body-m text-xs text-moss">
                      <Check className="size-3.5" strokeWidth={2.5} /> Paid · show at reception
                    </p>
                  </div>
                  <svg viewBox="0 0 9 9" className="hiw-qr size-[72px] shrink-0 border-[1.5px] border-ink bg-white p-1" shapeRendering="crispEdges">
                    {QR.map(([x, y], i) => (
                      <rect key={i} x={x} y={y} width="1" height="1" fill="#1c1c18" style={d(40 + i * 8)} />
                    ))}
                  </svg>
                </div>
              )}
              </div>
            </div>

            {/* Perforation notches appear once it becomes a pass */}
            <span className={`absolute top-[calc(100%-112px)] -left-[9px] size-4 -translate-y-1/2 rounded-full border-[1.5px] border-ink bg-paper-2 transition-opacity duration-300 ${step === 2 ? 'opacity-100' : 'opacity-0'}`} />
            <span className={`absolute top-[calc(100%-112px)] -right-[9px] size-4 -translate-y-1/2 rounded-full border-[1.5px] border-ink bg-paper-2 transition-opacity duration-300 ${step === 2 ? 'opacity-100' : 'opacity-0'}`} />
            {/* …and the perforation rips across between them */}
            {step === 2 && (
              <span
                aria-hidden="true"
                className="hiw-tear absolute top-[calc(100%-112px)] right-1 left-1 h-px -translate-y-1/2"
                style={{ backgroundImage: 'linear-gradient(90deg, var(--color-ink) 0 5px, transparent 5px 10px)', backgroundSize: '10px 1px', opacity: 0.3 }}
              />
            )}
          </div>

          {/* Host stamp */}
          {step >= 1 && (
            <div key={`stamp-${step}`} className={`pointer-events-none absolute -top-5 -right-4 ${step === 1 ? 'anim-stamp' : ''}`} style={{ animationDelay: '700ms' }}>
              <span className="relative block -rotate-[10deg] border-[2.5px] border-flame bg-white/85 px-3 py-1.5 font-head text-lg tracking-[2px] text-flame uppercase">
                {step === 1 ? 'Approved' : 'Booked'}
                {/* Shock ring thrown off on impact — sells the weight of the stamp */}
                {step === 1 && <span aria-hidden="true" className="hiw-burst absolute -inset-1 border-[2.5px] border-flame" />}
              </span>
            </div>
          )}
        </div>

        {/* Background trail — same signal language as the live tracker in My bookings */}
        <div className="pointer-events-none absolute inset-x-8 bottom-6 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-1 items-center gap-2">
              <span className={`size-2.5 shrink-0 border-[1.5px] border-ink transition-colors duration-500 ${i <= step ? 'bg-flame' : 'bg-white'}`} />
              {i < 2 && (
                <span className="relative h-[1.5px] flex-1 overflow-hidden bg-ink/15">
                  {i < step ? (
                    <span className="absolute inset-0 origin-left bg-ink transition-transform duration-700 ease-out" style={{ transform: 'scaleX(1)' }} />
                  ) : i === step ? (
                    <>
                      <span className="rf-dash absolute inset-0" />
                      {playing && <span className="rf-signal absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-flame" />}
                    </>
                  ) : null}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Step {step + 1} of 3: {STEPS[step].t}. {STEPS[step].d}
      </p>
    </div>
  )
}
