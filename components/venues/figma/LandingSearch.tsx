"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { VENUE_EVENT_TYPES, venueSearchHref } from '@/lib/venues'
import { DEFAULT_VENUE_SEARCH, readVenueSearchPreferences, saveVenueSearchPreferences, type VenueSearchValues } from '@/lib/venueSearch'
import { ChevronDown, Search } from './icons'

/* Landing search — Figma node 503:1701 (Scene workflows Main).
 *
 * Four fields and a button that straddles the bar's bottom edge. Each cell is
 * one tap target: the native control is stretched over the whole cell, so a
 * tap anywhere opens the phone's own picker (the most accessible control on
 * mobile), and the visible text underneath shows the value or the design's
 * placeholder. The search page keeps its own five-field VenueSearchBar; this
 * submits the same values and carries the saved start time through. */

/** Group sizes, filtered as "spaces that seat at least this many". */
const SIZES = [
  { value: '5', label: 'Up to 5 people' },
  { value: '10', label: '6–10 people' },
  { value: '20', label: '11–20 people' },
  { value: '30', label: '21–30 people' },
  { value: '50', label: '31–50 people' },
  { value: '51', label: '50+ people' },
]

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const niceDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function Cell({ id, label, value, placeholder, children }: {
  id: string
  label: string
  value: string
  placeholder: string
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-[76px] min-w-0 flex-col justify-center bg-white px-5 py-4 transition-colors focus-within:bg-paper focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-flame hover:bg-paper md:px-6 md:py-5 lg:min-h-[157px]">
      <div className="pointer-events-none flex items-center justify-between gap-3">
        <span id={id} className="font-mono-b text-xs leading-[14px] tracking-[0.8px] uppercase text-stone">{label}</span>
        <ChevronDown className="size-4 shrink-0 text-ink" />
      </div>
      <p aria-hidden="true" className={`pointer-events-none truncate pt-2 text-base leading-[22px] ${value ? 'text-ink' : 'text-stone'}`}>
        {value || placeholder}
      </p>
      {children}
    </div>
  )
}

/** Stretches a native control over its cell, invisible but fully operable. */
const overlay = 'absolute inset-0 size-full cursor-pointer opacity-0'

export function LandingSearch({ areas }: { areas: string[] }) {
  const router = useRouter()
  const ids = useId()
  const [values, setValues] = useState<VenueSearchValues>({ ...DEFAULT_VENUE_SEARCH, eventType: '' })
  useEffect(() => {
    // Restore this tab's last search after hydration (sessionStorage only).
    const saved = readVenueSearchPreferences()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads sessionStorage, unavailable during SSR
    setValues((v) => ({ ...v, ...saved }))
  }, [])
  const set = (key: keyof VenueSearchValues, value: string) => setValues((v) => ({ ...v, [key]: value }))

  const area = areas.includes(values.location) ? values.location : ''
  const eventType = (VENUE_EVENT_TYPES as readonly string[]).includes(values.eventType) ? values.eventType : ''
  const size = SIZES.find((s) => s.value === values.people)

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const next = { ...values, location: area || DEFAULT_VENUE_SEARCH.location }
    saveVenueSearchPreferences(next)
    router.push(venueSearchHref(next))
  }

  return (
    <form onSubmit={submit} role="search" aria-label="Search venues" className="mx-auto w-full max-w-[1024px]">
      {/* Gap-as-border: a 1px gap over the line colour draws the dividers, so
          they stay right at 1, 2 and 4 columns without per-breakpoint borders. */}
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border-[1.5px] border-ink bg-line shadow-hard-md sm:grid-cols-2 lg:grid-cols-4">
        <Cell id={`${ids}-where`} label="Where" value={area} placeholder="Any neighborhood">
          <select aria-labelledby={`${ids}-where`} value={area} onChange={(e) => set('location', e.target.value)} className={overlay}>
            <option value="">Any neighborhood</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Cell>
        <Cell id={`${ids}-format`} label="Format" value={eventType} placeholder="What are you planning">
          <select aria-labelledby={`${ids}-format`} value={eventType} onChange={(e) => set('eventType', e.target.value)} className={overlay}>
            <option value="">Any kind of event</option>
            {VENUE_EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Cell>
        <Cell id={`${ids}-date`} label="Date" value={values.date ? niceDate(values.date) : ''} placeholder="Pick a date">
          <input
            type="date"
            aria-labelledby={`${ids}-date`}
            min={today()}
            value={values.date}
            onChange={(e) => set('date', e.target.value)}
            // Desktop browsers only open the calendar from its own icon; open
            // it from anywhere in the cell, as touch devices already do.
            onClick={(e) => { try { e.currentTarget.showPicker?.() } catch { /* unsupported */ } }}
            className={overlay}
          />
        </Cell>
        <Cell id={`${ids}-size`} label="Capacity" value={size?.label ?? ''} placeholder="How many attendees">
          <select aria-labelledby={`${ids}-size`} value={size?.value ?? ''} onChange={(e) => set('people', e.target.value)} className={overlay}>
            <option value="">Any group size</option>
            {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </Cell>
      </div>

      {/* Straddles the bar's bottom edge, as in the frame. White on the design's
          #ff432a is 3.4:1, below AA for 16px text, so it uses the accessible
          brand red the venue cards use. */}
      {/* Straddling only works where cells are tall with centred text (lg).
          Below that it would cover the last field, so it sits underneath —
          full width on phones, where it is also the easier thumb target. */}
      <div className="mt-4 flex justify-center lg:-mt-[27px]">
        <button
          type="submit"
          className="press relative inline-flex min-h-[55px] w-full items-center justify-center gap-2.5 rounded-md border-[1.5px] border-ink bg-primary-ink px-7 font-mono-b text-base leading-6 tracking-[0.8px] uppercase text-white shadow-hard sm:w-auto"
        >
          Search curated venues <Search className="size-[14px]" strokeWidth={2.25} />
        </button>
      </div>
    </form>
  )
}
