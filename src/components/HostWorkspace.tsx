import { useEffect, useRef, useState, useId } from 'react'
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
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from './icons'
import exterior from '../assets/1f1a5.png'
import quoteIcon from '../assets/profile/971d5.svg'
import HostReviews from './HostReviews'
import ProfileCard from './ProfileCard'
import ReviewFlow from './ReviewFlow'
import type { Profile } from './AuthModal'

const VENUE_PATH = '#/venue/time-cafe'

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
    const ok = await copyText(`${window.location.origin}${window.location.pathname}${VENUE_PATH}`)
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
        <h3 id="host-empty-title" className="font-display text-2xl leading-9 tracking-[-0.75px] text-balance text-[#141414] sm:text-[26px]">
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

export type HostTab = 'bookings' | 'calendar' | 'checkin' | 'payouts' | 'reviewsForYou' | 'yourReviews' | 'profile'

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

const INITIAL_REQUESTS: HostRequest[] = [
  {
    id: 'req-1',
    code: 'TC-4471',
    title: 'Tech meetup',
    organiser: 'Aravind Kumar',
    orgGroup: 'ChennaiJS',
    date: 'Sat, 4 Oct',
    time: '18:00',
    duration: '3 hours',
    guests: 28,
    space: 'First-floor event space',
    eventPlan: 'Monthly JavaScript meetup — two 20-min talks, then lightning talks and community show & tell.',
    requestedSetup: 'Theatre seating for the talks, then clear the floor for networking. 4K projector + mic set up by 17:30.',
    linkedin: 'LinkedIn · 2.4k followers',
    phone: '+91 98840 21188',
    organiserPays: 6480,
    sceneFee: 518,
    payout: 5962,
    status: 'new',
  },
  {
    id: 'req-2',
    code: 'TC-4472',
    title: 'Product launch',
    organiser: 'Nithya Balaji',
    orgGroup: 'Studio Verdant',
    date: 'Sat, 11 Oct',
    time: '17:00',
    duration: '4 hours',
    guests: 16,
    space: 'Open terrace · BBQ table',
    eventPlan: 'Intimate launch for our new ceramics line at dusk. Product showcase on central counter, welcome cocktails and aperitifs.',
    requestedSetup: 'Terrace BBQ lit by 5 PM, string lights on. We handle catering, require 2 prep tables and power points for music.',
    linkedin: 'studioverdant.in',
    phone: '+91 90031 55420',
    organiserPays: 6480,
    sceneFee: 518,
    payout: 5962,
    status: 'new',
  },
]

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

const INITIAL_CONFIRMED: ConfirmedItem[] = [
  {
    id: 'c-1',
    timeBadgeTop: 'Today',
    timeBadgeBottom: '18:00',
    title: 'Design workshop',
    organiser: 'Faizal Rahman',
    space: 'First-floor event space',
    guests: 22,
    code: 'TC-4468',
    status: 'Paid',
  },
  {
    id: 'c-2',
    timeBadgeTop: 'Tue,',
    timeBadgeBottom: '11:00',
    title: 'Podcast recording',
    organiser: 'Meera Sundaram',
    space: 'Conversation table',
    guests: 4,
    code: 'TC-4470',
    status: 'Paid',
  },
]

const DECLINE_REASONS = [
  'Date already occupied',
  'Capacity mismatch',
  'Need more info',
  'Not the right fit this time',
  'Not suitable for this space',
  'Other',
]

