"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { checkInBooking, listHostBookings, listHostReviews, setHostBookingStatus, type HostBooking } from '@/lib/client/hostApi'
import type { VenueReview } from '@/lib/venueBookings'
import { chandruReviews } from '@/lib/venueTestimonials'
import { HostQrScanner } from '../HostQrScanner'
import { HostBookingSession } from '../HostBookingSession'
import { HostMenuPanel } from '../HostMenuPanel'
import { createManualVenueBlock, readManualVenueBlocks, type ManualVenueBlock } from '@/lib/client/venueBookingStore'
import { getISTParts } from '@/lib/client/istTime'
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  CalendarIcon,
  Check,
  Clock,
  Close,
  Link2,
  MapPin,
  Phone,
  Plus,
  QrCode,
  TrendingUp,
  Users,
  Wallet,
} from './icons'
const exterior = '/venues/figma/1f1a5.jpg'
const quoteIcon = '/venues/figma/profile-971d5.svg'
import HostReviews from './HostReviews'
import ProfileCard from './ProfileCard'
import ReviewFlow from './ReviewFlow'
import type { Profile } from './AuthModal'

const VENUE_PATH = '/venues/time-cafe'

const copyText = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

function ShareVenueEmpty() {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const share = async () => {
    const ok = await copyText(`${window.location.origin}${VENUE_PATH}`)
    if (!ok) return
    setCopied(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section
      aria-labelledby="host-empty-title"
      className="anim-pop flex flex-col items-center gap-3 rounded-xl border-2 border-[#141414] bg-white px-6 py-12 text-center shadow-hard sm:p-[66px]"
    >
      <div aria-hidden="true" className="grid size-[88px] shrink-0 place-items-center rounded-full border-2 border-[#141414] bg-[#faf7f0]">
        <img src={quoteIcon} alt="" width={38} height={38} className="size-[38px]" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <h3 id="host-empty-title" className="font-p-display text-2xl leading-9 tracking-[-0.75px] text-balance text-[#141414] sm:text-[26px]">
          No bookings yet.
        </h3>
        <p className="max-w-[448px] text-sm leading-[22.75px] text-balance text-[#706e6b]">
          Share your venue link with organisers. Their booking requests will show up here for you to review.
        </p>
      </div>
      <div className="relative mt-1">
        <span
          role="status"
          aria-live="polite"
          className={`pointer-events-none absolute bottom-full left-1/2 mb-3 -translate-x-1/2 whitespace-nowrap rounded-md border-2 border-[#111] bg-[#141414] px-3 py-1.5 font-mono-b text-[11px] leading-4 tracking-[0.6px] text-white uppercase transition-all duration-200 motion-reduce:transition-none ${
            copied ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
          }`}
        >
          {copied ? 'Link copied' : ''}
          <span aria-hidden="true" className="absolute left-1/2 top-full size-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b-2 border-r-2 border-[#111] bg-[#141414]" />
        </span>
        <button
          type="button"
          onClick={share}
          className="press inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border-2 border-[#111] bg-[#eb442c] px-6 py-3.5 font-mono-b text-xs leading-4 tracking-[0.6px] text-white uppercase shadow-hard"
        >
          <Link2 className="size-4" /> Share venue
        </button>
      </div>
    </section>
  )
}

const LOGO_KEY = 'scene044.hostLogo'
const loadLogo = () => {
  try {
    return localStorage.getItem(LOGO_KEY) || null
  } catch {
    return null
  }
}

export type HostTab = 'bookings' | 'calendar' | 'checkin' | 'orders' | 'payouts' | 'reviewsForYou' | 'yourReviews' | 'profile'

export type HostRequest = {
  id: string
  code: string
  title: string
  organiser: string
  orgGroup: string
  date: string
  time: string
  duration: string
  guests: number
  space: string
  eventPlan: string
  requestedSetup: string
  linkedin: string
  phone: string
  organiserPays: number
  sceneFee: number
  payout: number
  status: 'new' | 'approved' | 'declined'
  declineReason?: string
  declineNote?: string
}

type ConfirmedItem = {
  id: string
  timeBadgeTop: string
  timeBadgeBottom: string
  title: string
  organiser: string
  space: string
  guests: number
  code: string
  status: 'Paid' | 'Awaiting payment'
}

/** The host's payout is 90% of the space cost; SCENE's host-side fee is the other 10%. */
const HOST_FEE_RATE = 0.1

const dayLabel = (date: string) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }).replace(/^(\w+) /, '$1, ')

function toRequest(b: HostBooking): HostRequest {
  const value = b.trialAmountPaise ? 0 : b.total ?? 0
  let group = ''
  try {
    group = b.trustUrl ? new URL(b.trustUrl).hostname.replace(/^www\./, '') : ''
  } catch {
    group = b.trustType ?? ''
  }
  return {
    id: String(b.id),
    code: b.code,
    title: b.eventType,
    organiser: b.organizerName,
    orgGroup: group,
    date: dayLabel(b.eventDate),
    time: b.startTime,
    duration: b.trialDurationMinutes ? '5-minute live trial' : `${b.durationHours} ${b.durationHours === 1 ? 'hour' : 'hours'}`,
    guests: b.people,
    space: b.spaceName,
    eventPlan: b.description,
    requestedSetup: '',
    linkedin: b.trustUrl ?? '',
    phone: b.organizerPhone,
    organiserPays: b.trialAmountPaise ? b.trialAmountPaise / 100 : value,
    sceneFee: Math.round(value * HOST_FEE_RATE),
    payout: Math.round(value * (1 - HOST_FEE_RATE)),
    status: 'new',
  }
}

