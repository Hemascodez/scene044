"use client";

import { Fragment, useEffect, useState } from 'react'
import { Check } from './icons'
import { REVIEW_WINDOW_HOURS } from './bookingsData'

const HOUR = 3_600_000
const MINUTE = 60_000

/**
 * The four stages a request passes through. Only the first three can be
 * "reached" while a booking is still `sent` — `decision` is the endpoint the
 * request is travelling toward, and it lights up when the status changes.
 *
 * Wording is deliberately honest: there is no read-receipt from the host, so
 * we say the request is *with* the host, never that they are looking at it.
 */
const STAGES = [
  { k: 'sent', label: 'Sent', hint: 'Request logged' },
  // The live backend does not message the host when a request arrives — it
  // appears on their dashboard — so this stage says exactly that.
  { k: 'queue', label: 'In queue', hint: "On host's dashboard" },
  { k: 'review', label: 'With host', hint: 'Checking dates' },
  { k: 'decision', label: 'Decision', hint: 'We notify you' },
] as const

/** Sent and in-queue are both true the moment the booking exists. */
const stageFor = () => 2

const formatLeft = (ms: number) => {
  const h = Math.floor(ms / HOUR)
  if (h >= 1) return `${h}h left`
  const m = Math.max(1, Math.round(ms / MINUTE))
  return `${m}m left`
}

const formatDue = (due: number) =>
  new Date(due).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })

export default function RequestFlight({ sentAt, onWithdraw }: { sentAt?: number; onWithdraw: () => void }) {
  // Re-render every minute so the countdown stays truthful without a backend.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(t)
  }, [])

  // Requests created before this field existed fall back to "just sent".
  const start = sentAt ?? now
  const elapsed = Math.max(0, now - start)
  const windowMs = REVIEW_WINDOW_HOURS * HOUR
  const due = start + windowMs
  const remaining = due - now
  const overdue = remaining <= 0

  const active = stageFor()
  const progress = Math.min(1, elapsed / windowMs)

  return (
    <div className="border-[1.5px] border-ink bg-paper shadow-hard-sm">
      {/* Header — status beacon + live countdown */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-[1.5px] border-dashed border-ink/25 px-4 py-2.5">
        <p className="flex items-center gap-2 font-mono-b text-[10px] leading-[15px] tracking-[1px] text-ink uppercase">
          <span aria-hidden="true" className={`rf-beacon size-1.5 rounded-full ${overdue ? 'bg-danger' : 'bg-flame'}`} />
          {overdue ? 'Past the 48-hour window' : 'Request in flight'}
        </p>
        <p className={`font-mono text-[10px] leading-[15px] tracking-[0.6px] uppercase ${overdue ? 'text-danger' : 'text-stone'}`}>
          {overdue ? `Due ${formatDue(due)}` : `${formatLeft(remaining)} · by ${formatDue(due)}`}
        </p>
      </div>

      {/* Stage rail */}
      <ol className="flex items-start px-4 pt-4 pb-3">
        {STAGES.map((s, i) => {
          const done = i < active
          const on = i === active
          const pending = i > active
          return (
            <Fragment key={s.k}>
              <li className="flex w-[66px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[80px]">
                <span
                  aria-hidden="true"
                  className={`relative grid size-7 place-items-center border-[1.5px] transition-colors duration-500 ${
                    done
                      ? 'border-ink bg-moss text-white'
                      : on
                        ? `border-ink bg-flame text-white ${overdue ? '' : 'rf-halo'}`
                        : 'border-ink/30 bg-white text-ink/30'
                  }`}
                >
                  {done ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <span className={`size-1.5 rounded-full ${on ? 'bg-white' : 'bg-ink/30'}`} />
                  )}
                </span>
                <span className={`font-mono-b text-[9px] leading-3 tracking-[0.5px] uppercase ${pending ? 'text-stone/60' : 'text-ink'}`}>
                  {s.label}
                </span>
                <span className="hidden text-[10px] leading-[13px] text-stone sm:block">{s.hint}</span>
              </li>

              {i < STAGES.length - 1 && (
                <span aria-hidden="true" className="relative mt-[13px] h-[2px] min-w-4 flex-1 overflow-hidden bg-ink/15">
                  {/* Completed track fills solid; the leg in progress stays dashed. */}
                  {i < active ? (
                    <span className="rf-fill absolute inset-0 origin-left bg-ink" />
                  ) : i === active ? (
                    <>
                      <span className={`rf-dash absolute inset-0 ${overdue ? 'opacity-40' : ''}`} />
                      {!overdue && <span className="rf-signal absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-flame" />}
                    </>
                  ) : null}
                </span>
              )}
            </Fragment>
          )
        })}
      </ol>

      {/* 48-hour window elapsed */}
      <div className="px-4 pb-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={REVIEW_WINDOW_HOURS}
          aria-valuenow={Math.round(progress * REVIEW_WINDOW_HOURS)}
          aria-label={`${REVIEW_WINDOW_HOURS} hour response window`}
          className="h-1 w-full overflow-hidden bg-ink/10"
        >
          <span
            className={`block h-full origin-left transition-transform duration-700 ease-out ${overdue ? 'bg-danger' : 'bg-flame'}`}
            style={{ transform: `scaleX(${progress})` }}
          />
        </div>
      </div>

      {/* Reassurance + escape hatch */}
      <div className="flex flex-col gap-3 border-t border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-ink">
          {overdue
            ? "The host hasn't replied within 48 hours. Nothing has been charged — you can keep waiting, or withdraw any time."
            : 'The host reviews your request within 48 hours. Nothing is charged yet.'}
        </p>
        <button
          type="button"
          onClick={onWithdraw}
          className="min-h-10 shrink-0 self-start px-1 font-mono-b text-[10px] tracking-[0.6px] text-stone uppercase underline underline-offset-4 hover:text-flame sm:self-auto"
        >
          Withdraw request
        </button>
      </div>

      <p className="sr-only" aria-live="polite">
        {overdue
          ? `Request is past the ${REVIEW_WINDOW_HOURS} hour window. Nothing has been charged.`
          : `Stage ${active + 1} of ${STAGES.length}: ${STAGES[active].label}. ${formatLeft(remaining)} in the host's ${REVIEW_WINDOW_HOURS} hour window.`}
      </p>
    </div>
  )
}
