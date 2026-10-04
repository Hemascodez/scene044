import { useEffect, useState } from 'react'
import Landing from './components/Landing'
import VenueDetail from './components/VenueDetail'
import VenuePartner from './components/VenuePartner'
import MyBookings from './components/MyBookings'
import HostWorkspace from './components/HostWorkspace'
import AuthModal, { type Profile } from './components/AuthModal'
import type { BookingSummary } from './components/BookingConfirmation'
import { seedBookings, seedReviews, type Booking, type Review } from './components/bookingsData'

const KEY = 'scene044.profile'
const VENUE_HASH = '#/venue/time-cafe'
const BOOKINGS_HASH = '#/bookings'
const PARTNER_HASH = '#/list-venue'
const HOST_HASH = '#/host'

type View = 'home' | 'venue' | 'bookings' | 'partner' | 'host'
const viewFromHash = (): View =>
  window.location.hash === VENUE_HASH
    ? 'venue'
    : window.location.hash === BOOKINGS_HASH
    ? 'bookings'
    : window.location.hash === PARTNER_HASH
    ? 'partner'
    : window.location.hash === HOST_HASH
    ? 'host'
    : 'home'

const load = (): Profile | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null')
  } catch {
    return null
  }
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(load)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>(viewFromHash)
  const [pending, setPending] = useState(false)
  const [submitSignal, setSubmitSignal] = useState(0)
  const [bookings, setBookings] = useState<Booking[]>(seedBookings)
  const [reviews, setReviews] = useState<Review[]>(seedReviews)

  useEffect(() => {
    const sync = () => setView(viewFromHash())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  const go = (v: View) => {
    const hash =
      v === 'venue'
        ? VENUE_HASH
        : v === 'bookings'
        ? BOOKINGS_HASH
        : v === 'partner'
        ? PARTNER_HASH
        : v === 'host'
        ? HOST_HASH
        : ''
    window.history.pushState(null, '', hash || window.location.pathname)
    setView(v)
    window.scrollTo({ top: 0 })
  }
  const goHome = () => {
    if (view === 'venue' && window.location.hash === VENUE_HASH) window.history.back()
    else go('home')
  }
  const saveProfile = (p: Profile) => {
    localStorage.setItem(KEY, JSON.stringify(p))
    setProfile(p)
  }
  const [notice, setNotice] = useState('')
  const logout = () => {
    localStorage.removeItem(KEY)
    localStorage.removeItem('scene044.photo')
    localStorage.removeItem('scene044.hostLogo')
    setProfile(null)
    setOpen(false)
    go('home')
    setNotice("You're logged out. See you at the next one.")
    setTimeout(() => setNotice(''), 3500)
  }
  const addRequest = (s: BookingSummary) => {
    setBookings((bs) => [
      { id: `b${Date.now()}`, status: 'sent', sentAt: Date.now(), eventType: s.eventType, venue: 'Time Cafe & Spaces', space: s.space, img: s.image, date: s.date, time: s.window, guests: `${s.guests} people` },
      ...bs,
    ])
    go('bookings')
  }

  return (
    <>
      {view === 'venue' ? (
        <VenueDetail
          profile={profile}
          onAuth={() => {
            setPending(true)
            setOpen(true)
          }}
          onBack={goHome}
          onBookings={addRequest}
          submitSignal={submitSignal}
        />
      ) : view === 'partner' ? (
        <VenuePartner onHome={() => go('home')} />
      ) : view === 'host' ? (
        <HostWorkspace
          hostName={profile?.name || 'Priya'}
          profile={profile}
          onSaveProfile={saveProfile}
          onAuth={() => setOpen(true)}
          onExit={goHome}
          onLogout={logout}
        />
      ) : view === 'bookings' ? (
        <MyBookings
          profile={profile}
          bookings={bookings}
          setBookings={setBookings}
          reviews={reviews}
          setReviews={setReviews}
          onSaveProfile={saveProfile}
          onAuth={() => setOpen(true)}
          onExplore={() => go('venue')}
          onHome={() => go('home')}
          onLogout={logout}
        />
      ) : (
        <Landing
          userName={profile?.name ?? null}
          onAuth={() => setOpen(true)}
          onOpenVenue={() => go('venue')}
          onBookings={() => go('bookings')}
          onListVenue={() => go('partner')}
          onHostDashboard={() => go('host')}
        />
      )}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {notice && <p className="anim-pop border-[2.5px] border-ink bg-white px-5 py-3 font-body-sb text-sm text-ink shadow-hard">{notice}</p>}
      </div>
      <AuthModal
        open={open}
        saved={profile}
        submitting={pending && view === 'venue'}
        onClose={() => {
          setOpen(false)
          setPending(false)
        }}
        onVerified={(p) => {
          saveProfile(p)
          setOpen(false)
          if (p.role === 'Host') {
            go('host')
          } else if (pending && view === 'venue') {
            setSubmitSignal((n) => n + 1)
          }
          setPending(false)
        }}
      />
    </>
  )
}
