"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { VenueIcon } from "@/components/venues/VenueUi";

const STEPS = [
  { n: "01", t: "Send a request", d: "Pick a space, date and crowd size. Free to ask." },
  { n: "02", t: "The host approves", d: "A real person says yes within 48 hours." },
  { n: "03", t: "You're booked", d: "Pay, get your pass, show it at the door." },
] as const;
const DWELL = 4200;

/** Deterministic 9×9 QR-ish pattern with finder corners (illustration only). */
const QR = (() => {
  const cells: [number, number][] = [];
  let seed = 44;
  for (let y = 0; y < 9; y++)
    for (let x = 0; x < 9; x++) {
      const finder = (x < 3 && y < 3) || (x > 5 && y < 3) || (x < 3 && y > 5);
      seed = (seed * 9301 + 49297) % 233280;
      if (finder || seed / 233280 > 0.5) cells.push([x, y]);
    }
  return cells;
})();

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

/**
 * One slip that transforms through the three states of a real booking:
 * sending → approved → booked pass.
 *
 * The content is illustrative, but nothing in it contradicts the product: the
 * venue name comes from the live catalog, and the guest count is capped at that
 * venue's real maximum, so the sample can never show a group the venue could not
 * seat. The choreography is CSS keyed on step changes; it is gated on
 * viewport + hover/focus + reduced-motion so it only ever moves when it is both
 * visible and welcome.
 */
