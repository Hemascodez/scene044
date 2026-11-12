'use client'

import { formatSceneDate, formatSceneTime } from '@/lib/client/istTime'
import { eventTicketHref, type MyEventTicket } from '@/lib/client/myEventTickets'

/**
 * A hosted-event ticket in My bookings, built from MyBookings' BookingCard
 * markup (same border, shadow, photo frame, mono kicker, meta row and status
 * dot) so it sits naturally between venue bookings. No pay / withdraw /
 * review: the ticket is paid, and its QR lives on the event page.
 */

const mono = 'font-mono-b text-[10px] leading-[15px] tracking-[0.6px] uppercase'
const card = 'border-[1.5px] border-ink bg-white shadow-hard'
const pinIcon = '/venues/figma/profile-58648.svg'
const calIcon = '/venues/figma/profile-135c7.svg'
const clockIcon = '/venues/figma/profile-95c70.svg'
const qrIcon = '/venues/figma/profile-c8938.svg'

const STATUS: Record<MyEventTicket['ticket']['status'], { label: string; color: string }> = {
  confirmed: { label: 'Ticket confirmed', color: 'text-moss bg-moss' },
  cancelled: { label: 'Cancelled', color: 'text-stone bg-stone' },
}

function Meta({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <img src={icon} alt="" width={12} height={12} className="size-3 shrink-0" />
      <span className="font-mono text-[10px] leading-[15px] tracking-[0.4px] text-stone uppercase">{children}</span>
    </li>
  )
}

export function EventTicketCard({ t, i, past = false }: { t: MyEventTicket; i: number; past?: boolean }) {
  const s = STATUS[t.ticket.status]
  const muted = t.ticket.status === 'cancelled'
  const when = `${formatSceneTime(t.startAt)}${t.endAt ? ` – ${formatSceneTime(t.endAt)}` : ''} IST`

  return (
    <li id={`ticket-${t.ticket.code}`} tabIndex={-1} className={`${card} rise scroll-mt-24 focus:outline-none`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
      <article aria-label={`${t.title}, ${s.label}`} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className={`h-40 shrink-0 overflow-hidden border-[1.5px] border-ink bg-sand shadow-[2px_2px_0_0_#111] sm:h-[164px] sm:w-40 ${muted ? 'grayscale' : ''}`}>
          {t.posterImageUrl ? (
            <img src={t.posterImageUrl} alt={`Poster for ${t.title}`} className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center font-mono-b text-xs text-stone">SCENE</div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`${mono} text-flame`}>Event ticket</p>
              <h3 className="pt-1 font-head text-lg leading-[22.5px] text-ink">{t.title}</h3>
            </div>
            <p className={`flex shrink-0 items-center gap-1.5 ${mono} ${s.color.split(' ')[0]}`}>
              <span aria-hidden="true" className={`size-1.5 ${s.color.split(' ')[1]}`} />
              {past && !muted ? 'Attended' : s.label}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-3">
            {t.venueName && <Meta icon={pinIcon}>{t.venueName}</Meta>}
            <Meta icon={calIcon}>{formatSceneDate(t.startAt)}</Meta>
            <Meta icon={clockIcon}>{when}</Meta>
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="font-body-m text-sm leading-5 text-ink">
              {muted ? 'This ticket was cancelled.' : past ? 'Thanks for coming.' : 'Show the QR at the door'}
              <span className="ml-2 font-mono text-xs text-stone">{t.ticket.code}</span>
            </p>
            {!muted && !past && (
              <a
                href={eventTicketHref(t)}
                className={`press flex min-h-10 items-center gap-2 border-[1.5px] border-ink bg-ink px-4 ${mono} text-white shadow-hard-sm`}
              >
                <img src={qrIcon} alt="" width={14} height={14} className="size-3.5 invert" /> View ticket
              </a>
            )}
          </div>
        </div>
      </article>
    </li>
  )
}
