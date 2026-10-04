import { useEffect, useId, useRef, useState } from 'react'
import FieldError from './FieldError'
import Dialog from './Dialog'
import ProfileCard from './ProfileCard'
import ReviewFlow from './ReviewFlow'
import RequestFlight from './RequestFlight'
import { Close, Star } from './icons'
import type { Profile } from './AuthModal'
import { hostReviews, REVIEW_TAGS, type Booking, type Review } from './bookingsData'
import avatarDefault from '../assets/profile/9d83e.png'
import arrowWhite from '../assets/profile/623be.svg'
import pinIcon from '../assets/profile/58648.svg'
import calIcon from '../assets/profile/135c7.svg'
import clockIcon from '../assets/profile/95c70.svg'
import usersIcon from '../assets/profile/a7b0a.svg'
import holdIcon from '../assets/profile/715a0.svg'
import payArrow from '../assets/profile/c6e26.svg'
import qrIcon from '../assets/profile/c8938.svg'
import checkIcon from '../assets/profile/c6f8b.svg'
import browseArrow from '../assets/profile/a453d.svg'
import quoteIcon from '../assets/profile/971d5.svg'

type Tab = 'upcoming' | 'past' | 'declined' | 'for-you' | 'yours'
type Toast = { id: number; msg: string; tone: 'ok' | 'error' }

const PHOTO_KEY = 'scene044.photo'
const QR = ['11110111', '11101000', '11100111', '10010010', '01001001', '10100100', '10110010', '10101001']
const mono = 'font-mono-b text-[10px] leading-[15px] tracking-[0.6px] uppercase'
const card = 'border-[1.5px] border-ink bg-white shadow-hard'
const ghostBtn = `press min-h-10 border-[1.5px] border-ink bg-white px-4 ${mono} text-ink shadow-hard-sm`
const flameBtn = `press inline-flex min-h-10 items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-5 font-mono-b text-xs leading-4 tracking-[0.72px] text-white uppercase shadow-hard-sm disabled:opacity-70`

const statusMeta: Record<Booking['status'], { label: string; color: string }> = {
  due: { label: 'Payment due', color: 'text-flame bg-flame' },
  confirmed: { label: 'Confirmed', color: 'text-moss bg-moss' },
  sent: { label: 'Request sent', color: 'text-muted bg-muted' },
  completed: { label: 'Completed', color: 'text-ink bg-ink' },
  declined: { label: 'Declined', color: 'text-flame bg-flame' },
  withdrawn: { label: 'Withdrawn', color: 'text-muted bg-muted' },
}

const loadPhoto = () => {
  const v = localStorage.getItem(PHOTO_KEY)
  return v === null ? avatarDefault : v === '' ? null : v
}

function Stars({ value, className = 'size-3.5' }: { value: number; className?: string }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) =>
        i <= value ? (
          <Star key={i} className={`${className} text-flame`} />
        ) : (
          <svg key={i} viewBox="0 0 24 24" className={`${className} text-flame`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8z" />
          </svg>
        ),
      )}
    </span>
  )
}

function Meta({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-1.5">
      <img src={icon} alt="" width={12} height={12} className="size-3 shrink-0" />
      <span className="font-mono text-[10px] leading-[15px] tracking-[0.4px] text-muted uppercase">{children}</span>
    </li>
  )
}

function Empty({ icon, title, body, cta, onCta }: { icon?: React.ReactNode; title: string; body: string; cta: string; onCta: () => void }) {
  return (
    <section aria-label={title} className="anim-pop flex flex-col items-center gap-3 rounded-xl border-2 border-[#141414] bg-white px-6 py-12 text-center shadow-hard sm:p-[66px]">
      <div aria-hidden="true" className="grid size-[88px] shrink-0 place-items-center rounded-full border-2 border-[#141414] bg-[#faf7f0]">
        {icon ?? <img src={quoteIcon} alt="" width={38} height={38} className="size-[38px]" />}
      </div>
      <div className="flex flex-col items-center gap-2">
        <h3 className="font-display text-2xl leading-9 tracking-[-0.75px] text-balance text-[#141414] sm:text-[26px]">{title}</h3>
        <p className="max-w-[592px] text-sm leading-[22.75px] text-balance text-[#706e6b]">{body}</p>
      </div>
      <button
        type="button"
        onClick={onCta}
        className="press mt-1 inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border-2 border-[#111] bg-[#eb442c] px-6 py-3.5 font-mono-b text-xs leading-4 tracking-[0.6px] text-white uppercase shadow-hard"
      >
        {cta} <img src={arrowWhite} alt="" width={16} height={16} className="size-4" />
      </button>
    </section>
  )
}

