'use client'

import type { HostGuest, ReminderSend, ReminderTemplate } from '@/lib/client/eventHostApi'
import styles from './EventHostDark.module.css'

/**
 * "Day-before reminder WhatsApp" — the owner's dark design in SCENE fonts:
 * a WhatsApp chat preview of the template for the first guest, the audience,
 * and a send button. Sending always goes through the workspace's confirm
 * dialog (`onRequestSend`); the green fill sweeps while the real request runs.
 */

const CARD_BG = 'linear-gradient(160deg,#211813 0%,#14130d 55%,#170f0c 100%)'
const MUTED = '#b5aeaa'
const RED_TEXT = '#ff8a77'
const TIMING: Record<string, string> = { 'day-before': '1 DAY BEFORE', 'morning-of': 'MORNING OF', directions: 'ANY TIME' }
const AVATARS = [
  { bg: 'linear-gradient(135deg,#86efac,#4ade80)', fg: '#052e16' },
  { bg: 'linear-gradient(135deg,#ff8a77,#ff5a43)', fg: '#1a0a08' },
  { bg: 'linear-gradient(135deg,#f3ead9,#d9cdb4)', fg: '#3a2f2c' },
]

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('')
}

function fill(preview: string, guest: HostGuest | undefined) {
  return preview.replace(/\{name\}/g, guest ? guest.name.split(' ')[0] : 'there').replace(/\{link\}/g, 'scene044.in/t/…').replace(/\{map\}/g, 'maps.app/…')
}