function toConfirmed(b: HostBooking, todayIso: string): ConfirmedItem {
  return {
    id: String(b.id),
    timeBadgeTop: b.eventDate === todayIso ? 'Today' : `${dayLabel(b.eventDate).split(',')[0]},`,
    timeBadgeBottom: b.startTime,
    title: b.eventType,
    organiser: b.organizerName,
    space: b.spaceName,
    guests: b.people,
    code: b.code,
    status: b.status === 'approved' ? 'Awaiting payment' : 'Paid',
  }
}

const isoDay = (d: Date) => {
  const { year, month, day } = getISTParts(d)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const DECLINE_REASONS = [
  'Date already occupied',
  'Capacity mismatch',
  'Need more info',
  'Not the right fit this time',
  'Not suitable for this space',
  'Other',
]

export default function HostWorkspace({
  hostName = 'Time Cafe',
  profile,
  onSaveProfile,
  onAuth,
  onExit,
  onLogout,
}: {
  hostName?: string
  profile?: Profile | null
  onSaveProfile?: (p: Profile) => Promise<void>
  onAuth?: () => void
  onExit: () => void
  onLogout?: () => void
}) {
  // Loaded after mount so the server render and the first client render agree.
  const [logo, setLogo] = useState<string | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage after mount
    setLogo(loadLogo())
  }, [])
  const [reviewingOrganiser, setReviewingOrganiser] = useState<{ name: string; event: string } | null>(null)
  const saveLogo = (src: string | null) => {
    setLogo(src)
    try {
      localStorage.setItem(LOGO_KEY, src ?? '')
    } catch {
      /* storage full — keep in memory only */
    }
  }
  const [activeTab, setActiveTab] = useState<HostTab>('bookings')
  const [orderBookingId, setOrderBookingId] = useState('')
  // Live data: the host's real bookings (polled) and their manual calendar blocks.
  const [hostBookings, setHostBookings] = useState<HostBooking[]>([])
  const [receivedReviews, setReceivedReviews] = useState<VenueReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [reviewsError, setReviewsError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [blocks, setBlocks] = useState<ManualVenueBlock[]>([])
  const refresh = useCallback(() => {
    listHostBookings()
      .then((d) => { setHostBookings(d.bookings); setLoadError('') })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Could not load bookings.'))
    listHostReviews()
      .then(d => { setReceivedReviews(d.reviews); setReviewsError('') })
      .catch(error => setReviewsError(error instanceof Error ? error.message : 'Could not load reviews.'))
      .finally(() => setReviewsLoading(false))
    setBlocks(readManualVenueBlocks())
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of external data (host API + localStorage), then polled
    refresh()
    const id = window.setInterval(refresh, 15000)
    return () => window.clearInterval(id)
  }, [refresh])
  const todayIso = isoDay(new Date())
  const requests = useMemo(() => hostBookings.filter((b) => b.status === 'requested').map(toRequest), [hostBookings])
  const confirmedList = useMemo(
    () =>
      hostBookings
        .filter((b) => ['approved', 'confirmed', 'checked_in'].includes(b.status) && b.eventDate >= todayIso)
        .sort((a, b) => (a.eventDate + a.startTime).localeCompare(b.eventDate + b.startTime))
        .map((b) => toConfirmed(b, todayIso)),
    [hostBookings, todayIso],
  )
  const [decliningReqId, setDecliningReqId] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>(DECLINE_REASONS[0])
  const [declineNote, setDeclineNote] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Calendar State
  const [calWeekOffset, setCalWeekOffset] = useState(0)
  const [blockTimeModal, setBlockTimeModal] = useState(false)
  const [blockDate, setBlockDate] = useState(() => isoDay(new Date()))
  const [blockTitle, setBlockTitle] = useState('Private event')
  const [blockSpace, setBlockSpace] = useState('First-floor event space')


  // Check-in State
  const [checkInCode, setCheckInCode] = useState('')
  const [checkInResult, setCheckInResult] = useState<{
    status: 'success' | 'unpaid' | 'not-found'
    title?: string
    guest?: string
    space?: string
    code?: string
  } | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const activeNewRequests = requests.filter((r) => r.status === 'new')
  const hour = getISTParts(new Date()).hour
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  /** The visible calendar week (Sunday-first, like the design), shifted by the arrows. */
  const weekDays = useMemo(() => {
    const now = new Date(`${todayIso}T12:00:00+05:30`)
    const start = new Date(now)
    start.setDate(now.getDate() - 6 + calWeekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const iso = isoDay(d)
      const booking = hostBookings
        .filter((b) => b.eventDate === iso && ['requested', 'approved', 'confirmed', 'checked_in', 'completed'].includes(b.status))
        .sort((x, y) => x.startTime.localeCompare(y.startTime))[0]
      const block = blocks.find((x) => x.date === iso)
      const base = {
        iso,
        dayName: d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'Asia/Kolkata' }),
        dayNum: Number(iso.slice(8, 10)),
      }
      if (block) return { ...base, event: block.note || 'Blocked', sub: block.spaceName, type: 'blocked' as const }
      if (booking)
        return booking.status === 'requested'
          ? { ...base, event: `Awaiting decision · ${booking.startTime}`, sub: `${booking.eventType} · ${booking.people}p`, type: 'awaiting' as const }
          : { ...base, event: `${booking.eventType} · ${booking.startTime}`, sub: `${booking.spaceName} · ${booking.organizerName.split(' ')[0]}`, type: 'confirmed' as const }
      return { ...base, event: undefined as string | undefined, sub: undefined as string | undefined, type: undefined }
    })
  }, [todayIso, calWeekOffset, hostBookings, blocks])
  const fmtDay = (iso: string, withYear = false) =>
    new Date(`${iso}T12:00:00+05:30`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'Asia/Kolkata' })
  const weekLabel = `${fmtDay(weekDays[0].iso)} – ${fmtDay(weekDays[6].iso, true)}`

  // Payouts & demand, counted from real bookings — never estimated.
  const monthKey = todayIso.slice(0, 7)
  const monthLabel = new Date(`${todayIso}T12:00:00+05:30`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
  const paidThisMonth = hostBookings.filter((b) => !b.trialAmountPaise && ['confirmed', 'checked_in', 'completed'].includes(b.status) && b.eventDate.startsWith(monthKey))
  const monthValue = paidThisMonth.reduce((n, b) => n + (b.total ?? 0), 0)
  const monthFee = Math.round(monthValue * HOST_FEE_RATE)
  const spaceDemand = (() => {
    const counts = new Map<string, number>()
    for (const b of hostBookings) counts.set(b.spaceName, (counts.get(b.spaceName) ?? 0) + 1)
    const rows = [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4)
    const max = Math.max(1, ...rows.map(([, c]) => c))
    return rows.map(([name, count]) => ({ name, count, pct: Math.round((count / max) * 100) }))
  })()
  const slotDemand = (() => {
    const buckets = [
      { slot: 'Weekday 6–9 PM', test: (wd: number, h: number) => wd >= 1 && wd <= 5 && h >= 18 && h < 21 },
      { slot: 'Saturday evening 5–9 PM', test: (wd: number, h: number) => wd === 6 && h >= 17 && h < 21 },
      { slot: 'Sunday brunch 10 AM–2 PM', test: (wd: number, h: number) => wd === 0 && h >= 10 && h < 14 },
      { slot: 'Weekday afternoon 2–5 PM', test: (wd: number, h: number) => wd >= 1 && wd <= 5 && h >= 14 && h < 17 },
    ]
    const rows = buckets.map(({ slot, test }) => ({
      slot,
      count: hostBookings.filter((b) => test(new Date(`${b.eventDate}T12:00:00+05:30`).getDay(), Number(b.startTime.slice(0, 2)))).length,
    }))
    const max = Math.max(1, ...rows.map((r) => r.count))
    return rows.map((r) => ({ ...r, pct: Math.round((r.count / max) * 100) }))
  })()
  const nextEvent = confirmedList[0]

  /** Payout the host can expect from everything pending or upcoming. */
  const upcomingPayout =
    activeNewRequests.reduce((acc, r) => acc + r.payout, 0) +
    hostBookings
      .filter((b) => !b.trialAmountPaise && ['approved', 'confirmed', 'checked_in'].includes(b.status) && b.eventDate >= todayIso)
      .reduce((acc, b) => acc + Math.round((b.total ?? 0) * (1 - HOST_FEE_RATE)), 0)

  const handleApprove = async (reqId: string) => {
    const req = requests.find((r) => r.id === reqId)
    if (!req) return
    try {
      await setHostBookingStatus(Number(reqId), 'approved')
      showToast(`Approved ${req.code}! Held for 24h for payment.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not approve right now.')
    }
    refresh()
  }

  const handleDeclineConfirm = async () => {
    if (!decliningReqId) return
    const req = requests.find((r) => r.id === decliningReqId)
    setDecliningReqId(null)
    setDeclineNote('')
    try {
      await setHostBookingStatus(Number(decliningReqId), 'declined')
      showToast(`Request ${req?.code ?? ''} declined. The organiser sees it in their bookings.`)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not decline right now.')
    }
    refresh()
  }

  const handleBlockTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createManualVenueBlock({ date: blockDate, from: '00:00', to: '23:59', spaceName: blockSpace, note: blockTitle })
    setBlockTimeModal(false)
    refresh()
    showToast(`Time slot blocked on ${dayLabel(blockDate)}: ${blockTitle}`)
  }

  const handleCheckInSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = checkInCode.trim().toUpperCase()
    const b = hostBookings.find((x) => x.code.toUpperCase() === query)
    if (!b || ['declined', 'cancelled', 'expired'].includes(b.status)) {
      setCheckInResult({ status: 'not-found', code: query })
      return
    }
    const detail = { title: b.eventType, guest: `${b.organizerName} · ${b.people} guests`, space: b.spaceName, code: b.code }
    if (['confirmed', 'checked_in', 'completed'].includes(b.status)) setCheckInResult({ status: 'success', ...detail })
    else setCheckInResult({ status: 'unpaid', ...detail })
  }

  const confirmArrival = async (code: string) => {
    try {
      const { booking } = await checkInBooking({ code })
      showToast(booking.status === 'checked_in' ? `${code}: timer is running.` : `${code}: ${booking.status}.`)
      setCheckInResult(null)
      refresh()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not check in this booking.')
    }
  }

  return (
    <div className="min-h-screen bg-sand text-ink antialiased">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 border-[1.5px] border-ink bg-white px-4 py-3 font-mono-b text-xs text-ink shadow-hard-md anim-pop"
        >
          <span className="size-2 rounded-full bg-moss" />
          {toastMessage}
        </div>
      )}

      {/* Top Workspace Header */}
      <header className="border-b-[1.5px] border-ink bg-white sticky top-0 z-40">
        <div className="mx-auto max-w-[1280px] px-4 md:px-8">
          <div className="flex h-[72px] items-center justify-between">
            <div className="flex items-center gap-3.5">
              <img
                src={exterior}
                alt="Time Cafe storefront"
                className="size-10 rounded border-[1.5px] border-ink object-cover shadow-hard-sm"
              />
              <div>
                <p className="font-head text-base leading-tight text-ink">Time Cafe</p>
                <p className="font-mono text-[11px] text-stone tracking-wide">Bookings workspace</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onExit}
              className="press flex items-center gap-2 border-[1.5px] border-ink bg-paper px-3.5 py-2 font-mono-b text-xs text-ink shadow-hard-sm hover:bg-sand focus-visible:outline-2 focus-visible:outline-flame"
            >
              <ArrowLeft className="size-3.5" />
              <span>Exit to site</span>
            </button>
          </div>

          {/* Navigation - Host workspace sections */}
          <nav
            aria-label="Host workspace sections"
            className="relative flex gap-2 overflow-x-auto border-t border-line py-1 scrollbar-none"
          >
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              aria-current={activeTab === 'bookings' ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                activeTab === 'bookings'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-stone hover:text-ink'
              }`}
            >
              <Bell className="size-4" />
              <span>Bookings</span>
              {activeNewRequests.length > 0 && (
                <span className="grid size-5 place-items-center rounded-full border border-flame/30 bg-flame text-white font-mono-b text-[10px]">
                  {activeNewRequests.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              aria-current={activeTab === 'calendar' ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                activeTab === 'calendar'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-stone hover:text-ink'
              }`}
            >
              <CalendarIcon className="size-4" />
              <span>Calendar</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('checkin')}
              aria-current={activeTab === 'checkin' ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                activeTab === 'checkin'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-stone hover:text-ink'
              }`}
            >
              <QrCode className="size-4" />
              <span>Check in</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('payouts')}
              aria-current={activeTab === 'payouts' ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                activeTab === 'payouts'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-stone hover:text-ink'
              }`}
            >
              <Wallet className="size-4" />
              <span>Payouts</span>
            </button>
          {([
              { id: 'orders', label: 'Sessions & orders', icon: null, count: 0 },
              { id: 'reviewsForYou', label: 'Reviews for you', icon: '/venues/figma/reviews-72dc5.png', count: reviewsError ? undefined : Math.max(1, chandruReviews(receivedReviews).length) },
              { id: 'yourReviews', label: 'Your reviews', icon: '/venues/figma/reviews-1c6e7.png', count: 0 },
              { id: 'profile', label: 'Profile', icon: null, count: 0 },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={activeTab === t.id ? 'page' : undefined}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                  activeTab === t.id
                    ? 'border-flame text-flame'
                    : 'border-transparent text-stone hover:text-ink'
                }`}
              >
                {t.id !== 'yourReviews' && (t.icon ? <img src={t.icon} alt="" className="size-4" /> : <Users className="size-4" />)}
                <span>{t.label}</span>
                {(t.count ?? 0) > 0 && <span
                  className={`grid size-5 place-items-center rounded-full font-mono-b text-[10px] text-white ${
                    activeTab === t.id ? 'bg-flame' : 'bg-stone'
                  }`}
                >
                  {t.count}
                  <span className="sr-only"> new</span>
                </span>}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="mx-auto max-w-[1280px] px-4 py-8 md:px-8 md:py-10">
        {loadError && <div role="alert" className="mb-6 border-2 border-primary-ink p-4 text-primary-ink">
          <p>{loadError} Bookings could not be refreshed; this is not an empty-bookings result.</p>
          <button type="button" className="mt-2 min-h-11 underline" onClick={refresh}>Retry loading bookings</button>
        </div>}
        {/* ================= TAB 1: BOOKINGS ================= */}
        {activeTab === 'bookings' && (
          <div className="space-y-8 page-in">
            {/* Header section */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-stone tracking-wider uppercase">
                  {greeting}, {hostName}
                </p>
                <h1 className="mt-1 font-head text-2xl md:text-3xl text-ink">
                  Here’s what needs you today
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('checkin')}
                className="press flex items-center gap-2 border-[1.5px] border-ink bg-white px-4 py-2.5 font-head text-xs text-ink shadow-hard hover:bg-sand focus-visible:outline-2 focus-visible:outline-flame"
              >
                <QrCode className="size-4 text-flame" />
                <span>Check in a guest</span>
              </button>
            </div>

            {/* Metrics cards */}
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">Needs your response</dt>
                <dd className="mt-2 font-head text-3xl text-flame">{activeNewRequests.length}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">Upcoming confirmed</dt>
                <dd className="mt-2 font-head text-3xl text-ink">{confirmedList.length}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">Estimated payout</dt>
                <dd className="mt-2 font-head text-3xl text-moss">
                  ₹{upcomingPayout.toLocaleString('en-IN')}
                </dd>
              </div>
            </dl>

            {/* Section: New Requests */}
            <section aria-labelledby="new-requests-heading">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 id="new-requests-heading" className="font-head text-xl text-ink">
                  New requests
                </h2>
                <span className="font-mono text-xs text-stone flex items-center gap-1.5">
                  <Clock className="size-3.5 text-flame" />
                  Respond within 48 hours
                </span>
              </div>

              {activeNewRequests.length === 0 ? (
                confirmedList.length === 0 ? (
                  <div className="mt-6">
                    <ShareVenueEmpty />
                  </div>
                ) : (
                  <div className="mt-6 rounded border border-dashed border-ink/30 bg-white/70 p-8 text-center">
                    <Check className="mx-auto size-8 text-moss" />
                    <p className="mt-2 font-head text-base text-ink">All caught up!</p>
                    <p className="text-xs text-stone mt-1">No pending guest requests requiring review.</p>
                  </div>
                )
              ) : (
                <div className="mt-6 space-y-6">
                  {activeNewRequests.map((req) => (
                    <article
                      key={req.id}
                      className="border-[1.5px] border-ink bg-white shadow-hard transition-all duration-200 hover:shadow-hard-lg"
                    >
                      {/* Request Header bar */}
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line p-5 bg-paper">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-flame/10 border border-flame/30 px-2 py-0.5 font-mono-b text-[10px] text-flame uppercase">
                              New request
                            </span>
                            <span className="font-mono-b text-xs text-stone tracking-wider">{req.code}</span>
                          </div>
                          <h3 className="mt-2 font-head text-xl text-ink">{req.title}</h3>
                          <p className="text-xs text-stone mt-0.5">
                            {req.organiser} · <span className="text-ink font-body-m">{req.orgGroup}</span>
                          </p>
                        </div>

                        <ul className="space-y-1.5 text-xs text-right font-mono" aria-label="Event meta">
                          <li className="flex items-center justify-end gap-1.5 text-ink">
                            <CalendarIcon className="size-3.5 text-flame" />
                            <span>{req.date}</span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-stone">
                            <Clock className="size-3.5 text-ink" />
                            <span>
                              {req.time} · {req.duration}
                            </span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-stone">
                            <Users className="size-3.5 text-ink" />
                            <span>{req.guests} people</span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-stone">
                            <MapPin className="size-3.5 text-ink" />
                            <span>{req.space}</span>
                          </li>
                        </ul>
                      </div>

                      {/* Request Body Details */}
                      <div className="p-5 space-y-4 border-b border-line text-sm">
                        <div>
                          <h4 className="font-mono-b text-xs uppercase text-stone tracking-wider">Event plan</h4>
                          <p className="mt-1 text-ink leading-relaxed">{req.eventPlan}</p>
                        </div>
                        {req.requestedSetup && (
                          <div>
                            <h4 className="font-mono-b text-xs uppercase text-stone tracking-wider">Requested setup</h4>
                            <p className="mt-1 text-ink leading-relaxed">{req.requestedSetup}</p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-stone">
                          {req.linkedin && (
                            <a href={req.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-flame underline">
                              <Link2 className="size-3.5" />
                              {req.orgGroup || 'Profile'}
                            </a>
                          )}
                          <span className="flex items-center gap-1.5 text-ink">
                            <Phone className="size-3.5" />
                            {req.phone}
                          </span>
                        </div>
                      </div>

                      {/* Financial breakdown */}
                      <dl className="grid border-b border-line bg-sand/60 px-5 py-4 text-xs font-mono sm:grid-cols-3 gap-2">
                        <div className="flex justify-between sm:block">
                          <dt className="text-stone">Booking value</dt>
                          <dd className="font-head text-sm text-ink sm:mt-1">
                            ₹{req.organiserPays.toLocaleString('en-IN')}
                          </dd>
                        </div>
                        <div className="flex justify-between sm:block">
                          <dt className="text-stone">SCENE fee (10%)</dt>
                          <dd className="font-head text-sm text-stone sm:mt-1">
                            −₹{req.sceneFee.toLocaleString('en-IN')}
                          </dd>
                        </div>
                        <div className="flex justify-between sm:block">
                          <dt className="text-moss font-mono-b">Your payout</dt>
                          <dd className="font-head text-base text-moss sm:mt-1">
                            ₹{req.payout.toLocaleString('en-IN')}
                          </dd>
                        </div>
                      </dl>

                      {/* Action buttons & note */}
                      <div className="p-5 bg-white">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={() => setDecliningReqId(req.id)}
                            className="press flex-1 border-[1.5px] border-ink bg-paper px-4 py-3 font-head text-xs text-ink shadow-hard-sm hover:bg-sand focus-visible:outline-2 focus-visible:outline-flame"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApprove(req.id)}
                            className="press flex-[2] flex items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-3 font-head text-xs uppercase tracking-wider text-white shadow-hard-sm hover:brightness-105 focus-visible:outline-2 focus-visible:outline-ink"
                          >
                            <span>Approve request</span>
                            <ArrowRight className="size-4" />
                          </button>
                        </div>
                        <p className="mt-3 text-center text-xs text-stone font-mono flex items-center justify-center gap-1.5">
                          <Clock className="size-3 text-ink" />
                          Approving holds this slot for 24 hours while the organiser completes payment.
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {/* Section: Upcoming confirmed */}
            {confirmedList.length > 0 && (
            <section aria-labelledby="upcoming-confirmed-heading" className="pt-4">
              <h2 id="upcoming-confirmed-heading" className="font-head text-xl text-ink border-b border-line pb-3">
                Upcoming confirmed
              </h2>
              <div className="mt-4 space-y-3">
                {confirmedList.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 border-[1.5px] border-ink bg-white p-4 shadow-hard-sm transition-transform hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4">
                      {/* Date Badge */}
                      <div className="grid size-12 shrink-0 place-content-center border-[1.5px] border-ink bg-paper text-center">
                        <span className="font-mono text-[10px] text-stone leading-tight">{item.timeBadgeTop}</span>
                        <span className="font-head text-xs text-ink leading-tight">{item.timeBadgeBottom}</span>
                      </div>
                      <div>
                        <p className="font-head text-sm text-ink">
                          {item.title} · <span className="font-body text-stone">{item.organiser}</span>
                        </p>
                        <p className="text-xs text-stone font-mono mt-0.5">
                          {item.space} · {item.guests} people · <span className="text-ink">{item.code}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono-b text-[11px] ${
                          item.status === 'Paid'
                            ? 'border border-moss/40 bg-moss/10 text-moss'
                            : 'border border-flame/40 bg-flame/10 text-flame'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            item.status === 'Paid' ? 'bg-moss' : 'bg-flame animate-pulse'
                          }`}
                        />
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            )}
          </div>
        )}

        {/* ================= TAB 2: CALENDAR ================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-6 page-in">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="font-head text-2xl md:text-3xl text-ink">Calendar</h1>
                <p className="font-mono text-xs text-stone mt-1">{weekLabel}</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous week"
                  onClick={() => setCalWeekOffset((o) => o - 1)}
                  className="press grid size-9 place-items-center border-[1.5px] border-ink bg-white shadow-hard-sm"
                >
                  <ArrowLeft className="size-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next week"
                  onClick={() => setCalWeekOffset((o) => o + 1)}
                  className="press grid size-9 place-items-center border-[1.5px] border-ink bg-white shadow-hard-sm"
                >
                  <ArrowRight className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBlockTimeModal(true)}
                  className="press flex items-center gap-1.5 border-[1.5px] border-ink bg-flame px-3.5 py-2 font-head text-xs text-white shadow-hard-sm hover:brightness-105"
                >
                  <Plus className="size-3.5" />
                  <span>Block time</span>
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs font-mono text-stone">
              <span className="flex items-center gap-1.5">
                <span className="size-3 border border-ink bg-moss/20" /> Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 border border-ink bg-flame/20" /> Awaiting decision
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-3 border border-ink bg-sand border-dashed" /> Blocked
              </span>
            </div>

            {/* 7-Day Calendar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 border-[1.5px] border-ink bg-white p-3 shadow-hard">
              {weekDays.map((slot) => {
                const isBlocked = slot.type === 'blocked'
                const displayEvent = slot.event
                const displaySub = slot.sub

                return (
                  <div
                    key={slot.iso}
                    className="min-h-[160px] border border-line bg-paper p-2.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-stone">{slot.dayName}</span>
                      <span className="font-head text-sm text-ink">{slot.dayNum}</span>
                    </div>

                    {displayEvent && (
                      <div
                        className={`mt-2 rounded p-2 text-xs border ${
                          isBlocked
                            ? 'border-dashed border-ink/40 bg-sand text-stone'
                            : slot.type === 'awaiting'
                            ? 'border-flame/40 bg-flame/10 text-flame'
                            : 'border-moss/40 bg-moss/10 text-moss'
                        }`}
                      >
                        <p className="font-head leading-tight">{displayEvent}</p>
                        {displaySub && <p className="font-mono text-[10px] mt-1 text-stone">{displaySub}</p>}
                      </div>
                    )}

                    <div className="mt-auto pt-2 text-[10px] text-stone font-mono">
                      {!displayEvent && <span className="text-stone/60">Open slot</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ================= TAB 3: CHECK IN ================= */}
        {activeTab === 'checkin' && (
          <div className="mx-auto max-w-[560px] space-y-6 page-in">
            <div className="text-center">
              <h1 className="font-head text-2xl md:text-3xl text-ink">Check in a guest</h1>
              <p className="font-mono text-xs text-stone mt-1">
                Scan the organiser’s QR, or enter their booking code.
              </p>
            </div>

            <HostQrScanner onRefresh={refresh} />

            {/* Manual Code Form */}
            <form onSubmit={handleCheckInSearch} className="border-[1.5px] border-ink bg-white p-6 shadow-hard space-y-3">
              <label htmlFor="checkin-input" className="block font-mono-b text-xs uppercase text-stone">
                Or enter booking code
              </label>
              <div className="flex gap-2">
                <input
                  id="checkin-input"
                  type="text"
                  value={checkInCode}
                  onChange={(e) => setCheckInCode(e.target.value)}
                  placeholder="e.g. SCN-7KQ4XA"
                  className="min-w-0 flex-1 border-[1.5px] border-ink bg-paper px-3.5 py-2.5 font-mono-b text-sm uppercase tracking-wider text-ink focus:outline-none focus:ring-2 focus:ring-flame"
                />
                <button
                  type="submit"
                  className="press border-[1.5px] border-ink bg-flame px-5 py-2.5 font-head text-xs text-white shadow-hard-sm hover:brightness-105"
                >
                  Find
                </button>
              </div>
              <p className="font-mono text-[11px] text-stone">
                Codes start with SCN- and are on the organiser&apos;s pass.
              </p>

              {/* Result card */}
              {checkInResult && (
                <div
                  className={`mt-4 rounded border-[1.5px] p-4 font-mono text-xs anim-pop ${
                    checkInResult.status === 'success'
                      ? 'border-moss bg-moss/10 text-moss'
                      : checkInResult.status === 'unpaid'
                      ? 'border-flame bg-flame/10 text-flame'
                      : 'border-ink bg-paper text-ink'
                  }`}
                >
                  {checkInResult.status === 'success' && (
                    <div className="space-y-1">
                      <p className="font-head text-sm text-moss flex items-center gap-1.5">
                        <Check className="size-4" strokeWidth={2.5} /> Booking found
                      </p>
                      <p className="font-body-m text-ink">{checkInResult.title}</p>
                      <p className="text-stone">{checkInResult.guest}</p>
                      <p className="text-stone">{checkInResult.space}</p>
                      {hostBookings.find(b => b.code === checkInResult.code)?.status === 'confirmed' && <button
                        type="button"
                        onClick={() => checkInResult.code && confirmArrival(checkInResult.code)}
                        className="press mt-3 w-full border border-moss bg-moss py-2 font-head text-xs uppercase text-white shadow-hard-sm"
                      >
                        Confirm guest arrival
                      </button>}
                    </div>
                  )}

                  {checkInResult.status === 'unpaid' && (
                    <div className="space-y-1">
                      <p className="font-head text-sm text-flame">Payment Pending</p>
                      <p className="font-body-m text-ink">{checkInResult.title}</p>
                      <p className="text-stone">Organiser hasn&apos;t completed lock payment yet.</p>
                    </div>
                  )}

                  {checkInResult.status === 'not-found' && (
                    <p className="text-stone">No booking found matching code {checkInResult.code}.</p>
                  )}
                </div>
              )}
            </form>
            {hostBookings.filter(b => b.status === 'checked_in').map(b => <HostBookingSession key={b.id} booking={b} onRefresh={refresh} />)}
          </div>
        )}

        {activeTab === 'orders' && <section className="mx-auto max-w-[768px] space-y-4">
          <h1 className="font-head text-2xl">Sessions & organiser orders</h1>
          <label className="block text-sm">Choose a checked-in or completed booking<select className="mt-2 w-full min-w-0 border border-ink bg-white p-3" value={orderBookingId} onChange={e => setOrderBookingId(e.target.value)}>
            <option value="">Select booking</option>{hostBookings.filter(b => ['checked_in','completed'].includes(b.status)).map(b => <option key={b.id} value={b.id}>{b.code} · {b.organizerName} · {b.eventDate} · {b.status.replace('_',' ')}</option>)}
          </select></label>
          {hostBookings.filter(b => String(b.id) === orderBookingId && ['checked_in','completed'].includes(b.status)).map(b => <HostBookingSession key={b.id} booking={b} onRefresh={refresh} />)}
        </section>}
        {(activeTab === 'reviewsForYou' || activeTab === 'yourReviews') && (
          <HostReviews
            key={activeTab}
            view={activeTab === 'reviewsForYou' ? 'forYou' : 'yours'}
            reviews={receivedReviews}
            loading={reviewsLoading}
            error={reviewsError}
            onRetry={refresh}
            onViewBookings={() => setActiveTab('bookings')}
          />
        )}

        {activeTab === 'profile' && (
          <div className="mx-auto flex max-w-[768px] flex-col gap-8 page-in">
            <div className="flex flex-col gap-1">
              <p className="font-mono-b text-xs leading-4 tracking-[1.44px] text-flame uppercase">Your account</p>
              <h1 className="font-head text-3xl leading-[45px] text-ink uppercase sm:text-4xl">Host profile</h1>
              <p className="text-sm leading-5 text-stone">This is how organisers see you and your venue.</p>
            </div>
            <HostMenuPanel />
            {profile && onSaveProfile ? (
              <ProfileCard
                variant="host"
                profile={profile}
                photo={logo}
                stats={{ events: hostBookings.filter(b => b.status === 'completed' && !b.trialAmountPaise).length, rating: '—', next: nextEvent ? `${nextEvent.timeBadgeTop} ${nextEvent.timeBadgeBottom} · ${nextEvent.title}` : 'Nothing scheduled' }}
                onSave={onSaveProfile}
                onPhoto={saveLogo}
                toast={(m) => showToast(m)}
                onLogout={onLogout}
              />
            ) : (
              <div className="border-[2.5px] border-ink bg-white p-6 shadow-hard">
                <h2 className="font-head text-xl text-ink">Sign in to set up your host profile</h2>
                <p className="mt-1 text-sm text-stone">Add your venue logo, host name and phone number so organisers know who they’re booking with.</p>
                <button type="button" onClick={onAuth} className="press mt-4 border-[1.5px] border-ink bg-flame px-5 py-3 font-mono-b text-xs tracking-[0.72px] text-white uppercase shadow-hard-sm">
                  Sign in
                </button>
              </div>
            )}
          </div>
        )}

        {reviewingOrganiser && (
          <ReviewFlow
            role="host"
            defaultName={reviewingOrganiser.name}
            subject={reviewingOrganiser.event}
            avatar={logo}
            onClose={() => setReviewingOrganiser(null)}
            onSubmit={() => showToast(`Review for ${reviewingOrganiser.name} published`)}
            onViewReview={() => {
              setReviewingOrganiser(null)
              setActiveTab('yourReviews')
            }}
          />
        )}

        {/* ================= TAB 4: PAYOUTS ================= */}
        {activeTab === 'payouts' && (
          <div className="space-y-8 page-in">
            <div>
              <h1 className="font-head text-2xl md:text-3xl text-ink">Payouts &amp; demand</h1>
              <p className="font-mono text-xs text-stone mt-1">This month · {monthLabel}</p>
            </div>

            {/* Payout breakdown cards */}
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">Confirmed booking value</dt>
                <dd className="mt-2 font-head text-3xl text-ink">₹{monthValue.toLocaleString('en-IN')}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">SCENE fee (10%)</dt>
                <dd className="mt-2 font-head text-3xl text-stone">−₹{monthFee.toLocaleString('en-IN')}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-stone uppercase">Estimated payout</dt>
                <dd className="mt-2 font-head text-3xl text-moss">₹{(monthValue - monthFee).toLocaleString('en-IN')}</dd>
              </div>
            </dl>

            {/* Demand Analysis 2 columns */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Most requested spaces */}
              <section aria-labelledby="spaces-demand-heading" className="border-[1.5px] border-ink bg-white p-6 shadow-hard">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <TrendingUp className="size-4 text-flame" />
                  <h2 id="spaces-demand-heading" className="font-head text-lg text-ink">
                    Most requested spaces
                  </h2>
                </div>
                <div className="mt-4 space-y-4">
                  {spaceDemand.length === 0 && <p className="font-mono text-xs text-stone">No requests yet — this fills in from your real bookings.</p>}
                  {spaceDemand.map((s) => (
                    <div key={s.name} className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink">{s.name}</span>
                        <span className="text-stone">{s.count} requests</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden border border-ink bg-paper">
                        <div
                          className="h-full bg-flame"
                          style={{ width: `${s.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Most requested time slots */}
              <section aria-labelledby="slots-demand-heading" className="border-[1.5px] border-ink bg-white p-6 shadow-hard">
                <div className="flex items-center gap-2 border-b border-line pb-3">
                  <Clock className="size-4 text-ink" />
                  <h2 id="slots-demand-heading" className="font-head text-lg text-ink">
                    Most requested time slots
                  </h2>
                </div>
                <div className="mt-4 space-y-4">
                  {slotDemand.map((t) => (
                    <div key={t.slot} className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink">{t.slot}</span>
                        <span className="text-stone">{t.count} requests</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden border border-ink bg-paper">
                        <div
                          className="h-full bg-ink"
                          style={{ width: `${t.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* Decline Reason Modal */}
      {decliningReqId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="decline-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-[480px] border-[2px] border-ink bg-white p-6 shadow-hard-lg anim-pop">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setDecliningReqId(null)}
              className="press absolute right-4 top-4 grid size-8 place-items-center border-[1.5px] border-ink bg-paper"
            >
              <Close className="size-4" />
            </button>

            <h3 id="decline-modal-title" className="font-head text-xl text-ink">
              Why are you declining?
            </h3>
            <p className="mt-1 text-xs text-stone font-mono">
              Pick a reason so the organiser knows how to adjust.
            </p>

            <div className="mt-4 space-y-2">
              {DECLINE_REASONS.map((reason) => (
                <label
                  key={reason}
                  className="flex items-center gap-2.5 border border-line p-2.5 hover:bg-sand cursor-pointer text-xs font-body-m"
                >
                  <input
                    type="radio"
                    name="decline-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={() => setSelectedReason(reason)}
                    className="accent-flame size-4"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="mt-4">
              <label htmlFor="decline-note" className="block font-mono-b text-[11px] uppercase text-stone">
                Add a note (optional)
              </label>
              <textarea
                id="decline-note"
                value={declineNote}
                onChange={(e) => setDeclineNote(e.target.value)}
                placeholder="Share a line the organiser will see with your decline..."
                rows={3}
                className="mt-1 w-full border-[1.5px] border-ink bg-paper p-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-flame"
              />
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDecliningReqId(null)}
                className="press border-[1.5px] border-ink bg-paper px-4 py-2 font-head text-xs text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeclineConfirm}
                className="press border-[1.5px] border-ink bg-flame px-4 py-2 font-head text-xs text-white shadow-hard-sm"
              >
                Send decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block Time Modal */}
      {blockTimeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="block-time-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
        >
          <div className="relative w-full max-w-[440px] border-[2px] border-ink bg-white p-6 shadow-hard-lg anim-pop">
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setBlockTimeModal(false)}
              className="press absolute right-4 top-4 grid size-8 place-items-center border-[1.5px] border-ink bg-paper"
            >
              <Close className="size-4" />
            </button>

            <h3 id="block-time-title" className="font-head text-xl text-ink">
              Block time slot
            </h3>
            <p className="mt-1 text-xs text-stone font-mono">
              Prevent organisers from booking during maintenance or private holds.
            </p>

            <form onSubmit={handleBlockTimeSubmit} className="mt-4 space-y-3.5 text-xs font-mono">
              <div>
                <label htmlFor="block-reason-input" className="block text-stone uppercase">Reason / Note</label>
                <input
                  id="block-reason-input"
                  type="text"
                  required
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="e.g. Acoustic check, Private party"
                  className="mt-1 w-full border-[1.5px] border-ink bg-paper p-2 text-ink focus:outline-none focus:ring-2 focus:ring-flame"
                />
              </div>

              <div>
                <label htmlFor="block-space-select" className="block text-stone uppercase">Space</label>
                <select
                  id="block-space-select"
                  value={blockSpace}
                  onChange={(e) => setBlockSpace(e.target.value)}
                  className="mt-1 w-full border-[1.5px] border-ink bg-paper p-2 text-ink focus:outline-none"
                >
                  <option>First-floor event space</option>
                  <option>Open terrace · BBQ table</option>
                  <option>Korean table</option>
                  <option>Conversation table</option>
                </select>
              </div>

              <div>
                <label htmlFor="block-date-input" className="block text-stone uppercase">Date</label>
                <input
                  id="block-date-input"
                  type="date"
                  value={blockDate}
                  onChange={(e) => setBlockDate(e.target.value)}
                  className="mt-1 w-full border-[1.5px] border-ink bg-paper p-2 text-ink focus:outline-none"
                />
              </div>

              <div className="mt-5 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBlockTimeModal(false)}
                  className="press border-[1.5px] border-ink bg-paper px-4 py-2 font-head text-xs text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="press border-[1.5px] border-ink bg-flame px-4 py-2 font-head text-xs text-white shadow-hard-sm"
                >
                  Block slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
