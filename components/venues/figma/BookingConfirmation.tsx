"use client";

import { useEffect, useId, useRef } from 'react'
const successIcon = '/venues/figma/confirm-c53a8.svg'
const closeIcon = '/venues/figma/confirm-02935.svg'
const pinIcon = '/venues/figma/confirm-58648.svg'
const calIcon = '/venues/figma/confirm-135c7.svg'
const clockIcon = '/venues/figma/confirm-95c70.svg'
const usersIcon = '/venues/figma/confirm-a7b0a.svg'
const noticeIcon = '/venues/figma/confirm-d17bc.svg'
const arrowIcon = '/venues/figma/confirm-09a5d.svg'

export type BookingSummary = {
  firstName: string
  venue: string
  eventType: string
  space: string
  image: string
  date: string
  window: string
  guests: string
}

export default function BookingConfirmation({
  summary,
  onClose,
  onEdit,
  onBookings,
  onBrowse,
}: {
  summary: BookingSummary
  onClose: () => void
  onEdit: () => void
  onBookings: () => void
  onBrowse: () => void
}) {
  const titleId = useId()
  const descId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const primary = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    primary.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const f = panel.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!f || !f.length) return
    const a = f[0]
    const z = f[f.length - 1]
    if (e.shiftKey && document.activeElement === a) {
      e.preventDefault()
      z.focus()
    } else if (!e.shiftKey && document.activeElement === z) {
      e.preventDefault()
      a.focus()
    }
  }

  const meta: [string, string, string][] = [
    [pinIcon, 'Location', summary.venue],
    [calIcon, 'Date', summary.date],
    [clockIcon, 'Time', summary.window],
    [usersIcon, 'Guests', `${summary.guests} people`],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onKeyDown={onKeyDown}>
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[8px]" onClick={onClose} aria-hidden="true" />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="anim-pop relative max-h-[94dvh] w-full overflow-y-auto border-[1.5px] border-ink bg-paper shadow-hard-lg sm:max-w-[550px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-5 py-4">
          <p className="flex items-center gap-2 font-mono-b text-[11px] leading-[16.5px] tracking-[1.32px] uppercase text-moss">
            <img src={successIcon} alt="" className="anim-stamp size-[18px]" />
            Request sent!
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close confirmation"
            className="grid size-8 place-items-center transition-transform hover:rotate-90"
          >
            <img src={closeIcon} alt="" className="size-[18px]" />
          </button>
        </div>

        <div className="px-5 pt-7 text-center sm:px-6">
          <h2 id={titleId} className="rise font-head text-[22px] leading-[30px]">
            You&apos;re all set, {summary.firstName}!
          </h2>
          <p id={descId} className="rise mt-2 text-sm leading-[22px] text-stone" style={{ '--d': '80ms' } as React.CSSProperties}>
            Your request has been sent to the venue.
            <br className="hidden sm:block" /> No charge is taken until the venue confirms.
          </p>
        </div>

        <div className="px-5 pt-8 sm:px-6">
          <article
            className="rise border-[1.5px] border-ink bg-white p-5 shadow-hard-md"
            style={{ '--d': '140ms' } as React.CSSProperties}
          >
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="h-[140px] w-full shrink-0 overflow-hidden border-[1.5px] border-ink bg-sand shadow-hard-sm sm:h-[87px] sm:w-[130px]">
                <img src={summary.image} alt={summary.space} className="size-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono-b text-[10px] leading-[15px] tracking-[0.6px] uppercase text-flame">{summary.eventType}</p>
                <h3 className="mt-1 font-head text-[18px] leading-[22.5px]">{summary.space}</h3>
                <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-2">
                  {meta.map(([icon, label, v]) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <img src={icon} alt="" className="size-3" />
                      <span className="sr-only">{label}: </span>
                      <span className="font-body-m text-[10px] leading-[15px] tracking-[0.4px] uppercase text-stone">{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        </div>

        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-5 pt-4 sm:px-6">
          <p className="flex items-center gap-1.5 rounded-[4px] border border-[#f97316] bg-[#fff7ed] px-2.5 py-1.5 font-mono-b text-[9px] leading-[13px] tracking-[0.6px] uppercase text-[#c2410c]">
            <img src={noticeIcon} alt="" className="size-[13px]" />
            {summary.venue} replies within 48 hours
          </p>
          <p className="text-xs leading-4 text-stone">You&apos;ll get a notification once confirmed.</p>
        </div>

        <div className="flex flex-col items-center gap-2.5 px-5 pb-6 pt-5 sm:px-6">
          <button
            ref={primary}
            type="button"
            onClick={onBookings}
            className="press flex w-full items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-3.5 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase text-white shadow-hard-sm"
          >
            Go to my bookings
            <img src={arrowIcon} alt="" className="size-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="press w-full border-[1.5px] border-ink bg-paper px-4 py-3 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase shadow-hard-sm"
          >
            Edit booking
          </button>
          <button type="button" onClick={onBrowse} className="py-1 text-xs leading-4 text-stone underline-offset-4 hover:underline">
            Or continue browsing spaces
          </button>
        </div>
      </div>
    </div>
  )
}