export function HowItWorks({ venueName, maxGuests }: { venueName: string; maxGuests: number | null }) {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { amount: 0.35 });

  const playing = inView && !paused && !reduced;
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => setStep((s) => (s + 1) % 3), DWELL);
    return () => clearTimeout(timer);
  }, [playing, step]);

  const guests = Math.min(25, maxGuests ?? 25);
  const fields: [string, string][] = [
    ["Venue", venueName],
    ["Date", "Sat, 18 Oct · 6–10 PM"],
    ["Guests", `${guests} people · Book launch`],
  ];

  return (
    <div
      ref={root}
      className="mt-12 grid overflow-hidden border-[1.5px] border-foreground bg-white shadow-hard-lg lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      {/* Step rail */}
      <ol className="flex flex-col divide-y-[1.5px] divide-foreground border-b-[1.5px] border-foreground lg:border-b-0 lg:border-r-[1.5px]">
        {STEPS.map((s, i) => {
          const on = i === step;
          const done = i < step;
          return (
            <li key={s.n} className="flex-1">
              <button
                type="button"
                onClick={() => setStep(i)}
                aria-current={on ? "step" : undefined}
                className={`group relative flex h-full w-full items-start gap-4 px-6 py-5 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary md:py-6 ${on ? "bg-foreground text-background" : "bg-white text-foreground hover:bg-secondary"}`}
              >
                <span
                  className={`grid size-10 shrink-0 place-items-center border-[1.5px] font-mono text-xs font-bold transition-all duration-300 ${
                    on ? "border-primary bg-primary text-white" : done ? "border-foreground bg-signal text-white" : "border-foreground bg-venue-paper text-foreground"
                  }`}
                >
                  {done ? <VenueIcon name="check" className="size-4" /> : s.n}
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-lg font-bold leading-6 md:text-xl">{s.t}</span>
                  <span className={`mt-1 block text-sm leading-5 transition-colors ${on ? "text-background/70" : "text-muted-foreground"}`}>{s.d}</span>
                </span>
                {/* Dwell progress */}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-1 overflow-hidden">
                  {on && (
                    <span
                      key={`${step}-${playing}`}
                      className="hiw-progress block h-full origin-left bg-primary"
                      style={{ animationDuration: `${DWELL}ms`, animationPlayState: playing ? "running" : "paused" }}
                    />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Stage */}
      <div className="relative flex min-h-[380px] items-center justify-center overflow-hidden bg-venue-paper px-6 py-10 md:min-h-[420px]" aria-hidden>
        <div className="relative w-full max-w-[340px]">
          <div
            key={`slip-${step === 1}`}
            className={`relative border-[1.5px] border-foreground bg-white shadow-hard transition-transform duration-500 ${step === 1 ? "-rotate-1" : step === 2 ? "rotate-1" : ""}`}
          >
            {/* The slip dips as it leaves the sender, which links step 1 to step 2. */}
            <div className={step === 1 && playing ? "hiw-depart" : ""}>
              {/* Header */}
              <div className="flex items-center justify-between border-b-[1.5px] border-dashed border-foreground/30 px-5 py-3">
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Scene/044 · {step === 2 ? "Pass" : "Request"}</span>
                <span key={step} className={`hiw-swap inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] ${step === 0 ? "text-primary-ink" : "text-signal-ink"}`}>
                  <span className={`size-1.5 ${step === 0 ? "hiw-pulse bg-primary" : "bg-signal"}`} />
                  {["Sending", "Approved", "Confirmed"][step]}
                </span>
              </div>

              {/* Body — fields stay put, which keeps the transformation feeling continuous */}
              <dl className="grid gap-3 px-5 py-4">
                {fields.map(([k, v], i) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{k}</dt>
                    <dd className="relative truncate text-sm font-semibold text-foreground">
                      <span key={`${k}-${step === 0}`} className={step === 0 ? "hiw-type inline-block" : ""} style={delay(250 + i * 380)}>
                        {v}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>

              {/* Footer morphs per step */}
              <div className="relative min-h-[112px] border-t-[1.5px] border-foreground/15 px-5 py-4">
                {step === 0 && (
                  <div key="s0" className="hiw-swap flex h-full items-center justify-between gap-3">
                    <span className="text-xs leading-5 text-muted-foreground">No charge to enquire.</span>
                    <span className="hiw-send relative inline-flex items-center gap-2 border-[1.5px] border-foreground bg-primary px-4 py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-white shadow-hard-sm" style={delay(1500)}>
                      Send request
                      <svg viewBox="0 0 24 24" className="hiw-plane size-3.5" style={delay(2100)} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinejoin="round">
                        <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                      </svg>
                    </span>
                  </div>
                )}
                {step === 1 && (
                  <div key="s1" className="hiw-swap flex items-center gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full border-[1.5px] border-foreground bg-secondary font-display text-sm font-bold">{venueName.charAt(0)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{venueName} host</p>
                      <p className="hiw-type text-xs leading-5 text-muted-foreground" style={delay(300)}>
                        &ldquo;That works — see you on the 18th!&rdquo;
                      </p>
                    </div>
                  </div>
                )}
                {step === 2 && (
                  <div key="s2" className="hiw-swap flex items-center justify-between gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Booking code</p>
                      <p className="mt-1 font-display text-xl font-bold tracking-[2px] text-foreground">SCN-7KQ4</p>
                      <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-signal-ink">
                        <VenueIcon name="check" className="size-3.5" /> Paid · show at reception
                      </p>
                    </div>
                    <svg viewBox="0 0 9 9" className="hiw-qr size-[72px] shrink-0 border-[1.5px] border-foreground bg-white p-1" shapeRendering="crispEdges">
                      {QR.map(([x, y], i) => (
                        <rect key={i} x={x} y={y} width="1" height="1" fill="#14130d" style={delay(40 + i * 8)} />
                      ))}
                    </svg>
                  </div>
                )}
              </div>
            </div>

            {/* Perforation notches appear once it becomes a pass, and the tear rips across between them */}
            <span className={`absolute -left-[9px] top-[calc(100%-112px)] size-4 -translate-y-1/2 rounded-full border-[1.5px] border-foreground bg-venue-paper transition-opacity duration-300 ${step === 2 ? "opacity-100" : "opacity-0"}`} />
            <span className={`absolute -right-[9px] top-[calc(100%-112px)] size-4 -translate-y-1/2 rounded-full border-[1.5px] border-foreground bg-venue-paper transition-opacity duration-300 ${step === 2 ? "opacity-100" : "opacity-0"}`} />
            {step === 2 && (
              <span
                className="hiw-tear absolute left-1 right-1 top-[calc(100%-112px)] h-px -translate-y-1/2"
                style={{ backgroundImage: "linear-gradient(90deg, #14130d 0 5px, transparent 5px 10px)", backgroundSize: "10px 1px", opacity: 0.3 }}
              />
            )}
          </div>

          {/* Host stamp */}
          {step >= 1 && (
            <div key={`stamp-${step}`} className={`pointer-events-none absolute -right-4 -top-5 ${step === 1 ? "hiw-stamp" : ""}`} style={{ animationDelay: "700ms" }}>
              <span className="relative block -rotate-[10deg] border-[2.5px] border-primary bg-white/85 px-3 py-1.5 font-display text-lg font-bold uppercase tracking-[2px] text-primary-ink">
                {step === 1 ? "Approved" : "Booked"}
                {/* Shock ring thrown off on impact — sells the weight of the stamp */}
                {step === 1 && <span className="hiw-burst absolute -inset-1 border-[2.5px] border-primary" />}
              </span>
            </div>
          )}
        </div>

        {/* Trail — same signal language as the live tracker in My bookings */}
        <div className="pointer-events-none absolute inset-x-8 bottom-6 flex items-center gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="flex flex-1 items-center gap-2">
              <span className={`size-2.5 shrink-0 border-[1.5px] border-foreground transition-colors duration-500 ${i <= step ? "bg-primary" : "bg-white"}`} />
              {i < 2 && (
                <span className="relative h-[1.5px] flex-1 overflow-hidden bg-foreground/15">
                  {i < step ? (
                    <span className="absolute inset-0 origin-left bg-foreground" />
                  ) : i === step ? (
                    <>
                      <span className="rf-dash absolute inset-0" />
                      {playing && <span className="rf-signal absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary" />}
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
  );
}
