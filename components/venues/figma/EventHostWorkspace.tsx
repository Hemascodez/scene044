'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Dialog from './Dialog'
import { ArrowLeft, Bell, Check, QrCode, Users, Wallet } from './icons'
import { useVenueApp } from './VenueApp'
import { HostQrScanner } from '../HostQrScanner'
import { EventGuestList } from './EventGuestList'
import { EventReminderCard } from './EventReminderCard'
import {
  EventHostError,
  classifyLoadError,
  guestsCsv,
  httpEventHostApi,
  mockEventHostApi,
  parseTicketQr,
  type EventHostApi,
  type HostEvent,
  type HostGuest,
  type MoneySummary,
  type ReminderSend,
  type ReminderTemplate,
} from '@/lib/client/eventHostApi'
import { formatSceneDate, formatSceneTime, getISTParts } from '@/lib/client/istTime'
import { formatRupees } from '@/lib/hostedEvents'

/**
 * The organiser's event workspace (/host/events), built from the venue host
 * workspace's design (HostWorkspace.tsx): sticky white header, flame-underlined
 * tabs, ink-bordered hard-shadow cards, date-badge rows, the check-in screen
 * and toasts. Tabs: Guests, Check in, Reminders (WhatsApp), Money (Razorpay).
 */

type Tab = 'guests' | 'checkin' | 'reminders' | 'money'
type Load = 'loading' | 'ready' | 'signin' | 'not_approved' | 'error'

const POLL_MS = 15000
const btnInk = 'press flex min-h-11 items-center gap-2 border-[1.5px] border-ink bg-white px-4 py-2.5 font-head text-xs text-ink shadow-hard hover:bg-sand focus-visible:outline-2 focus-visible:outline-flame'
const btnFlame = 'press min-h-11 border-[1.5px] border-ink bg-flame px-5 py-2.5 font-head text-xs text-white shadow-hard-sm hover:brightness-105 disabled:opacity-60'


function maskForList(phone: string) {
  const d = phone.replace(/\D/g, '').slice(-10)
  return d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : phone
}

