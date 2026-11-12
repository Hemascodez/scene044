'use client'

import { useState } from 'react'
import { filterGuests, type GuestFilter, type HostGuest } from '@/lib/client/eventHostApi'
import { formatSceneTime } from '@/lib/client/istTime'
import styles from './EventHostDark.module.css'

/**
 * "Guest list check-in" — the owner's dark design, in SCENE fonts with square
 * cards: check-in header with a seat bar, filter chips with counts, search,
 * and a card per guest with its own Check in button (fast at the door).
 */

const CARD_BG = 'linear-gradient(160deg,#211813 0%,#14130d 60%,#170f0c 100%)'
const MUTED = '#b5aeaa'
const RED_TEXT = '#ff8a77'

const AVATAR: Record<HostGuest['status'], { bg: string; fg: string; glow: string }> = {
  checked_in: { bg: 'linear-gradient(135deg,#86efac,#4ade80)', fg: '#052e16', glow: 'rgba(74,222,128,.14)' },
  confirmed: { bg: 'linear-gradient(135deg,#ff8a77,#ff5a43)', fg: '#1a0a08', glow: 'rgba(255,45,22,.22)' },
  cancelled: { bg: 'linear-gradient(135deg,#4a4340,#363029)', fg: '#d8d2ce', glow: 'rgba(255,255,255,0)' },
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function phoneLabel(phone: string) {
  const d = phone.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone
}

export function EventGuestList({ guests, onCheckIn }: { guests: HostGuest[]; onCheckIn: (guest: HostGuest) => Promise<void> }) {
  const [filter, setFilter] = useState<GuestFilter>('all')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const active = guests.filter((g) => g.status !== 'cancelled')
  const checked = guests.filter((g) => g.status === 'checked_in').length
  const visible = filterGuests(guests, query, filter)
  const chips: [GuestFilter, string, number][] = [
    ['all', 'ALL', guests.length],
    ['not_arrived', 'NOT ARRIVED', guests.filter((g) => g.status === 'confirmed').length],
    ['checked_in', 'CHECKED IN', checked],
    ['cancelled', 'CANCELLED', guests.filter((g) => g.status === 'cancelled').length],
  ]

  async function checkIn(g: HostGuest) {
    setBusy(g.code)
    try {
      await onCheckIn(g)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className="relative border-[1.5px] border-ink p-3 text-white sm:p-5"
      style={{
        background:
          'radial-gradient(ellipse 90% 40% at 0% 0%, rgba(255,45,22,.22), rgba(255,45,22,0) 62%), radial-gradient(rgba(255,255,255,.07) 1px, transparent 1.2px) 0 0 / 22px 22px, #0e0a08',
      }}
    >
      <div className="relative overflow-hidden border border-white/10 p-5 sm:p-6" style={{ background: CARD_BG }}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(255,45,22,.34), rgba(255,45,22,0) 58%)' }} />
        <div className="relative">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] font-bold tracking-[0.16em]" style={{ color: MUTED }}>READER PASS</span>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: RED_TEXT }}>
              <span className={`${styles.dot} size-2 rounded-full bg-[#ff2d16] shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
              CHECK-IN OPEN
            </span>
          </div>
          <div className="mt-3.5 flex items-end justify-between gap-3">
            <h2 className="font-display text-[40px] font-black leading-none tracking-[-0.04em] [text-shadow:0_0_40px_rgba(255,45,22,.45)] sm:text-[44px]">Guests</h2>
            <div className="text-right">
              <p className="font-display text-[36px] font-black leading-none tracking-[-0.04em] sm:text-[40px]">
                {checked}
                <span className="text-xl font-medium" style={{ color: MUTED }}> / {active.length}</span>
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: RED_TEXT }}>CHECKED IN</p>
            </div>
          </div>
          <div className="mt-5 flex gap-1" role="progressbar" aria-label="Guests checked in" aria-valuemin={0} aria-valuemax={active.length} aria-valuenow={checked}>
            {active.map((g, i) => (
              <div
                key={g.code}
                className={`${styles.seg} h-3 min-w-0 flex-1`}
                style={{ background: g.status === 'checked_in' ? 'linear-gradient(180deg,#ff6a55,#e0301f)' : 'rgba(255,255,255,.12)', animationDelay: `${i * 50}ms` }}
              />
            ))}
          </div>
        </div>
      </div>

      <div role="group" aria-label="Filter guests" className="mt-4 flex flex-wrap gap-2">
        {chips.map(([id, label, n]) => {
          const on = filter === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => setFilter(id)}
              className={`${styles.chip} inline-flex min-h-11 items-center gap-2 border px-3 font-mono text-[11px] font-bold tracking-[0.1em] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`}
              style={{
                background: on ? 'rgba(255,45,22,.18)' : 'rgba(255,255,255,.05)',
                borderColor: on ? 'rgba(255,106,85,.6)' : 'rgba(255,255,255,.14)',
                color: on ? '#ffffff' : '#d8d2ce',
              }}
            >
              {label}
              <span className="min-w-5 px-1.5 text-center" style={{ background: on ? '#ff5a43' : 'rgba(255,255,255,.12)', color: on ? '#1a0a08' : '#ffffff' }}>
                {n}
              </span>
            </button>
          )
        })}
      </div>

      <label className="mt-3 flex h-[50px] items-center gap-2.5 border border-white/15 bg-white/5 px-4 focus-within:border-[#ff6a55]/70 focus-within:shadow-[0_0_0_3px_rgba(255,45,22,.18)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M15 15l6 6" />
        </svg>
        <span className="sr-only">Search guests</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, phone or code"
          className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-[#8f8783]"
        />
      </label>

      <ul className="mt-5 flex flex-col gap-3.5">
        {visible.map((g, i) => {
          const a = AVATAR[g.status]
          const cancelled = g.status === 'cancelled'
          return (
            <li
              key={g.code}
              className={`${styles.card} relative overflow-hidden border border-white/10 p-4`}
              style={{ background: CARD_BG, opacity: cancelled ? 0.6 : 1, animationDelay: `${i * 60}ms` }}
            >
              <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: `radial-gradient(ellipse at 100% 0%, ${a.glow}, rgba(255,45,22,0) 55%)` }} />
              <div className="relative">
                <div className="flex items-start gap-3.5">
                  <div className="grid size-[52px] flex-none place-items-center font-mono text-[17px] font-bold" style={{ background: a.bg, color: a.fg }}>
                    {initials(g.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`font-display text-[19px] font-bold leading-tight tracking-[-0.01em] ${cancelled ? 'line-through' : ''}`}>{g.name}</p>
                    <p className="mt-0.5 text-sm [overflow-wrap:anywhere]" style={{ color: MUTED }}>{g.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2.5 font-mono text-xs text-[#d8d2ce]">
                      <span>{phoneLabel(g.phone)}</span>
                      <span className="border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] tracking-[0.06em]">{g.code}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5 border-t border-dashed border-white/15 pt-3.5">
                  {g.status === 'checked_in' && (
                    <span className={`${styles.pop} inline-flex items-center gap-2 border px-3 py-2 font-mono text-xs font-bold tracking-[0.04em]`} style={{ background: 'rgba(74,222,128,.14)', borderColor: 'rgba(74,222,128,.5)', color: '#86efac' }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
                      CHECKED IN{g.checkedInAt ? ` · ${formatSceneTime(g.checkedInAt).toUpperCase()}` : ''}
                    </span>
                  )}
                  {g.status === 'confirmed' && (
                    <>
                      <span className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-[0.06em]" style={{ color: RED_TEXT }}>
                        <span className={`${styles.dot} size-2 rounded-full bg-[#ff2d16] shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
                        NOT ARRIVED
                      </span>
                      <button
                        type="button"
                        onClick={() => void checkIn(g)}
                        disabled={busy === g.code}
                        aria-label={`Check in ${g.name}`}
                        className={`${styles.btn} inline-flex min-h-11 items-center gap-2 bg-[linear-gradient(135deg,#ff8a77,#ff5a43)] px-4 font-display text-[15px] font-bold text-[#1a0a08] shadow-[0_8px_18px_-8px_rgba(255,45,22,.7),inset_0_1px_0_rgba(255,255,255,.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70`}
                      >
                        {busy === g.code ? 'Checking in…' : 'Check in'}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
                      </button>
                    </>
                  )}
                  {cancelled && (
                    <span className="inline-flex items-center gap-2 border border-dashed border-white/30 px-3 py-2 font-mono text-xs font-bold tracking-[0.06em]" style={{ color: MUTED }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      CANCELLED
                    </span>
                  )}
                </div>
              </div>
            </li>
          )
        })}
        {visible.length === 0 && (
          <li className="border border-dashed border-white/25 px-4 py-7 text-center font-mono text-xs font-bold tracking-[0.1em]" style={{ color: MUTED }}>
            {guests.length ? 'NO GUESTS MATCH' : 'NO REGISTRATIONS YET'}
          </li>
        )}
      </ul>
    </div>
  )
}