export default function HostWorkspace({
  hostName = 'Priya',
  profile,
  onSaveProfile,
  onAuth,
  onExit,
  onLogout,
}: {
  hostName?: string
  profile?: Profile | null
  onSaveProfile?: (p: Profile) => void
  onAuth?: () => void
  onExit: () => void
  onLogout?: () => void
}) {
  const [logo, setLogo] = useState<string | null>(loadLogo)
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
  const [requests, setRequests] = useState<HostRequest[]>(INITIAL_REQUESTS)
  const [confirmedList, setConfirmedList] = useState<ConfirmedItem[]>(INITIAL_CONFIRMED)
  const [decliningReqId, setDecliningReqId] = useState<string | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>(DECLINE_REASONS[0])
  const [declineNote, setDeclineNote] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Calendar State
  const [calWeekOffset, setCalWeekOffset] = useState(0)
  const [blockTimeModal, setBlockTimeModal] = useState(false)
  const [blockDate, setBlockDate] = useState('2026-10-05')
  const [blockTitle, setBlockTitle] = useState('Private event')
  const [blockSpace, setBlockSpace] = useState('First-floor event space')
  const [customBlockedDates, setCustomBlockedDates] = useState<{ day: number; title: string; space: string }[]>([
    { day: 29, title: 'Maintenance block', space: 'Kitchen deep-clean' },
  ])

  // Check-in State
  const [checkInCode, setCheckInCode] = useState('TC-4468')
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

  const handleApprove = (reqId: string) => {
    const req = requests.find((r) => r.id === reqId)
    if (!req) return
    setRequests((prev) => prev.map((r) => (r.id === reqId ? { ...r, status: 'approved' } : r)))
    setConfirmedList((prev) => [
      {
        id: `conf-${Date.now()}`,
        timeBadgeTop: req.date.split(',')[0] + ',',
        timeBadgeBottom: req.time,
        title: req.title,
        organiser: req.organiser,
        space: req.space,
        guests: req.guests,
        code: req.code,
        status: 'Awaiting payment',
      },
      ...prev,
    ])
    showToast(`Approved ${req.code}! Held for 24h for payment.`)
  }

  const handleDeclineConfirm = () => {
    if (!decliningReqId) return
    const req = requests.find((r) => r.id === decliningReqId)
    setRequests((prev) =>
      prev.map((r) =>
        r.id === decliningReqId
          ? { ...r, status: 'declined', declineReason: selectedReason, declineNote }
          : r
      )
    )
    setDecliningReqId(null)
    setDeclineNote('')
    showToast(`Request ${req?.code ?? ''} declined. Organiser notified.`)
  }

  const handleBlockTimeSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const d = parseInt(blockDate.split('-')[2] || '30', 10)
    setCustomBlockedDates((prev) => [...prev, { day: d, title: blockTitle, space: blockSpace }])
    setBlockTimeModal(false)
    showToast(`Time slot blocked on Day ${d}: ${blockTitle}`)
  }

  const handleCheckInSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const query = checkInCode.trim().toUpperCase()
    if (query === 'TC-4468') {
      setCheckInResult({
        status: 'success',
        title: 'Design workshop',
        guest: 'Faizal Rahman · 22 guests',
        space: 'First-floor event space',
        code: 'TC-4468',
      })
    } else if (query === 'TC-4470') {
      setCheckInResult({
        status: 'unpaid',
        title: 'Podcast recording',
        guest: 'Meera Sundaram · 4 guests',
        space: 'Conversation table',
        code: 'TC-4470',
      })
    } else {
      setCheckInResult({
        status: 'not-found',
        code: query,
      })
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
                <p className="font-mono text-[11px] text-muted tracking-wide">Bookings workspace</p>
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
            className="flex gap-2 overflow-x-auto border-t border-line py-1 scrollbar-none"
          >
            <button
              type="button"
              onClick={() => setActiveTab('bookings')}
              aria-current={activeTab === 'bookings' ? 'page' : undefined}
              className={`flex items-center gap-2 border-b-2 px-3 py-2.5 font-head text-sm transition-colors ${
                activeTab === 'bookings'
                  ? 'border-flame text-flame'
                  : 'border-transparent text-muted hover:text-ink'
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
                  : 'border-transparent text-muted hover:text-ink'
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
                  : 'border-transparent text-muted hover:text-ink'
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
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              <Wallet className="size-4" />
              <span>Payouts</span>
            </button>
          {([
              { id: 'reviewsForYou', label: 'Reviews for you', icon: '/assets/reviews/72dc5.png', count: 2 },
              { id: 'yourReviews', label: 'Your reviews', icon: '/assets/reviews/1c6e7.png', count: 1 },
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
                    : 'border-transparent text-muted hover:text-ink'
                }`}
              >
                {t.id !== 'yourReviews' && (t.icon ? <img src={t.icon} alt="" className="size-4" /> : <Users className="size-4" />)}
                <span>{t.label}</span>
                {t.count > 0 && <span
                  className={`grid size-5 place-items-center rounded-full font-mono-b text-[10px] text-white ${
                    activeTab === t.id ? 'bg-flame' : 'bg-muted'
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
        {/* ================= TAB 1: BOOKINGS ================= */}
        {activeTab === 'bookings' && (
          <div className="space-y-8 page-in">
            {/* Header section */}
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="font-mono text-xs text-muted tracking-wider uppercase">
                  Good evening, {hostName}
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
                <dt className="font-mono text-xs text-muted uppercase">Needs your response</dt>
                <dd className="mt-2 font-head text-3xl text-flame">{activeNewRequests.length}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-muted uppercase">Upcoming confirmed</dt>
                <dd className="mt-2 font-head text-3xl text-ink">{confirmedList.length}</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-muted uppercase">Estimated payout</dt>
                <dd className="mt-2 font-head text-3xl text-moss">
                  ₹{activeNewRequests.reduce((acc, curr) => acc + curr.payout, 18106).toLocaleString('en-IN')}
                </dd>
              </div>
            </dl>

            {/* Section: New Requests */}
            <section aria-labelledby="new-requests-heading">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h2 id="new-requests-heading" className="font-head text-xl text-ink">
                  New requests
                </h2>
                <span className="font-mono text-xs text-muted flex items-center gap-1.5">
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
                    <p className="text-xs text-muted mt-1">No pending guest requests requiring review.</p>
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
                            <span className="font-mono-b text-xs text-muted tracking-wider">{req.code}</span>
                          </div>
                          <h3 className="mt-2 font-head text-xl text-ink">{req.title}</h3>
                          <p className="text-xs text-muted mt-0.5">
                            {req.organiser} · <span className="text-ink font-body-m">{req.orgGroup}</span>
                          </p>
                        </div>

                        <ul className="space-y-1.5 text-xs text-right font-mono" aria-label="Event meta">
                          <li className="flex items-center justify-end gap-1.5 text-ink">
                            <CalendarIcon className="size-3.5 text-flame" />
                            <span>{req.date}</span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-muted">
                            <Clock className="size-3.5 text-ink" />
                            <span>
                              {req.time} · {req.duration}
                            </span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-muted">
                            <Users className="size-3.5 text-ink" />
                            <span>{req.guests} people</span>
                          </li>
                          <li className="flex items-center justify-end gap-1.5 text-muted">
                            <MapPin className="size-3.5 text-ink" />
                            <span>{req.space}</span>
                          </li>
                        </ul>
                      </div>

                      {/* Request Body Details */}
                      <div className="p-5 space-y-4 border-b border-line text-sm">
                        <div>
                          <h4 className="font-mono-b text-xs uppercase text-muted tracking-wider">Event plan</h4>
                          <p className="mt-1 text-ink leading-relaxed">{req.eventPlan}</p>
                        </div>
                        <div>
                          <h4 className="font-mono-b text-xs uppercase text-muted tracking-wider">Requested setup</h4>
                          <p className="mt-1 text-ink leading-relaxed">{req.requestedSetup}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 pt-1 font-mono text-xs text-muted">
                          <span className="flex items-center gap-1.5 text-flame underline">
                            <Link2 className="size-3.5" />
                            {req.linkedin}
                          </span>
                          <span className="flex items-center gap-1.5 text-ink">
                            <Phone className="size-3.5" />
                            {req.phone}
                          </span>
                        </div>
                      </div>

                      {/* Financial breakdown */}
                      <dl className="grid border-b border-line bg-sand/60 px-5 py-4 text-xs font-mono sm:grid-cols-3 gap-2">
                        <div className="flex justify-between sm:block">
                          <dt className="text-muted">Organiser pays</dt>
                          <dd className="font-head text-sm text-ink sm:mt-1">
                            ₹{req.organiserPays.toLocaleString('en-IN')}
                          </dd>
                        </div>
                        <div className="flex justify-between sm:block">
                          <dt className="text-muted">SCENE fee (8%)</dt>
                          <dd className="font-head text-sm text-muted sm:mt-1">
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
                        <p className="mt-3 text-center text-xs text-muted font-mono flex items-center justify-center gap-1.5">
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
                        <span className="font-mono text-[10px] text-muted leading-tight">{item.timeBadgeTop}</span>
                        <span className="font-head text-xs text-ink leading-tight">{item.timeBadgeBottom}</span>
                      </div>
                      <div>
                        <p className="font-head text-sm text-ink">
                          {item.title} · <span className="font-body text-muted">{item.organiser}</span>
                        </p>
                        <p className="text-xs text-muted font-mono mt-0.5">
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
                <p className="font-mono text-xs text-muted mt-1">27 Sep – 3 Oct 2026</p>
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
            <div className="flex flex-wrap gap-4 text-xs font-mono text-muted">
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
              {[
                { dayName: 'Sat', dayNum: 27, event: 'Design workshop · 6 PM', sub: 'First floor · Faizal', type: 'confirmed' },
                { dayName: 'Sun', dayNum: 28 },
                { dayName: 'Mon', dayNum: 29, event: 'Maintenance block', sub: 'Kitchen deep-clean', type: 'blocked' },
                { dayName: 'Tue', dayNum: 30, event: 'Podcast · 11 AM', sub: 'Conversation table · Meera', type: 'confirmed' },
                { dayName: 'Wed', dayNum: 1 },
                { dayName: 'Thu', dayNum: 2 },
                { dayName: 'Fri', dayNum: 3, event: 'Awaiting decision · 6 PM', sub: 'Tech meetup · 28p', type: 'awaiting' },
              ].map((slot) => {
                const custom = customBlockedDates.find((b) => b.day === slot.dayNum)
                const isBlocked = custom || slot.type === 'blocked'
                const displayEvent = custom ? custom.title : slot.event
                const displaySub = custom ? custom.space : slot.sub

                return (
                  <div
                    key={slot.dayName}
                    className="min-h-[160px] border border-line bg-paper p-2.5 flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-muted">{slot.dayName}</span>
                      <span className="font-head text-sm text-ink">{slot.dayNum}</span>
                    </div>

                    {displayEvent && (
                      <div
                        className={`mt-2 rounded p-2 text-xs border ${
                          isBlocked
                            ? 'border-dashed border-ink/40 bg-sand text-muted'
                            : slot.type === 'awaiting'
                            ? 'border-flame/40 bg-flame/10 text-flame'
                            : 'border-moss/40 bg-moss/10 text-moss'
                        }`}
                      >
                        <p className="font-head leading-tight">{displayEvent}</p>
                        {displaySub && <p className="font-mono text-[10px] mt-1 text-muted">{displaySub}</p>}
                      </div>
                    )}

                    <div className="mt-auto pt-2 text-[10px] text-muted font-mono">
                      {!displayEvent && <span className="text-muted/60">Open slot</span>}
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
              <p className="font-mono text-xs text-muted mt-1">
                Scan the organiser’s QR, or enter their booking code.
              </p>
            </div>

            {/* QR Scanner Mock Viewfinder */}
            <div className="relative mx-auto flex aspect-square max-w-[340px] flex-col items-center justify-center border-[2px] border-ink bg-white p-6 shadow-hard">
              <div className="relative flex size-48 items-center justify-center rounded-lg border-2 border-dashed border-ink/40 bg-paper">
                {/* Viewfinder corner brackets */}
                <span className="absolute -top-1.5 -left-1.5 size-4 border-t-2 border-l-2 border-flame" />
                <span className="absolute -top-1.5 -right-1.5 size-4 border-t-2 border-r-2 border-flame" />
                <span className="absolute -bottom-1.5 -left-1.5 size-4 border-b-2 border-l-2 border-flame" />
                <span className="absolute -bottom-1.5 -right-1.5 size-4 border-b-2 border-r-2 border-flame" />

                <QrCode className="size-20 text-ink/70" />
              </div>
              <p className="mt-4 font-mono text-xs text-muted">Point camera at organiser's QR</p>
            </div>

            {/* Manual Code Form */}
            <form onSubmit={handleCheckInSearch} className="border-[1.5px] border-ink bg-white p-6 shadow-hard space-y-3">
              <label htmlFor="checkin-input" className="block font-mono-b text-xs uppercase text-muted">
                Or enter booking code
              </label>
              <div className="flex gap-2">
                <input
                  id="checkin-input"
                  type="text"
                  value={checkInCode}
                  onChange={(e) => setCheckInCode(e.target.value)}
                  placeholder="e.g. TC-4468"
                  className="flex-1 border-[1.5px] border-ink bg-paper px-3.5 py-2.5 font-mono-b text-sm uppercase tracking-wider text-ink focus:outline-none focus:ring-2 focus:ring-flame"
                />
                <button
                  type="submit"
                  className="press border-[1.5px] border-ink bg-flame px-5 py-2.5 font-head text-xs text-white shadow-hard-sm hover:brightness-105"
                >
                  Find
                </button>
              </div>
              <p className="font-mono text-[11px] text-muted">
                Try quick tests:{' '}
                <button
                  type="button"
                  onClick={() => setCheckInCode('TC-4468')}
                  className="text-flame underline"
                >
                  TC-4468
                </button>{' '}
                (ready),{' '}
                <button
                  type="button"
                  onClick={() => setCheckInCode('TC-4470')}
                  className="text-flame underline"
                >
                  TC-4470
                </button>{' '}
                (unpaid), or{' '}
                <button
                  type="button"
                  onClick={() => setCheckInCode('TC-9000')}
                  className="text-flame underline"
                >
                  TC-9000
                </button>
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
                        <Check className="size-4" strokeWidth={2.5} /> Check-in Verified!
                      </p>
                      <p className="font-body-m text-ink">{checkInResult.title}</p>
                      <p className="text-muted">{checkInResult.guest}</p>
                      <p className="text-muted">{checkInResult.space}</p>
                      <button
                        type="button"
                        onClick={() => showToast(`Checked in ${checkInResult.code} successfully!`)}
                        className="press mt-3 w-full border border-moss bg-moss py-2 font-head text-xs uppercase text-white shadow-hard-sm"
                      >
                        Confirm guest arrival
                      </button>
                    </div>
                  )}

                  {checkInResult.status === 'unpaid' && (
                    <div className="space-y-1">
                      <p className="font-head text-sm text-flame">Payment Pending</p>
                      <p className="font-body-m text-ink">{checkInResult.title}</p>
                      <p className="text-muted">Organiser hasn't completed lock payment yet.</p>
                    </div>
                  )}

                  {checkInResult.status === 'not-found' && (
                    <p className="text-muted">No booking found matching code {checkInResult.code}.</p>
                  )}
                </div>
              )}
            </form>
          </div>
        )}

        {(activeTab === 'reviewsForYou' || activeTab === 'yourReviews') && (
          <HostReviews
            key={activeTab}
            view={activeTab === 'reviewsForYou' ? 'forYou' : 'yours'}
            onViewBookings={() => setActiveTab('bookings')}
            onToast={showToast}
            onReviewOrganiser={(name, event) => setReviewingOrganiser({ name, event })}
          />
        )}

        {activeTab === 'profile' && (
          <div className="mx-auto flex max-w-[768px] flex-col gap-8 page-in">
            <div className="flex flex-col gap-1">
              <p className="font-mono-b text-xs leading-4 tracking-[1.44px] text-flame uppercase">Your account</p>
              <h1 className="font-head text-3xl leading-[45px] text-ink uppercase sm:text-4xl">Host profile</h1>
              <p className="text-sm leading-5 text-muted">This is how organisers see you and your venue.</p>
            </div>
            {profile && onSaveProfile ? (
              <ProfileCard
                variant="host"
                profile={profile}
                photo={logo}
                stats={{ events: 48, rating: '4.8', next: 'Fri, 3 Oct · Product launch' }}
                onSave={onSaveProfile}
                onPhoto={saveLogo}
                toast={(m) => showToast(m)}
                onLogout={onLogout}
              />
            ) : (
              <div className="border-[2.5px] border-ink bg-white p-6 shadow-hard">
                <h2 className="font-head text-xl text-ink">Sign in to set up your host profile</h2>
                <p className="mt-1 text-sm text-muted">Add your venue logo, host name and phone number so organisers know who they’re booking with.</p>
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
              <p className="font-mono text-xs text-muted mt-1">This month · September 2026</p>
            </div>

            {/* Payout breakdown cards */}
            <dl className="grid gap-4 sm:grid-cols-3">
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-muted uppercase">Confirmed booking value</dt>
                <dd className="mt-2 font-head text-3xl text-ink">₹26,160</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-muted uppercase">SCENE fee (8%)</dt>
                <dd className="mt-2 font-head text-3xl text-muted">−₹2,093</dd>
              </div>
              <div className="border-[1.5px] border-ink bg-white p-5 shadow-hard">
                <dt className="font-mono text-xs text-muted uppercase">Estimated payout</dt>
                <dd className="mt-2 font-head text-3xl text-moss">₹24,067</dd>
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
                  {[
                    { name: 'First-floor event space', count: 18, pct: 100 },
                    { name: 'Open terrace · BBQ table', count: 13, pct: 72 },
                    { name: 'Korean table', count: 8, pct: 45 },
                    { name: 'Conversation table', count: 5, pct: 28 },
                  ].map((s) => (
                    <div key={s.name} className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink">{s.name}</span>
                        <span className="text-muted">{s.count} requests</span>
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
                  {[
                    { slot: 'Weekday 6–9 PM', count: 21, pct: 100 },
                    { slot: 'Saturday evening 5–9 PM', count: 19, pct: 90 },
                    { slot: 'Sunday brunch 10 AM–2 PM', count: 12, pct: 57 },
                    { slot: 'Weekday afternoon 2–5 PM', count: 6, pct: 28 },
                  ].map((t) => (
                    <div key={t.slot} className="space-y-1.5 font-mono text-xs">
                      <div className="flex justify-between">
                        <span className="text-ink">{t.slot}</span>
                        <span className="text-muted">{t.count} requests</span>
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
            <p className="mt-1 text-xs text-muted font-mono">
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
              <label htmlFor="decline-note" className="block font-mono-b text-[11px] uppercase text-muted">
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
            <p className="mt-1 text-xs text-muted font-mono">
              Prevent organisers from booking during maintenance or private holds.
            </p>

            <form onSubmit={handleBlockTimeSubmit} className="mt-4 space-y-3.5 text-xs font-mono">
              <div>
                <label htmlFor="block-reason-input" className="block text-muted uppercase">Reason / Note</label>
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
                <label htmlFor="block-space-select" className="block text-muted uppercase">Space</label>
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
                <label htmlFor="block-date-input" className="block text-muted uppercase">Date</label>
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