export default function EventHostWorkspace({ api: apiKind }: { api: 'http' | 'mock' }) {
  const router = useRouter()
  const { profile, requireAuth } = useVenueApp()
  const api: EventHostApi = useMemo(() => (apiKind === 'mock' ? mockEventHostApi() : httpEventHostApi()), [apiKind])

  const [load, setLoad] = useState<Load>('loading')
  const loadRef = useRef<Load>('loading')
  useEffect(() => {
    loadRef.current = load
  }, [load])
  const [loadMessage, setLoadMessage] = useState('')
  const [events, setEvents] = useState<HostEvent[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [guests, setGuests] = useState<HostGuest[]>([])
  const [reminders, setReminders] = useState<{ templates: ReminderTemplate[]; history: ReminderSend[] } | null>(null)
  const [money, setMoney] = useState<MoneySummary | null>(null)
  const [tab, setTab] = useState<Tab>('guests')
  const [toast, setToast] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<ReminderTemplate | null>(null)
  const [sending, setSending] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [sentByTemplate, setSentByTemplate] = useState<Record<string, ReminderSend>>({})
  const [pollError, setPollError] = useState('')
  const [code, setCode] = useState('')
  const [found, setFound] = useState<{ guest: HostGuest | null; code: string } | null>(null)

  const event = events.find((e) => e.id === selectedId) ?? events[0] ?? null

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])

  const fail = useCallback((error: unknown) => {
    const status = error instanceof EventHostError ? error.status : 0
    setLoad(classifyLoadError(status))
    setLoadMessage(error instanceof Error ? error.message : 'Could not load your event.')
  }, [])

  const refresh = useCallback(async () => {
    try {
      const list = await api.listEvents()
      setEvents(list)
      const current = list.find((e) => e.id === selectedId) ?? list[0]
      if (!current) {
        setLoad('not_approved')
        setLoadMessage("This number isn't set up for an event yet.")
        return
      }
      const [g, r] = await Promise.all([api.guests(current.id), api.reminders(current.id)])
      setGuests(g)
      setReminders(r)
      setLoad('ready')
      setPollError('')
      // Money comes from Razorpay and must never block the guest list or check-in.
      api.money(current.id).then(setMoney).catch(() => setMoney(null))
    } catch (error) {
      if (loadRef.current === 'ready') {
        // Keep the last good list on screen (the door must keep working).
        setPollError(error instanceof Error ? error.message : 'Could not refresh.')
      } else {
        fail(error)
      }
    }
  }, [api, selectedId, fail])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of external data, then polled like the venue workspace
    void refresh()
    const id = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  const checkedIn = guests.filter((g) => g.status === 'checked_in').length
  const confirmed = guests.filter((g) => g.status !== 'cancelled').length
  const hour = getISTParts(new Date()).hour
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  async function checkIn(by: { token: string } | { code: string }): Promise<string> {
    if (!event) return 'No event loaded.'
    const result = await api.checkIn(event.id, by)
    void refresh()
    const message = result.alreadyCheckedIn
      ? `${result.guest.name} was already checked in.`
      : `${result.guest.name} checked in.`
    showToast(message)
    return message
  }

  function findByCode(e: FormEvent) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (!c) return
    setFound({ code: c, guest: guests.find((g) => g.code.toUpperCase() === c) ?? null })
  }

  async function confirmArrival(g: HostGuest) {
    try {
      await checkIn({ code: g.code })
      setFound(null)
      setCode('')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not check in this ticket.')
    }
  }

  async function sendReminder() {
    if (!event || !confirming) return
    const template = confirming
    setConfirming(null)
    setSending(true)
    setSendingId(template.id)
    try {
      const sent = await api.sendReminder(event.id, template.id)
      setSentByTemplate((all) => ({ ...all, [template.id]: sent }))
      showToast(`Sent "${sent.templateName}" to ${sent.sent} guests on WhatsApp.`)
      void refresh()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not send this reminder.')
    } finally {
      setSending(false)
      setSendingId(null)
    }
  }

  function downloadCsv() {
    if (!event) return
    const blob = new Blob([guestsCsv(guests)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${event.slug}-guests.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const tabs: { id: Tab; label: string; icon: typeof Users; count?: number }[] = [
    { id: 'guests', label: 'Guests', icon: Users, count: confirmed },
    { id: 'checkin', label: 'Check in', icon: QrCode },
    { id: 'reminders', label: 'Reminders', icon: Bell },
    { id: 'money', label: 'Money', icon: Wallet },
  ]

  return (
    <div className="min-h-screen bg-sand text-ink antialiased">
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 right-6 left-6 z-50 flex items-center gap-2 border-[1.5px] border-ink bg-white px-4 py-3 font-mono-b text-xs text-ink shadow-hard-md anim-pop sm:left-auto">
          <span className="size-2 shrink-0 rounded-full bg-moss" />
          {toast}
        </div>
      )}

      <header className="sticky top-0 z-40 border-b-[1.5px] border-ink bg-white">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="flex h-[72px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3.5">
              {event?.posterImageUrl ? (
                <img src={event.posterImageUrl} alt="" className="size-10 shrink-0 rounded border-[1.5px] border-ink object-cover shadow-hard-sm" />
              ) : (
                <span className="grid size-10 shrink-0 place-items-center rounded border-[1.5px] border-ink bg-paper font-mono-b text-[10px] shadow-hard-sm">044</span>
              )}
              <div className="min-w-0">
                <p className="truncate font-head text-base leading-tight text-ink">{event?.title ?? 'Your event'}</p>
                <p className="font-mono text-[11px] tracking-wide text-stone">Event workspace</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="press flex shrink-0 items-center gap-2 border-[1.5px] border-ink bg-paper px-3.5 py-2 font-mono-b text-xs text-ink shadow-hard-sm hover:bg-sand focus-visible:outline-2 focus-visible:outline-flame"
            >
              <ArrowLeft className="size-3.5" />
              <span>Exit to site</span>
            </button>
          </div>

          {events.length > 1 && (
            <div className="border-t border-line py-2">
              <label htmlFor="event-switcher" className="sr-only">Choose event</label>
              <select
                id="event-switcher"
                value={event?.id ?? ''}
                onChange={(e) => setSelectedId(Number(e.target.value))}
                className="min-h-11 w-full border-[1.5px] border-ink bg-paper px-3 font-head text-sm sm:w-auto"
              >
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.title} · {formatSceneDate(ev.startAt)}</option>
                ))}
              </select>
            </div>
          )}

          <nav aria-label="Event workspace sections" className="relative flex gap-2 overflow-x-auto border-t border-line py-1 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                  tab === t.id ? 'border-flame text-flame' : 'border-transparent text-stone hover:text-ink'
                }`}
              >
                <t.icon className="size-4" />
                <span>{t.label}</span>
                {(t.count ?? 0) > 0 && (
                  <span className={`grid size-5 place-items-center rounded-full font-mono-b text-[10px] text-white ${tab === t.id ? 'bg-flame' : 'bg-stone'}`}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-10">
        {load === 'ready' && pollError && (
          <div role="status" className="mb-6 border-[1.5px] border-flame bg-flame/10 p-3 text-sm text-ink">
            Couldn&apos;t refresh just now ({pollError}). Showing the last loaded list; it retries every 15 seconds.
          </div>
        )}
        {load === 'loading' && <p role="status" className="py-16 text-center font-mono text-xs text-stone">Loading your event…</p>}

        {load === 'signin' && (
          <div className="mx-auto max-w-[480px] border-[1.5px] border-ink bg-white p-6 text-center shadow-hard">
            <h1 className="font-head text-2xl text-ink">Sign in to run your event</h1>
            <p className="mt-2 text-sm text-stone">Use the WhatsApp number SCENE approved for your event.</p>
            <button type="button" onClick={() => requireAuth(() => void refresh())} className={`${btnFlame} mt-5 w-full`}>
              Sign in with WhatsApp
            </button>
          </div>
        )}

        {load === 'not_approved' && (
          <div className="mx-auto max-w-[480px] border-[1.5px] border-ink bg-white p-6 text-center shadow-hard">
            <h1 className="font-head text-2xl text-ink">This number isn&apos;t set up for an event yet</h1>
            <p className="mt-2 text-sm text-stone">
              {profile ? `Signed in as ${profile.phone}. ` : ''}Ask the SCENE team to add this number as a host for your event.
            </p>
            {process.env.NEXT_PUBLIC_WHATSAPP_NUMBER && (
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER.replace(/\D/g, '')}?text=${encodeURIComponent('Hi SCENE, please set my number up as a host for my event.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`${btnInk} mt-5 inline-flex justify-center`}
              >
                Message SCENE on WhatsApp<span className="sr-only"> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}

        {load === 'error' && (
          <div role="alert" className="mb-6 border-2 border-primary-ink p-4 text-primary-ink">
            <p>{loadMessage || 'Could not load your event.'} This is not an empty guest list.</p>
            <button type="button" className="mt-2 min-h-11 underline" onClick={() => void refresh()}>Retry loading</button>
          </div>
        )}

        {load === 'ready' && event && (
          <>
            {tab === 'guests' && (
              <div className="space-y-8 page-in">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-wider text-stone">
                      {greeting}{profile ? `, ${profile.name.split(' ')[0]}` : ''}
                    </p>
                    <h1 className="mt-1 font-head text-2xl text-ink md:text-3xl">Here’s who’s coming</h1>
                    <p className="mt-1 font-mono text-[11px] text-stone">
                      {formatSceneDate(event.startAt)} · {formatSceneTime(event.startAt)} IST · {event.venueName}
                    </p>
                  </div>
                  <button type="button" onClick={() => setTab('checkin')} className={btnInk}>
                    <QrCode className="size-4 text-flame" />
                    <span>Check in a guest</span>
                  </button>
                </div>

                <dl className="grid gap-4 sm:grid-cols-3">
                  <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                    <dt className="font-mono text-xs uppercase text-stone">Registered</dt>
                    <dd className="mt-2 font-head text-3xl text-ink">{confirmed} <span className="text-lg text-stone">/ {event.capacity}</span></dd>
                  </div>
                  <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                    <dt className="font-mono text-xs uppercase text-stone">Checked in</dt>
                    <dd className="mt-2 font-head text-3xl text-flame">{checkedIn}</dd>
                  </div>
                  <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                    <dt className="font-mono text-xs uppercase text-stone">Collected</dt>
                    <dd className="mt-2 font-head text-3xl text-moss">{money ? formatRupees(money.grossPaise) : '—'}</dd>
                    <p className="mt-1 font-mono text-[11px] text-stone">Before Razorpay fees · see Money</p>
                  </div>
                </dl>

                <section aria-labelledby="guest-list-heading">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
                    <h2 id="guest-list-heading" className="font-head text-xl text-ink">Guest list</h2>
                    <button type="button" onClick={downloadCsv} className="min-h-11 font-mono-b text-xs uppercase text-ink underline underline-offset-4 hover:text-flame">
                      Download CSV ({guests.length})
                    </button>
                  </div>
                  <div className="mt-4">
                    <EventGuestList
                      guests={guests}
                      onCheckIn={async (g) => {
                        try {
                          await checkIn({ code: g.code })
                        } catch (error) {
                          showToast(error instanceof Error ? error.message : 'Could not check in this ticket.')
                        }
                      }}
                    />
                  </div>
                </section>
              </div>
            )}

            {tab === 'checkin' && (
              <div className="mx-auto max-w-[560px] space-y-6 page-in">
                <div className="text-center">
                  <h1 className="font-head text-2xl text-ink md:text-3xl">Check in a guest</h1>
                  <p className="mt-1 font-mono text-xs text-stone">Scan the reader’s ticket QR, or enter their ticket code.</p>
                  <p className="mt-3 font-head text-lg text-ink">
                    <span className="text-flame">{checkedIn}</span> of {confirmed} checked in
                  </p>
                </div>

                <HostQrScanner
                  label="Scan ticket QR"
                  onRefresh={() => void refresh()}
                  onToken={async (text) => {
                    const token = parseTicketQr(text, window.location.hostname)
                    if (!token) return 'That is not a SCENE/044 ticket QR. Point at the reader’s ticket.'
                    return checkIn({ token })
                  }}
                />

                <form onSubmit={findByCode} className="space-y-3 border-[1.5px] border-ink bg-white p-6 shadow-hard">
                  <label htmlFor="ticket-code" className="block font-mono-b text-xs uppercase text-stone">Or enter ticket code</label>
                  <div className="flex gap-2">
                    <input
                      id="ticket-code"
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. SCN-READ-0104"
                      className="min-w-0 flex-1 border-[1.5px] border-ink bg-paper px-3.5 py-2.5 font-mono-b text-base uppercase tracking-wider text-ink focus:outline-none focus:ring-2 focus:ring-flame"
                    />
                    <button type="submit" className={btnFlame}>Find</button>
                  </div>
                  <p className="font-mono text-[11px] text-stone">Codes start with SCN- and are on the reader’s ticket.</p>

                  {found && (
                    <div className={`mt-4 rounded border-[1.5px] p-4 font-mono text-xs anim-pop ${found.guest ? 'border-moss bg-moss/10' : 'border-ink bg-paper'}`}>
                      {found.guest ? (
                        <div className="space-y-1">
                          <p className="flex items-center gap-1.5 font-head text-sm text-moss">
                            <Check className="size-4" strokeWidth={2.5} /> Ticket found
                          </p>
                          <p className="font-body-m text-ink">{found.guest.name}</p>
                          <p className="text-stone">{found.guest.code} · {maskForList(found.guest.phone)}</p>
                          {found.guest.status === 'confirmed' && (
                            <button
                              type="button"
                              onClick={() => found.guest && void confirmArrival(found.guest)}
                              className="press mt-3 min-h-11 w-full border border-moss bg-moss py-2 font-head text-xs uppercase text-white shadow-hard-sm"
                            >
                              Confirm arrival
                            </button>
                          )}
                          {found.guest.status === 'checked_in' && <p className="pt-2 text-ink">Already checked in{found.guest.checkedInAt ? ` at ${formatSceneTime(found.guest.checkedInAt)}` : ''}.</p>}
                          {found.guest.status === 'cancelled' && <p className="pt-2 text-flame">This ticket was cancelled.</p>}
                        </div>
                      ) : (
                        <p className="text-stone">No ticket found matching code {found.code}.</p>
                      )}
                    </div>
                  )}
                </form>
              </div>
            )}

            {tab === 'reminders' && reminders && (
              <div className="space-y-8 page-in">
                <div>
                  <h1 className="font-head text-2xl text-ink md:text-3xl">WhatsApp reminders</h1>
                  <p className="mt-1 text-sm text-stone">Sent from SCENE’s WhatsApp number to every confirmed reader. Nothing goes out until you confirm.</p>
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  {reminders.templates.map((t) => (
                    <EventReminderCard
                      key={t.id}
                      template={t}
                      guests={guests}
                      sending={sendingId === t.id}
                      sent={sentByTemplate[t.id] ?? null}
                      onRequestSend={() => setConfirming(t)}
                    />
                  ))}
                </div>

                <section aria-labelledby="sent-heading">
                  <h2 id="sent-heading" className="border-b border-line pb-3 font-head text-xl text-ink">Sent</h2>
                  {reminders.history.length === 0 ? (
                    <p className="mt-4 text-sm text-stone">No reminders sent yet.</p>
                  ) : (
                    <ul className="mt-4 space-y-3">
                      {reminders.history.map((h) => (
                        <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-ink bg-white p-4 shadow-hard-sm">
                          <div>
                            <p className="font-head text-sm text-ink">{h.templateName}</p>
                            <p className="font-mono text-xs text-stone">{formatSceneDate(h.sentAt)} · {formatSceneTime(h.sentAt)}</p>
                          </div>
                          <p className="font-mono-b text-[11px] uppercase">
                            <span className="text-ink">{h.sent} sent</span> · <span className="text-moss">{h.delivered} delivered</span>
                            {h.failed > 0 && <> · <span className="text-flame">{h.failed} failed</span></>}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {tab === 'money' && money && (
              <div className="space-y-8 page-in">
                <div>
                  <h1 className="font-head text-2xl text-ink md:text-3xl">Money</h1>
                  <p className="mt-1 text-sm text-stone">From Razorpay. {money.settlement}</p>
                </div>
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {([
                    ['Collected', formatRupees(money.grossPaise), 'text-ink'],
                    ['Razorpay fees', formatRupees(money.feesPaise), 'text-stone'],
                    ['Net to you', formatRupees(money.netPaise), 'text-moss'],
                    ['Payments', String(money.paymentsCount), 'text-ink'],
                  ] as const).map(([label, value, tone]) => (
                    <div key={label} className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                      <dt className="font-mono text-xs uppercase text-stone">{label}</dt>
                      <dd className={`mt-2 font-head text-3xl ${tone}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <section aria-labelledby="payments-heading">
                  <h2 id="payments-heading" className="border-b border-line pb-3 font-head text-xl text-ink">Payments</h2>
                  <ul className="mt-4 space-y-3">
                    {money.payments.map((p) => (
                      <li key={p.paymentId} className="flex flex-wrap items-center justify-between gap-3 border-[1.5px] border-ink bg-white p-4 shadow-hard-sm">
                        <div className="min-w-0">
                          <p className="font-head text-sm text-ink">{p.guest}</p>
                          <p className="font-mono text-xs text-stone">{formatSceneDate(p.at)} · {formatSceneTime(p.at)} · {p.paymentId}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-head text-sm text-ink">{formatRupees(p.amountPaise)}</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-b text-[11px] ${
                            p.status === 'captured' ? 'border border-moss/40 bg-moss/10 text-moss' : 'border border-flame/40 bg-flame/10 text-flame'
                          }`}>
                            {p.status === 'captured' ? 'Captured' : p.status === 'failed' ? 'Failed' : 'Refunded'}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </>
        )}
      </main>

      {confirming && (
        <Dialog
          size="sm"
          title={`Send to ${confirming.audience} guests on WhatsApp?`}
          description={`"${confirming.name}" goes to every confirmed reader for ${event?.title ?? 'this event'}. This can't be undone.`}
          onClose={() => !sending && setConfirming(null)}
        >
          <p className="border-[1.5px] border-line bg-paper p-3 font-mono text-xs leading-5 text-ink">{confirming.preview}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" data-autofocus onClick={() => setConfirming(null)} disabled={sending} className={btnInk}>Cancel</button>
            <button type="button" onClick={() => void sendReminder()} disabled={sending} className={btnFlame}>
              {sending ? 'Sending…' : `Send to ${confirming.audience}`}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