export function EventReminderCard({
  template,
  guests,
  sending,
  sent,
  onRequestSend,
}: {
  template: ReminderTemplate
  guests: HostGuest[]
  sending: boolean
  /** The send made from this card in this session, if any. */
  sent: ReminderSend | null
  onRequestSend: () => void
}) {
  const audience = guests.filter((g) => g.status !== 'cancelled')
  const sample = audience[0]
  const state: 'idle' | 'sending' | 'sent' = sending ? 'sending' : sent ? 'sent' : 'idle'

  return (
    <article className="relative overflow-hidden border border-white/10 p-5 text-white sm:p-6" style={{ background: CARD_BG }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 100% 0%, rgba(255,45,22,.3), rgba(255,45,22,0) 55%)' }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 9px)', WebkitMaskImage: 'linear-gradient(to bottom left, #000, transparent 45%)', maskImage: 'linear-gradient(to bottom left, #000, transparent 45%)' }}
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.16em]">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ff6a55" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" /></svg>
            WHATSAPP TEMPLATE
          </span>
          <span className="inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em]" style={{ background: 'rgba(255,45,22,.18)', borderColor: 'rgba(255,106,85,.5)', color: RED_TEXT }}>
            <span className={`${styles.dot} size-2 rounded-full bg-[#ff2d16] shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
            {TIMING[template.id] ?? 'TEMPLATE'}
          </span>
        </div>

        <h2 className="mt-4 font-display text-[30px] font-black leading-[1.05] tracking-[-0.04em] [text-shadow:0_0_40px_rgba(255,45,22,.4)] sm:text-[36px]">{template.name}</h2>

        {/* WhatsApp chat preview (WhatsApp's own colours, as in the design). */}
        <div className="mt-5 overflow-hidden rounded-[18px] border border-white/10 bg-[#0b141a] font-sans">
          <div className="flex items-center gap-2.5 bg-[#202c33] px-3 py-2.5 text-[#e9edef]">
            <div className="grid size-9 place-items-center rounded-full bg-[#6a7175] text-[13px] font-bold">{sample ? initials(sample.name) : '?'}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold leading-tight">{sample?.name ?? 'Your guests'}</p>
              <p className="text-xs text-[#8696a0]">{sample?.phone ?? ''}</p>
            </div>
          </div>
          <div className="bg-[#0b141a] px-3.5 pb-5 pt-4" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,.05) 1.2px, transparent 1.4px)', backgroundSize: '18px 18px' }}>
            <div className="flex justify-center">
              <span className="rounded-lg bg-[#182229] px-2.5 py-1 text-xs font-medium text-[#8696a0]">PREVIEW</span>
            </div>
            <div className={`${styles.bubble} relative ml-auto mt-3 w-[340px] max-w-[88%] rounded-[10px_0_10px_10px] bg-[#005c4b] px-2.5 pb-1.5 pt-2 shadow-[0_1px_1px_rgba(0,0,0,.3)]`}>
              <p className="pr-1.5 text-[15px] leading-[1.38] text-[#e9edef]">
                {fill(template.preview, sample)} <span className="inline-block w-[62px]" />
              </p>
              <div className="-mt-3.5 flex items-center justify-end gap-1 text-[11px] text-[#e9edef]/65">
                {state === 'idle' && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fb5ac" strokeWidth="2.2" strokeLinecap="round" role="img" aria-label="Not sent yet"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                )}
                {state === 'sending' && (
                  <svg className={styles.tick} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fb5ac" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Sending"><path d="M4 12.5l5 5L20 6.5" /></svg>
                )}
                {state === 'sent' && (
                  <svg className={styles.tick} width="18" height="16" viewBox="0 0 28 24" fill="none" stroke="#53bdeb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Sent"><path d="M2 12.5l5 5L18 6.5M10 16l2 1.5L24 6.5" /></svg>
                )}
              </div>
            </div>
            {state === 'sending' && (
              <div className="mt-2.5 inline-flex items-center rounded-[10px_10px_10px_0] bg-[#202c33] px-3 py-2">
                <div className={styles.typing} aria-hidden="true"><span /><span /><span /></div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 font-mono text-[11px]" style={{ color: MUTED }}>
          Preview for {sample?.name ?? 'your first guest'}. <span className="font-bold text-white">{'{name}'}</span> is filled in for each guest.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex">
              {audience.slice(0, 3).map((g, i) => (
                <span
                  key={g.code}
                  className="grid size-[34px] place-items-center rounded-full border-2 border-[#17100f] font-mono text-[11px] font-bold"
                  style={{ background: AVATARS[i].bg, color: AVATARS[i].fg, marginLeft: i ? -9 : 0 }}
                >
                  {initials(g.name)}
                </span>
              ))}
              {audience.length > 3 && (
                <span className="-ml-[9px] grid size-[34px] place-items-center rounded-full border-2 border-[#17100f] bg-[#2a2423] font-mono text-[11px] font-bold">
                  +{audience.length - 3}
                </span>
              )}
            </div>
            <span className="text-[15px] font-bold">{template.audience} guests</span>
          </div>
          <span className="font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: RED_TEXT }}>
            {template.lastSentAt ? 'SENT BEFORE' : 'NOT SENT YET'}
          </span>
        </div>

        <button
          type="button"
          onClick={onRequestSend}
          disabled={sending || template.available===false || template.audience===0 || Boolean(template.lastSentAt) || Boolean(sent)}
          aria-live="polite"
          className={`${styles.btn} relative mt-4 flex h-[58px] w-full items-center justify-center gap-2.5 overflow-hidden bg-[linear-gradient(135deg,#ff8a77,#ff5a43)] font-display text-[17px] font-bold text-[#1a0a08] shadow-[0_10px_22px_-10px_rgba(255,45,22,.8),inset_0_1px_0_rgba(255,255,255,.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-progress`}
        >
          {sending && <span aria-hidden="true" className={`${styles.sendingFill} absolute inset-0 bg-[linear-gradient(135deg,#86efac,#4ade80)]`} />}
          <svg className="relative" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" /></svg>
          <span className="relative">{sending ? 'Queueing…' : sent || template.lastSentAt ? 'Reminder already queued' : template.available===false ? 'Awaiting setup' : template.audience===0 ? 'No opted-in guests yet' : 'Send on WhatsApp'}</span>
        </button>

        <div className="mt-3 flex min-h-7 items-center justify-center">
          {sent && !sending && (
            <span className={`${styles.banner} inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.08em]`} style={{ background: 'rgba(74,222,128,.14)', borderColor: 'rgba(74,222,128,.5)', color: '#86efac' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
              {sent.pending ? `QUEUED FOR ${sent.pending} GUESTS` : `SENT TO ${sent.sent} GUESTS`}
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