function BookingCard({
  b,
  i,
  onPay,
  onWithdraw,
  onReview,
  onBrowse,
}: {
  b: Booking
  i: number
  onPay: () => void
  onWithdraw: () => void
  onReview: () => void
  onBrowse: () => void
}) {
  const [pass, setPass] = useState(true)
  const passId = useId()
  const s = statusMeta[b.status]
  const muted = b.status === 'declined' || b.status === 'withdrawn'

  return (
    <li className={`${card} rise`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
      <article aria-label={`${b.eventType} at ${b.venue}, ${s.label}`} className="flex flex-col gap-4 p-4 sm:flex-row sm:p-5">
        <div className={`h-40 shrink-0 overflow-hidden border-[1.5px] border-ink bg-sand shadow-[2px_2px_0_0_#111] sm:h-[164px] sm:w-40 ${muted ? 'grayscale' : ''}`}>
          <img src={b.img} alt={`${b.venue}, ${b.space}`} className="size-full object-cover" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={`${mono} text-flame`}>{b.eventType}</p>
              <h3 className="pt-1 font-head text-lg leading-[22.5px] text-ink">{b.venue}</h3>
            </div>
            <p className={`flex shrink-0 items-center gap-1.5 ${mono} ${s.color.split(' ')[0]}`}>
              <span aria-hidden="true" className={`size-1.5 ${s.color.split(' ')[1]}`} />
              {s.label}
            </p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5 pt-3">
            <Meta icon={pinIcon}>{b.space}</Meta>
            <Meta icon={calIcon}>{b.date}</Meta>
            <Meta icon={clockIcon}>{b.time}</Meta>
            <Meta icon={usersIcon}>{b.guests}</Meta>
          </ul>

          <div className="mt-4 border-t border-line pt-4">
            {b.status === 'due' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-body-m text-sm leading-5 text-ink">Host approved — pay {b.amount} to confirm</p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono-b text-[10px] leading-[15px] tracking-[0.5px] text-flame uppercase">
                    <img src={holdIcon} alt="" width={12} height={12} className="size-3" /> Slot held until 23:45 tonight
                  </p>
                </div>
                <button type="button" onClick={onPay} className={`${flameBtn} py-3`}>
                  Pay {b.amount} <img src={payArrow} alt="" width={15} height={15} className="size-[15px]" />
                </button>
              </div>
            )}

            {b.status === 'confirmed' && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-body-m text-sm leading-5 text-ink">Paid &amp; confirmed — show this at the door</p>
                  <button
                    type="button"
                    onClick={() => setPass((p) => !p)}
                    aria-expanded={pass}
                    aria-controls={passId}
                    className={`press flex min-h-10 items-center gap-2 border-[1.5px] border-ink bg-ink px-4 ${mono} text-white shadow-hard-sm`}
                  >
                    <img src={qrIcon} alt="" width={14} height={14} className="size-3.5" /> {pass ? 'Hide pass' : 'Show pass'}
                  </button>
                </div>
                <div id={passId} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${pass ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                  <div className="overflow-hidden">
                    <div className="m-[2px] mr-1 mt-4 mb-1 flex flex-col items-center gap-5 border-[1.5px] border-ink bg-paper p-5 shadow-hard-sm sm:flex-row sm:gap-6">
                      <div role="img" aria-label={`QR code for booking ${b.code}`} className="grid size-32 shrink-0 grid-cols-8 grid-rows-8 gap-px border-[1.5px] border-ink bg-white p-2 shadow-[2px_2px_0_0_#111]">
                        {QR.join('')
                          .split('')
                          .map((c, k) => (
                            <span key={k} className={c === '1' ? 'bg-ink' : ''} />
                          ))}
                      </div>
                      <div className="text-center sm:text-left">
                        <p className="font-mono text-[10px] leading-[15px] tracking-[0.6px] text-muted uppercase">Booking code</p>
                        <p className="font-head text-2xl leading-8 tracking-[1.92px] text-ink">{b.code}</p>
                        <p className="pt-2 font-mono text-[10px] leading-[15px] tracking-[0.6px] text-muted uppercase">
                          PIN <span className="text-ink">{b.pin}</span>
                        </p>
                        <p className="mt-3 flex items-center justify-center gap-1.5 font-mono-b text-[10px] leading-[15px] tracking-[0.5px] text-moss uppercase sm:justify-start">
                          <img src={checkIcon} alt="" width={12} height={12} className="size-3" /> Reception can scan or key in the code
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {b.status === 'sent' && <RequestFlight sentAt={b.sentAt} onWithdraw={onWithdraw} />}

            {b.status === 'completed' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-5 text-ink">
                  Event wrapped · paid {b.amount}. {b.reviewed ? 'Thanks for reviewing!' : 'How did the space hold up?'}
                </p>
                {b.reviewed ? (
                  <button type="button" onClick={onBrowse} className={ghostBtn}>
                    Book again
                  </button>
                ) : (
                  <button type="button" onClick={onReview} className={flameBtn}>
                    Write a review
                  </button>
                )}
              </div>
            )}

            {muted && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-5 text-ink">{b.note ?? 'You withdrew this request. Nothing was charged.'}</p>
                <button type="button" onClick={onBrowse} className={`${ghostBtn} shrink-0`}>
                  Find similar spaces
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    </li>
  )
}

function ReviewCard({ r, i, onEdit, onHelpful, voted }: { r: Review; i: number; onEdit: () => void; onHelpful: () => void; voted: boolean }) {
  return (
    <li className={`${card} rise p-5 sm:p-6`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
      <article aria-label={`Your review of ${r.venue}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={r.img} alt="" className="size-12 shrink-0 border-[1.5px] border-ink object-cover" />
            <div className="min-w-0">
              <h3 className="truncate font-head text-base text-ink">{r.venue}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                <img src={pinIcon} alt="" width={12} height={12} className="size-3" />
                {r.area}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Stars value={r.rating} />
            <span className="font-mono text-[10px] text-muted">{r.when}</span>
          </div>
        </div>
        <p className="mt-3 inline-block rounded-full border border-ink px-2.5 py-0.5 font-body-sb text-[11px] text-ink">{r.eventType}</p>
        <p className="mt-3 text-sm leading-6 text-ink">{r.text}</p>
        {r.photos && (
          <ul className="mt-4 flex flex-wrap items-center gap-3" aria-label="Photos">
            {r.photos.map((p, k) => (
              <li key={k}>
                <img src={p} alt={`Photo ${k + 1} from ${r.venue}`} className="h-16 w-24 border-[1.5px] border-ink object-cover sm:h-20 sm:w-28" />
              </li>
            ))}
            <li className="text-xs text-muted">+3 Photos</li>
          </ul>
        )}
        <p className="mt-5 font-mono-b text-[10px] tracking-[0.6px] text-flame uppercase">What worked:</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {r.tags.map((t) => (
            <li key={t} className="rounded-full border border-ink bg-paper px-2.5 py-1 text-[11px] text-ink">
              ✓ {t}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <button type="button" onClick={onHelpful} aria-pressed={voted} className={`flex min-h-9 items-center gap-1.5 px-1 text-xs transition-colors ${voted ? 'font-body-sb text-ink' : 'text-muted hover:text-ink'}`}>
            <span aria-hidden="true" className={voted ? 'anim-stamp inline-block' : ''}>
              👍
            </span>
            Helpful ({r.helpful + (voted ? 1 : 0)})
          </button>
          <button type="button" onClick={onEdit} className="press min-h-9 border border-ink bg-white px-3 font-body-sb text-xs text-ink shadow-[1px_1px_0_0_#111]">
            Edit review
          </button>
        </div>
      </article>
    </li>
  )
}

function ReviewForm({
  options,
  initial,
  onCancel,
  onSubmit,
}: {
  options: { venue: string; img: string; eventType: string }[]
  initial?: Review
  onCancel: () => void
  onSubmit: (r: { venue: string; img: string; eventType: string; rating: number; text: string; tags: string[] }) => void
}) {
  const [venue, setVenue] = useState(initial?.venue ?? options[0]?.venue ?? '')
  const [rating, setRating] = useState(initial?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState(initial?.text ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [err, setErr] = useState<{ rating?: string; text?: string }>({})
  const id = useId()
  const labels = ['Poor', 'Fair', 'Good', 'Great', 'Outstanding']

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof err = {}
    if (!rating) next.rating = 'Pick a star rating.'
    if (text.trim().length < 20) next.text = `Add a little more detail — at least 20 characters (${text.trim().length}/20).`
    setErr(next)
    if (next.rating) return document.getElementById(`${id}-r1`)?.focus()
    if (next.text) return document.getElementById(`${id}-t`)?.focus()
    const o = options.find((x) => x.venue === venue) ?? { venue, img: initial!.img, eventType: initial!.eventType }
    onSubmit({ ...o, rating, text: text.trim(), tags })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {!initial && (
        <div>
          <label htmlFor={`${id}-v`} className={`${mono} text-ink`}>
            Venue
          </label>
          <select id={`${id}-v`} value={venue} onChange={(e) => setVenue(e.target.value)} className="mt-2 min-h-11 w-full border-[1.5px] border-ink bg-paper px-3 text-sm text-ink">
            {options.map((o) => (
              <option key={o.venue}>{o.venue}</option>
            ))}
          </select>
        </div>
      )}
      <fieldset aria-describedby={err.rating ? `${id}-re` : undefined}>
        <legend className={`${mono} text-ink`}>Your rating</legend>
        <div className="mt-2 flex items-center gap-3" onMouseLeave={() => setHover(0)}>
          <div className="flex">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} onMouseEnter={() => setHover(n)} className="cursor-pointer p-1">
                <input id={`${id}-r${n}`} type="radio" name={`${id}-rating`} value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
                <span className="block rounded-sm transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-flame hover:scale-110">
                  <Star className={`size-7 transition-colors ${n <= (hover || rating) ? 'text-flame' : 'text-line'}`} />
                </span>
                <span className="sr-only">
                  {n} star{n > 1 ? 's' : ''}, {labels[n - 1]}
                </span>
              </label>
            ))}
          </div>
          <span aria-hidden="true" className="font-body-m text-sm text-muted">
            {labels[(hover || rating) - 1] ?? ''}
          </span>
        </div>
        {err.rating && (
          <FieldError id={`${id}-re`} className="mt-1">
            {err.rating}
          </FieldError>
        )}
      </fieldset>
      <div>
        <label htmlFor={`${id}-t`} className={`${mono} text-ink`}>
          Your review
        </label>
        <textarea
          id={`${id}-t`}
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-invalid={!!err.text}
          aria-describedby={`${id}-th${err.text ? ` ${id}-te` : ''}`}
          placeholder="What worked, what didn't, and what should the next organiser know?"
          className={`mt-2 w-full resize-y border-[1.5px] bg-paper p-3 text-sm leading-6 text-ink placeholder:text-muted/80 ${err.text ? 'border-danger bg-danger-tint' : 'border-ink'}`}
        />
        <p id={`${id}-th`} className="mt-1 text-right font-mono text-[10px] text-muted">
          {text.trim().length} characters
        </p>
        {err.text && (
          <FieldError id={`${id}-te`}>{err.text}</FieldError>
        )}
      </div>
      <fieldset>
        <legend className={`${mono} text-flame`}>What worked? (optional)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {REVIEW_TAGS.map((t) => {
            const on = tags.includes(t)
            return (
              <label key={t} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-flame ${on ? 'border-ink bg-ink text-white' : 'border-ink bg-white text-ink hover:bg-sand'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} />
                {on ? '✓ ' : '+ '}
                {t}
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onCancel} className={ghostBtn}>
          Cancel
        </button>
        <button type="submit" className={flameBtn}>
          {initial ? 'Save review' : 'Publish review'}
        </button>
      </div>
    </form>
  )
}

export default function MyBookings({
  profile,
  bookings,
  setBookings,
  reviews,
  setReviews,
  onSaveProfile,
  onAuth,
  onExplore,
  onHome,
  onLogout,
}: {
  profile: Profile | null
  bookings: Booking[]
  setBookings: (fn: (b: Booking[]) => Booking[]) => void
  reviews: Review[]
  setReviews: (fn: (r: Review[]) => Review[]) => void
  onSaveProfile: (p: Profile) => void
  onAuth: () => void
  onExplore: () => void
  onHome: () => void
  onLogout?: () => void
}) {
  const [tab, setTab] = useState<Tab>('upcoming')
  const [photo, setPhoto] = useState<string | null>(loadPhoto)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [paying, setPaying] = useState<Booking | null>(null)
  const [payBusy, setPayBusy] = useState(false)
  const [withdrawing, setWithdrawing] = useState<Booking | null>(null)
  const [reviewing, setReviewing] = useState<{ edit?: Review; forBooking?: Booking } | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [voted, setVoted] = useState<string[]>([])
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  const toast = (msg: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }

  const savePhoto = (src: string | null) => {
    setPhoto(src)
    try {
      localStorage.setItem(PHOTO_KEY, src ?? '')
    } catch {
      /* storage full — keep in memory only */
    }
  }

  const upcoming = bookings.filter((b) => ['due', 'confirmed', 'sent'].includes(b.status))
  const past = bookings.filter((b) => b.status === 'completed')
  const declined = bookings.filter((b) => b.status === 'declined' || b.status === 'withdrawn')
  const tabs: [Tab, string, number][] = [
    ['upcoming', 'Upcoming', upcoming.length],
    ['past', 'Past', past.length],
    ['declined', 'Declined', declined.length],
    ['for-you', 'Reviews for you', hostReviews.length],
    ['yours', 'Your reviews', reviews.length],
  ]
  const reviewOptions = past.map((b) => ({ venue: b.venue, img: b.img, eventType: b.eventType }))
  const extraOptions = [
    { venue: 'Time Cafe and Spaces', img: bookings[0]?.img ?? '', eventType: 'Tech Meetup' },
  ].filter((o) => !reviewOptions.some((x) => x.venue === o.venue))
  const next = bookings.find((b) => b.status === 'confirmed' || b.status === 'due')
  const isReviewTab = tab === 'for-you' || tab === 'yours'

  const onTabKey = (e: React.KeyboardEvent, idx: number) => {
    const map: Record<string, number> = { ArrowRight: idx + 1, ArrowLeft: idx - 1, Home: 0, End: tabs.length - 1 }
    if (!(e.key in map)) return
    e.preventDefault()
    const t = tabs[(map[e.key] + tabs.length) % tabs.length][0]
    setTab(t)
    tabRefs.current[t]?.focus()
  }

  const confirmPay = () => {
    if (!paying) return
    setPayBusy(true)
    setTimeout(() => {
      const code = `TC-${Math.floor(1000 + Math.random() * 9000)}`
      setBookings((bs) => bs.map((b) => (b.id === paying.id ? { ...b, status: 'confirmed', code, pin: Math.random().toString(36).slice(2, 8).toUpperCase() } : b)))
      setPayBusy(false)
      setPaying(null)
      toast(`Payment received. ${paying.venue} is confirmed — your pass is ready.`)
    }, 1300)
  }

  const submitReview = (r: { venue: string; img: string; eventType: string; rating: number; text: string; tags: string[] }) => {
    if (reviewing?.edit) {
      const id = reviewing.edit.id
      setReviews((rs) => rs.map((x) => (x.id === id ? { ...x, ...r, when: 'Edited just now' } : x)))
      toast('Review updated.')
    } else {
      setReviews((rs) => [{ id: `r${Date.now()}`, area: 'Chennai', when: 'Just now', helpful: 0, ...r }, ...rs])
      setBookings((bs) => bs.map((b) => (b.venue === r.venue && b.status === 'completed' ? { ...b, reviewed: true } : b)))
      setBanner(r.venue)
      setTab('yours')
    }
    setReviewing(null)
  }

  const header = (
    <>
      <a href="#bookings-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <nav aria-label="Main" className="mx-auto flex max-w-[1152px] items-center justify-between gap-4 px-5 py-4 md:px-8">
          <button type="button" onClick={onHome} aria-label="SCENE/044 home" className="font-mono-b text-sm leading-5 tracking-[2.52px]">
            SCENE<span className="text-flame">/044</span>
          </button>
          <ul className="hidden items-center gap-8 lg:flex">
            {['How it works', 'Spaces', 'Why SCENE', 'For hosts'].map((l) => (
              <li key={l}>
                <button type="button" onClick={onHome} className="text-sm leading-5 text-muted transition-colors hover:text-ink">
                  {l}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-1 sm:gap-3">
            <a href="#/bookings" aria-current="page" className="hidden rounded-full bg-sand px-4 py-2 font-body-m text-sm leading-5 text-ink sm:block">
              Your bookings
            </a>
            <button type="button" onClick={onAuth} className="hidden rounded-full px-4 py-2 font-body-m text-sm leading-5 text-ink hover:bg-sand md:block">
              {profile ? `Hi, ${profile.name.split(' ')[0]}` : 'Host sign in'}
            </button>
            <button type="button" onClick={onExplore} className="press flex items-center gap-1.5 rounded-md border-[1.5px] border-ink bg-flame px-4 py-2 font-body-sb text-sm leading-5 text-white shadow-hard-sm">
              Explore venues <img src={arrowWhite} alt="" width={16} height={16} className="size-4" />
            </button>
          </div>
        </nav>
      </header>
    </>
  )

  const footer = (
    <footer className="border-t border-line bg-paper-2">
      <div className="mx-auto grid max-w-[1152px] gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr] md:px-8">
        <div>
          <p className="font-mono-b text-sm tracking-[2.52px]">
            SCENE<span className="text-flame">/044</span>
          </p>
          <p className="mt-3 max-w-[260px] text-sm leading-6 text-muted">Curated event spaces in Chennai. Book with clarity, host with calm.</p>
        </div>
        {[
          ['Organisers', ['Explore venues', 'How booking works', 'My bookings', 'Pricing']],
          ['Hosts', ['List your venue', 'Host dashboard', 'Check-in tools', 'Payouts']],
          ['SCENE/044', ['About', 'Events', 'Contact', 'Help centre']],
        ].map(([h, links]) => (
          <nav key={h as string} aria-label={`${h} links`}>
            <h2 className="font-mono-b text-[11px] tracking-[1.32px] uppercase">{h}</h2>
            <ul className="mt-4 space-y-2.5">
              {(links as string[]).map((l) => (
                <li key={l}>
                  <a href={l === 'My bookings' ? '#/bookings' : '#'} onClick={l === 'Explore venues' ? (e) => (e.preventDefault(), onExplore()) : undefined} className="text-sm text-muted transition-colors hover:text-ink">
                    {l}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1152px] flex-wrap justify-between gap-3 border-t border-line px-5 py-6 text-sm text-muted md:px-8">
        <p>© 2026 SCENE/044. Made in Chennai.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-ink">Privacy</a>
          <a href="#" className="hover:text-ink">Terms</a>
        </div>
      </div>
    </footer>
  )

  if (!profile) {
    return (
      <div className="min-h-dvh bg-paper">
        {header}
        <main id="bookings-main" className="mx-auto max-w-[768px] px-5 pb-24 pt-10 md:px-8">
          <p className="font-mono-b text-xs tracking-[1.44px] text-flame uppercase">Your account</p>
          <h1 className="mt-1 font-head text-3xl uppercase sm:text-4xl">Your bookings</h1>
          <div className="mt-8">
            <Empty
              icon={<span className="font-head text-xl">→</span>}
              title="Sign in to see your bookings"
              body="We'll send a one-time code to your phone. Your requests, passes and reviews will be right here."
              cta="Sign in"
              onCta={onAuth}
            />
          </div>
        </main>
        {footer}
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-paper">
      {header}
      <main id="bookings-main" className="mx-auto flex max-w-[768px] flex-col gap-3 px-5 pb-20 pt-8 md:px-8">
        <div className="rise flex flex-col gap-1">
          <p className="font-mono-b text-xs leading-4 tracking-[1.44px] text-flame uppercase">Your account</p>
          <h1 className="font-head text-3xl leading-[45px] text-ink uppercase sm:text-4xl">Your Profile</h1>
          <p className="text-sm leading-5 text-muted">Keep your organiser profile complete and up to date</p>
        </div>

        <div className="py-8">
          <ProfileCard
            profile={profile}
            photo={photo}
            stats={{ events: 12 + past.length - 1, rating: '4.9', next: next ? `${next.date.replace(' 2026', '')} · ${next.venue}` : 'Nothing scheduled' }}
            onSave={onSaveProfile}
            onPhoto={savePhoto}
            toast={toast}
            onLogout={onLogout}
          />
        </div>

        <section aria-labelledby="bookings-title">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono-b text-xs leading-4 tracking-[1.44px] text-flame uppercase">Your account</p>
              <h2 id="bookings-title" className="mt-1 font-head text-[28px] leading-9 text-ink">
                {isReviewTab ? (tab === 'yours' ? 'Your reviews' : 'Reviews for you') : 'Your bookings'}
              </h2>
              <p className="mt-1 text-sm leading-5 text-muted">
                {tab === 'yours'
                  ? 'Spaces you have experienced and things worth sharing.'
                  : tab === 'for-you'
                    ? 'What hosts said about hosting you.'
                    : 'Track every request from sent to done. You only pay once a host approves.'}
              </p>
            </div>
            {tab === 'yours' && reviews.length > 0 && (
              <button type="button" onClick={() => setReviewing({})} className={flameBtn}>
                + Write a review
              </button>
            )}
          </div>

          {banner && tab === 'yours' && (
            <div role="status" className="anim-pop mt-5 flex items-center gap-3 border-[1.5px] border-moss bg-moss/5 px-4 py-3 shadow-[2px_2px_0_0_#137e55]">
              <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-moss text-xs text-white">
                ✓
              </span>
              <p className="flex-1 text-sm text-ink">
                Your review for <strong className="font-body-sb">{banner}</strong> is now live.
              </p>
              <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss message" className="grid size-8 place-items-center hover:bg-moss/10">
                <Close className="size-4" />
              </button>
            </div>
          )}

          <div role="tablist" aria-label="Bookings and reviews" className="-mx-5 mt-6 flex gap-2 overflow-x-auto border-b border-line px-5 [scrollbar-width:none] md:mx-0 md:px-0">
            {tabs.map(([key, label, count], idx) => {
              const on = tab === key
              return (
                <button
                  key={key}
                  ref={(el) => {
                    tabRefs.current[key] = el
                  }}
                  role="tab"
                  id={`tab-${key}`}
                  aria-selected={on}
                  aria-controls={`panel-${key}`}
                  tabIndex={on ? 0 : -1}
                  onClick={() => setTab(key)}
                  onKeyDown={(e) => onTabKey(e, idx)}
                  className={`relative flex min-h-10 shrink-0 items-center gap-2 px-1.5 pb-3 pt-1 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase transition-colors ${on ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {label}
                  <span className={`min-w-4 px-1 text-center text-[9px] leading-3 ${on ? 'bg-flame text-white' : 'bg-line text-muted'}`}>{count}</span>
                  <span aria-hidden="true" className={`absolute inset-x-0 -bottom-px h-0.5 origin-left bg-flame transition-transform duration-300 ${on ? 'scale-x-100' : 'scale-x-0'}`} />
                </button>
              )
            })}
          </div>

          <div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} tabIndex={0} className="anim-fade pt-6 outline-none">
            {tab === 'upcoming' &&
              (upcoming.length ? (
                <ul className="flex flex-col gap-5">
                  {upcoming.map((b, i) => (
                    <BookingCard key={b.id} b={b} i={i} onPay={() => setPaying(b)} onWithdraw={() => setWithdrawing(b)} onReview={() => {}} onBrowse={onExplore} />
                  ))}
                </ul>
              ) : (
                <Empty title="No Bookings yet." body="Discover venues, book a space for your event, and come back here to track everything in one place." cta="Explore venues" onCta={onExplore} />
              ))}

            {tab === 'past' &&
              (past.length ? (
                <ul className="flex flex-col gap-5">
                  {past.map((b, i) => (
                    <BookingCard key={b.id} b={b} i={i} onPay={() => {}} onWithdraw={() => {}} onReview={() => setReviewing({ forBooking: b })} onBrowse={onExplore} />
                  ))}
                </ul>
              ) : (
                <Empty title="No past events yet." body="Once an event wraps, you'll find it here with a nudge to review the space." cta="Explore venues" onCta={onExplore} />
              ))}

            {tab === 'declined' &&
              (declined.length ? (
                <ul className="flex flex-col gap-5">
                  {declined.map((b, i) => (
                    <BookingCard key={b.id} b={b} i={i} onPay={() => {}} onWithdraw={() => {}} onReview={() => {}} onBrowse={onExplore} />
                  ))}
                </ul>
              ) : (
                <Empty title="Nothing declined." body="Every request you've sent has been accepted or is still with the host." cta="Explore venues" onCta={onExplore} />
              ))}

            {tab === 'for-you' && !hostReviews.length && (
              <Empty title="Your reviews will live here" body="Once you organize an event, venue hosts can share their experience working with you." cta="Explore venues" onCta={onExplore} />
            )}

            {tab === 'for-you' && hostReviews.length > 0 && (
              <ul className="flex flex-col gap-5">
                {hostReviews.map((h, i) => (
                  <li key={h.id} className={`${card} rise p-5 sm:p-6`} style={{ '--d': `${i * 70}ms` } as React.CSSProperties}>
                    <article aria-label={`Review from ${h.host}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-full border-[1.5px] border-ink bg-sand font-head text-sm">
                            {h.host[0]}
                          </span>
                          <div>
                            <h3 className="font-head text-base text-ink">{h.host}</h3>
                            <p className={`${mono} mt-0.5 text-flame`}>{h.venue}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Stars value={h.rating} />
                          <span className="font-mono text-[10px] text-muted">{h.when}</span>
                        </div>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-ink">“{h.text}”</p>
                      <ul className="mt-4 flex flex-wrap gap-2">
                        {h.tags.map((t) => (
                          <li key={t} className="rounded-full border border-ink bg-paper px-2.5 py-1 text-[11px] text-ink">
                            ✓ {t}
                          </li>
                        ))}
                      </ul>
                    </article>
                  </li>
                ))}
              </ul>
            )}

            {tab === 'yours' &&
              (reviews.length ? (
                <ul className="flex flex-col gap-5">
                  {reviews.map((r, i) => (
                    <ReviewCard key={r.id} r={r} i={i} voted={voted.includes(r.id)} onHelpful={() => setVoted((v) => (v.includes(r.id) ? v.filter((x) => x !== r.id) : [...v, r.id]))} onEdit={() => setReviewing({ edit: r })} />
                  ))}
                </ul>
              ) : (
                <Empty
                  title="Nothing here yet."
                  body="Tell other organisers what worked, what didn’t, and what they should know about the space."
                  cta={reviewOptions.length ? 'Write a review' : 'Explore venues'}
                  onCta={reviewOptions.length ? () => setReviewing({}) : onExplore}
                />
              ))}
          </div>

          {!isReviewTab && (
            <button type="button" onClick={onExplore} className="group mt-8 flex min-h-10 items-center gap-2 font-mono-b text-[10px] tracking-[0.6px] text-muted uppercase hover:text-ink">
              Browse more Chennai spaces <img src={browseArrow} alt="" width={12} height={12} className="size-3 transition-transform group-hover:translate-x-1" />
            </button>
          )}
        </section>
      </main>
      {footer}

      {paying && (
        <Dialog size="sm" title="Confirm & pay" description={`${paying.venue} · ${paying.space}`} onClose={() => !payBusy && setPaying(null)}>
          <dl className="divide-y divide-line border-[1.5px] border-ink bg-paper text-sm">
            {[
              ['Date', paying.date],
              ['Time', paying.time],
              ['Guests', paying.guests],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-body-m">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between px-4 py-3">
              <dt className="font-body-sb">Total</dt>
              <dd className="font-head text-lg">{paying.amount}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted">Free cancellation up to 48 hours before your event. This is a demo — no real payment is taken.</p>
          <button type="button" data-autofocus onClick={confirmPay} disabled={payBusy} aria-busy={payBusy} className={`${flameBtn} mt-5 w-full py-3`}>
            {payBusy ? 'Processing payment…' : `Pay ${paying.amount}`}
          </button>
        </Dialog>
      )}

      {withdrawing && (
        <Dialog size="sm" title="Withdraw this request?" description={`The host at ${withdrawing.venue} will be notified. Nothing has been charged.`} onClose={() => setWithdrawing(null)}>
          <div className="flex justify-end gap-2">
            <button type="button" data-autofocus onClick={() => setWithdrawing(null)} className={ghostBtn}>
              Keep request
            </button>
            <button
              type="button"
              onClick={() => {
                setBookings((bs) => bs.map((b) => (b.id === withdrawing.id ? { ...b, status: 'withdrawn' } : b)))
                toast(`Request to ${withdrawing.venue} withdrawn.`)
                setWithdrawing(null)
              }}
              className={flameBtn}
            >
              Withdraw
            </button>
          </div>
        </Dialog>
      )}

      {reviewing && !reviewing.edit && profile && (() => {
        const o = reviewing.forBooking ?? [...reviewOptions, ...extraOptions][0]
        return (
          <ReviewFlow
            role="organiser"
            defaultName={profile.name}
            subject={o.venue}
            avatar={photo}
            onClose={() => setReviewing(null)}
            onSubmit={(r) => {
              setReviews((rs) => [
                {
                  id: `r${Date.now()}`,
                  area: 'Chennai',
                  when: 'Just now',
                  helpful: 0,
                  venue: o.venue,
                  img: o.img,
                  eventType: r.eventType,
                  rating: r.workedWell ? 5 : 3,
                  text: r.text || (r.workedWell ? 'The space worked really well for our event.' : 'A few things to plan for next time.'),
                  tags: Object.entries(r.aspects).filter(([, v]) => v).map(([k]) => k),
                  photos: r.photos,
                },
                ...rs,
              ])
              setBookings((bs) => bs.map((b) => (b.venue === o.venue && b.status === 'completed' ? { ...b, reviewed: true } : b)))
            }}
            onViewReview={() => {
              setReviewing(null)
              setBanner(o.venue)
              setTab('yours')
            }}
          />
        )
      })()}

      {reviewing?.edit && (
        <Dialog title={reviewing.edit ? `Edit review · ${reviewing.edit.venue}` : 'Write a review'} description="Honest, specific notes help other organisers pick the right space." onClose={() => setReviewing(null)}>
          <ReviewForm
            options={reviewing.forBooking ? [{ venue: reviewing.forBooking.venue, img: reviewing.forBooking.img, eventType: reviewing.forBooking.eventType }] : [...reviewOptions, ...extraOptions]}
            initial={reviewing.edit}
            onCancel={() => setReviewing(null)}
            onSubmit={submitReview}
          />
        </Dialog>
      )}

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="anim-pop pointer-events-auto flex max-w-md items-center gap-3 border-[1.5px] border-ink bg-ink px-4 py-3 text-sm text-white shadow-[3px_3px_0_0_#ff432a]">
            <span aria-hidden="true" className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] ${t.tone === 'ok' ? 'bg-moss' : 'bg-danger'}`}>
              {t.tone === 'ok' ? '✓' : '!'}
            </span>
            {t.msg}
            <button type="button" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} aria-label="Dismiss notification" className="-mr-1 grid size-7 place-items-center text-white/70 hover:text-white">
              <Close className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
