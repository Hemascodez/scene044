"use client";

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import FieldError from './FieldError'
import { ArrowRight, Check, Close, Phone, Search } from './icons'

export type Profile = { name: string; phone: string; role: 'Organiser' | 'Host'; venue?: string; email?: string }

const VENUES = ['Time Cafe']
const RESEND_SECS = 60

type Step = 'details' | 'otp' | 'verified'

const label = 'font-mono-b text-[10px] leading-[15px] tracking-[0.8px] uppercase text-stone'
const field =
  'w-full bg-transparent font-body-m text-sm text-ink placeholder:text-stone/50 focus:outline-none'

export default function AuthModal({
  open,
  saved,
  onClose,
  onVerified,
  submitting = false,
  initialRole,
}: {
  open: boolean
  saved: Profile | null
  onClose: () => void
  onVerified: (p: Profile) => void
  /** True when auth was triggered mid-booking, so a request is sent after verifying. */
  submitting?: boolean
  initialRole?: Profile['role']
}) {
  const [step, setStep] = useState<Step>('details')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendError, setSendError] = useState('')
  const [role, setRole] = useState<Profile['role']>('Organiser')
  const [venue, setVenue] = useState<string | undefined>()
  const [query, setQuery] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [secs, setSecs] = useState(RESEND_SECS)

  const panel = useRef<HTMLDivElement>(null)
  const venueBox = useRef<HTMLFieldSetElement>(null)
  const otpRefs = useRef<(HTMLInputElement | null)[]>([])
  const lastFocus = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descId = useId()

  // Reset + auto-fill returning users each time the dialog opens
  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement as HTMLElement
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the dialog resets and auto-fills each time it opens; this is the open transition itself
    setStep('details')
    setName(saved?.name ?? '')
    setPhone(saved?.phone ?? '')
    setEmail(saved?.email ?? '')
    setSendError('')
    setBusy(false)
    setRole(initialRole ?? saved?.role ?? 'Organiser')
    setVenue(initialRole === 'Host' ? 'Time Cafe' : saved?.venue)
    setQuery('')
    setDigits(Array(6).fill(''))
    setError('')
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
      lastFocus.current?.focus()
    }
  }, [open, saved, initialRole])

  // Move focus into the dialog on each step
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      if (step === 'otp') otpRefs.current[0]?.focus()
      else if (step === 'details') {
        const target = panel.current?.querySelector<HTMLElement>(saved ? '[data-autofocus-returning]' : 'input')
        target?.focus()
      } else panel.current?.querySelector<HTMLElement>('[data-close]')?.focus()
    }, 60)
    return () => clearTimeout(t)
  }, [open, step, saved])

  // Resend countdown
  useEffect(() => {
    if (step !== 'otp' || secs <= 0) return
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [step, secs])

  const phoneDigits = phone.replace(/\D/g, '')
  // The booking API needs an email for organisers, so it is collected here too.
  const emailOk = /^\S+@\S+\.\S+$/.test(email.trim())
  const valid = name.trim().length >= 2 && phoneDigits.length === 10 && (role === 'Organiser' ? emailOk : !!venue)
  const code = digits.join('')
  const firstName = name.trim().split(/\s+/)[0]
  const venues = useMemo(() => VENUES.filter((v) => v.toLowerCase().includes(query.toLowerCase())), [query])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
    if (e.key !== 'Tab' || !panel.current) return
    const els = panel.current.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    const first = els[0]
    const last = els[els.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  /** Real WhatsApp OTP (POST /api/whatsapp/send-otp). */
  const requestCode = async () => {
    const res = await fetch('/api/whatsapp/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: `+91${phoneDigits}`, role, venue }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.ok) throw new Error(data.error ?? 'Could not send a code right now. Try again shortly.')
  }

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setSendError('')
    try {
      await requestCode()
      setDigits(Array(6).fill(''))
      setError('')
      setSecs(RESEND_SECS)
      setStep('otp')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Could not send a code right now.')
    } finally {
      setBusy(false)
    }
  }

  /** Real verification (POST /api/whatsapp/verify-otp). */
  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length < 6 || busy) return
    setBusy(true)
    let verifiedProfile: Profile
    try {
      const res = await fetch('/api/whatsapp/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: `+91${phoneDigits}`, code, name: name.trim(), email: email.trim(), role, venue }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Incorrect code. Check WhatsApp and try again.')
        setShakeKey((k) => k + 1)
        return
      }
      verifiedProfile = data.profile as Profile
    } catch {
      setError('Could not verify right now. Try again shortly.')
      setShakeKey((k) => k + 1)
      return
    } finally {
      setBusy(false)
    }
    setStep('verified')
    setTimeout(() => onVerified(verifiedProfile), 2000)
  }

  const eyebrow = step === 'otp' ? 'Verify number' : step === 'verified' ? 'Verified' : role === 'Host' ? 'Host sign-in' : saved ? 'Welcome back' : 'Create account'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      onKeyDown={onKeyDown}
    >
      <div className="anim-fade absolute inset-0 bg-black/60 backdrop-blur-[8px]" onClick={onClose} aria-hidden="true" />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        key={step}
        className="anim-pop relative min-h-0 max-h-[92dvh] w-full overflow-y-auto overscroll-y-contain border-[1.5px] border-ink bg-paper shadow-hard-lg sm:max-h-[calc(100dvh-3rem)] sm:max-w-[384px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper px-5 py-4">
          <p className="font-mono-b text-[11px] leading-[16.5px] tracking-[1.32px] uppercase text-flame">{eyebrow}</p>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close sign-up"
            className="grid size-8 place-items-center text-ink transition-transform hover:rotate-90"
          >
            <Close className="size-[18px]" />
          </button>
        </div>

        {step === 'details' && (
          <form onSubmit={sendOtp} noValidate className="px-5 pt-6">
            <h2 id={titleId} className="font-head text-2xl leading-[30px]">
              {role === 'Host' ? 'Sign in to Time Cafe' : saved ? `Good to see you, ${saved.name.split(' ')[0]}` : 'Join to request a booking'}
            </h2>
            <p id={descId} className="mt-2 text-sm leading-[22.75px] text-stone">
              {role === 'Host' ? 'Your number must be approved by the Time Cafe admin. We’ll send a WhatsApp code to verify it.' : saved
                ? "We've filled in your details from last time. Confirm and we'll send a fresh code to your WhatsApp."
                : "We'll send a one-time code to your WhatsApp to verify your number."}
            </p>

            <div className="mt-6 border-[1.5px] border-ink shadow-hard-sm">
              <label className="flex flex-col gap-1 border-b border-ink p-3 transition-colors focus-within:bg-paper-2">
                <span className={label}>Your name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Aravind Kumar"
                  autoComplete="name"
                  required
                  className={`${field} ${saved && name === saved.name ? 'bg-[#e8f0fe]' : ''} h-5 px-0`}
                />
              </label>
              {role === 'Organiser' && (
                <label className="flex flex-col gap-1 border-b border-ink p-3 transition-colors focus-within:bg-paper-2">
                  <span className={label}>Email</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    className={`${field} ${saved && email === saved.email ? 'bg-[#e8f0fe]' : ''} h-5 px-0`}
                  />
                </label>
              )}
              <label className="flex flex-col gap-1 border-b border-ink p-3 transition-colors focus-within:bg-paper-2">
                <span className={label}>Mobile number</span>
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 font-body-m text-sm text-stone">
                    <Phone className="size-3.5" />
                    +91
                  </span>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, '').slice(0, 11))}
                    placeholder="98765 43210"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    required
                    aria-describedby="phone-hint"
                    className={`${field} ${saved && phoneDigits === saved.phone ? 'bg-[#e8f0fe]' : ''} h-5`}
                  />
                </span>
              </label>

              <fieldset className={`p-3 ${role === 'Host' ? 'border-b border-ink' : ''}`}>
                <legend className={`${label} float-left mb-2 w-full`}>Select category</legend>
                <div className="clear-left flex gap-4" role="radiogroup" aria-label="Select category">
                  {(['Organiser', 'Host'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      role="radio"
                      aria-checked={role === r}
                      data-autofocus-returning={role === r ? '' : undefined}
                      onClick={() => {
                        setRole(r)
                        if (r === 'Host') setTimeout(() => venueBox.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
                      }}
                      className={`rounded-[4px] border border-[#111] px-3.5 py-2 font-semi text-[11px] transition-colors duration-200 ${
                        role === r ? 'bg-flame text-white' : 'bg-white text-ink hover:bg-paper-2'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </fieldset>

              {role === 'Host' && (
                <fieldset ref={venueBox} className="rise scroll-mb-28 p-3">
                  <legend className={`${label} float-left mb-2 w-full`}>Choose your venue</legend>
                  <label className="clear-left flex items-center gap-3 border-[1.5px] border-ink p-3 shadow-hard-sm focus-within:bg-paper-2">
                    <Search className="size-4 text-stone" />
                    <span className="sr-only">Search for venues</span>
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search for venues…"
                      className={field}
                    />
                  </label>
                  <div className="space-y-2 pt-4" role="radiogroup" aria-label="Venues">
                    {venues.length === 0 && <p className="text-sm text-stone">No venues match “{query}”.</p>}
                    {venues.map((v) => (
                      <label key={v} className="flex cursor-pointer items-center gap-2.5 font-body-m text-sm text-stone">
                        <input
                          type="radio"
                          name="venue"
                          checked={venue === v}
                          onChange={() => {
                            setVenue(v)
                            setTimeout(() => panel.current?.scrollTo({ top: panel.current.scrollHeight, behavior: 'smooth' }), 120)
                          }}
                          className="peer sr-only"
                        />
                        <span
                          aria-hidden="true"
                          className="grid size-4 place-items-center border-[1.5px] border-ink bg-white shadow-[1px_1px_0_#111] peer-checked:[&>span]:scale-100 peer-focus-visible:outline-2 peer-focus-visible:outline-flame"
                        >
                          <span className="size-2 scale-0 bg-flame transition-transform duration-200" />
                        </span>
                        <span className="peer-checked:text-ink">{v}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>

            <div className="sticky bottom-0 -mx-5 mt-4 border-t border-line bg-paper px-5 pb-5 pt-3">
              <p id="phone-hint" className="text-xs leading-[19.5px] text-stone">
                You&apos;ll receive a 6-digit code on <span className="text-ink">WhatsApp</span>. Standard data rates may apply.
              </p>
              {sendError && <FieldError className="mt-2">{sendError}</FieldError>}
              <button
                type="submit"
                disabled={!valid || busy}
                aria-busy={busy}
                className="press mt-3 flex w-full items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-3.5 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase text-white shadow-hard-md transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? 'Sending…' : <>Send OTP on WhatsApp <ArrowRight /></>}
              </button>
            </div>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={verify} noValidate className="px-5 py-6">
            <h2 id={titleId} className="font-head text-2xl leading-[30px]">
              Enter the code
            </h2>
            <p id={descId} className="mt-2 text-sm leading-[22.75px] text-stone">
              We sent a 6-digit code to your WhatsApp at <span className="text-ink">+91 {phoneDigits}</span>.
            </p>
            <fieldset className="mt-6">
              <legend className="sr-only">6-digit verification code</legend>
              <div key={shakeKey} className={error ? 'anim-shake' : ''}>
                <input
                  ref={(el) => {
                    otpRefs.current[0] = el
                  }}
                  value={code}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '').slice(0, 6).split('')
                    setDigits([...clean, ...Array(6 - clean.length).fill('')])
                    setError('')
                  }}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="······"
                  aria-label="6-digit verification code"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'otp-error' : undefined}
                  className={`h-14 w-full border-[1.5px] bg-paper text-center font-head text-2xl tracking-[0.5em] transition-colors duration-150 placeholder:text-stone/40 focus:outline-none ${
                    error ? 'anim-shake border-danger bg-danger-tint text-danger' : 'border-ink focus:bg-paper-2'
                  }`}
                />
              </div>
            </fieldset>
            <div aria-live="assertive" className="min-h-[26px] pt-2">
              <FieldError id="otp-error" live={false}>
                {error}
              </FieldError>
            </div>
            <button
              type="submit"
              disabled={code.length < 6 || busy}
              aria-busy={busy}
              className="press mt-3 flex w-full items-center justify-center gap-2 border-[1.5px] border-ink bg-flame px-4 py-3.5 font-mono-b text-xs leading-4 tracking-[0.72px] uppercase text-white shadow-hard-md transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              Verify &amp; continue <ArrowRight />
            </button>
            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={() => setStep('details')}
                className="font-mono-b text-[10px] leading-[15px] tracking-[0.6px] uppercase text-stone underline hover:text-ink"
              >
                Change number
              </button>
              {secs > 0 ? (
                <p className="font-mono text-[10px] leading-[15px] tracking-[0.4px] uppercase text-stone" aria-live="polite">
                  Resend in {secs}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    setDigits(Array(6).fill(''))
                    setError('')
                    try {
                      await requestCode()
                      setSecs(RESEND_SECS)
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Could not resend the code.')
                    }
                    otpRefs.current[0]?.focus()
                  }}
                  className="font-mono-b text-[10px] leading-[15px] tracking-[0.6px] uppercase text-flame underline"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        {step === 'verified' && (
          <div className="flex min-h-[248px] flex-col items-center justify-center px-5 py-10 text-center" role="status">
            <span className="anim-stamp grid size-14 place-items-center border-[1.5px] border-ink bg-flame text-white shadow-hard-md">
              <Check className="size-7" strokeWidth={2.5} />
            </span>
            <h2 id={titleId} className="rise mt-6 font-head text-xl" style={{ '--d': '200ms' } as React.CSSProperties}>
              You&apos;re verified, {firstName}!
            </h2>
            <p id={descId} className="rise mt-2 text-sm text-stone" style={{ '--d': '300ms' } as React.CSSProperties}>
              {submitting ? 'Submitting your request now…' : 'Getting your profile ready…'}
            </p>
            <div className="mt-6 h-1 w-32 overflow-hidden bg-line" aria-hidden="true">
              <div className="h-full origin-left animate-[pv-grow_2s_linear_forwards] bg-ink" />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
