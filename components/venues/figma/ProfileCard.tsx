"use client";

import { useEffect, useId, useRef, useState } from 'react'
import FieldError from './FieldError'
import Dialog from './Dialog'
import { Close } from './icons'
import type { Profile } from './AuthModal'

const MAX_MB = 5
const btn =
  'press border-[1.5px] border-ink bg-white px-4 py-2.5 font-mono-b text-[10px] leading-[15px] tracking-[0.6px] text-ink uppercase shadow-hard-sm disabled:cursor-not-allowed disabled:border-line disabled:bg-sand disabled:text-stone/70 disabled:shadow-none'
const field = 'border-2 border-black bg-paper px-4 py-3'

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" className="size-7 text-flame" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 16l-4-4-4 4M12 12v9" />
    <path d="M20.4 18.4A5 5 0 0018 9h-1.3A8 8 0 103 16.3" />
  </svg>
)

const fmtPhone = (d: string) => (d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : d)

export default function ProfileCard({
  profile,
  photo,
  stats,
  onSave,
  onPhoto,
  toast,
  variant = 'organiser',
  onLogout,
}: {
  profile: Profile
  photo: string | null
  stats: { events: number; rating: string; next: string }
  onSave: (p: Profile) => void
  onPhoto: (src: string | null) => void
  toast: (msg: string, tone?: 'ok' | 'error') => void
  variant?: 'organiser' | 'host'
  onLogout?: () => void
}) {
  const host = variant === 'host'
  const noun = host ? 'logo' : 'photo'
  const [mode, setMode] = useState<'view' | 'edit' | 'upload'>('view')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(profile.phone)
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({})
  const [preview, setPreview] = useState<{ src: string; name: string } | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploadTitle = useRef<HTMLHeadingElement>(null)
  const ids = { name: useId(), phone: useId(), err: useId(), hint: useId() }
  const initials = profile.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  useEffect(() => {
    if (mode === 'upload') uploadTitle.current?.focus()
  }, [mode])

  const startEdit = () => {
    setName(profile.name)
    setPhone(profile.phone)
    setErrors({})
    setMode('edit')
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const digits = phone.replace(/\D/g, '').slice(-10)
    const next: typeof errors = {}
    if (name.trim().length < 2) next.name = 'Enter your full name.'
    if (digits.length !== 10) next.phone = 'Enter a 10-digit mobile number.'
    setErrors(next)
    if (next.name) return document.getElementById(ids.name)?.focus()
    if (next.phone) return document.getElementById(ids.phone)?.focus()
    onSave({ ...profile, name: name.trim(), phone: digits })
    setMode('view')
    toast('Profile details saved.')
  }

  const pick = (file?: File) => {
    if (!file) return
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setPreview(null)
      return setUploadError(`"${file.name}" isn't a supported image. Use JPG, PNG or WEBP.`)
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setPreview(null)
      return setUploadError(`That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please choose one under ${MAX_MB} MB.`)
    }
    setUploadError('')
    const r = new FileReader()
    r.onload = () => setPreview({ src: r.result as string, name: file.name })
    r.readAsDataURL(file)
  }

  const closeUpload = () => {
    setMode('view')
    setPreview(null)
    setUploadError('')
    setDrag(false)
  }

  const upload = () => {
    if (!preview) return setUploadError('Choose a photo first, then press Upload.')
    setBusy(true)
    setTimeout(() => {
      onPhoto(preview.src)
      setBusy(false)
      closeUpload()
      toast(host ? 'Venue logo uploaded successfully.' : 'Photo uploaded successfully.')
    }, 900)
  }

  return (
    <section aria-labelledby="profile-title" className="rise border-[2.5px] border-ink bg-white px-5 py-6 shadow-[2.148px_2.148px_0_0_#111,0_8px_24px_0_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="profile-title" className="font-head text-2xl text-[#111827]">
            Profile
          </h2>
          <p className="mt-1 text-sm leading-5 text-[#6b7280]">{host ? 'Keep your host profile and venue branding up to date.' : 'Keep your organiser profile complete and up to date.'}</p>
        </div>
        {mode === 'view' ? (
          <button type="button" onClick={startEdit} className={btn}>
            Edit profile
          </button>
        ) : (
          <button type="button" disabled className={btn}>
            Edit profile
          </button>
        )}
      </div>

      {mode === 'upload' ? (
        <div className="anim-fade mt-5">
          <div className="flex items-center justify-between">
            <h3 ref={uploadTitle} tabIndex={-1} className="font-body-sb text-sm text-ink outline-none">
              {host ? 'Upload venue logo' : 'Upload profile photo'}
            </h3>
            <button type="button" onClick={closeUpload} aria-label="Close upload" className="grid size-8 place-items-center hover:bg-sand">
              <Close className="size-4" />
            </button>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              pick(e.dataTransfer.files[0])
            }}
            className={`mt-3 flex flex-col items-center justify-center gap-2 border-[1.5px] border-dashed px-4 py-8 text-center transition-colors ${
              uploadError ? 'anim-shake border-danger bg-danger-tint' : drag ? 'border-flame bg-flame/5' : 'border-ink bg-paper'
            }`}
          >
            {preview ? (
              <>
                <img src={preview.src} alt={host ? 'Preview of your new venue logo' : 'Preview of your new profile photo'} className={`anim-stamp size-24 border-2 border-black object-cover ${host ? 'rounded-[14px] bg-white object-contain' : 'rounded-full'}`} />
                <p className="max-w-full truncate text-xs text-stone">{preview.name}</p>
                <button type="button" onClick={() => fileRef.current?.click()} className="min-h-8 font-body-sb text-xs underline underline-offset-4">
                  Choose a different photo
                </button>
              </>
            ) : (
              <>
                <UploadIcon />
                <p className="font-body-sb text-xs text-ink">Drag &amp; drop your photo here</p>
                <p className="text-[10px] text-stone">or</p>
                <button type="button" onClick={() => fileRef.current?.click()} aria-describedby={ids.hint} className="press min-h-8 border border-ink bg-white px-3 font-body-sb text-[10px] text-ink">
                  Browse files
                </button>
                <p id={ids.hint} className="text-[11px] text-stone">
                  JPG, PNG or WEBP · up to {MAX_MB} MB
                </p>
              </>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="mt-2 min-h-5">
            <FieldError>{uploadError}</FieldError>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={closeUpload} className="press min-h-9 border border-ink bg-white px-4 font-body-sb text-xs">
              Cancel
            </button>
            <button type="button" onClick={upload} disabled={busy} aria-busy={busy} className="press min-h-9 min-w-20 border border-ink bg-flame px-4 font-body-sb text-xs text-white disabled:opacity-70">
              {busy ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-start">
          <div className={`${field} flex flex-col gap-4 p-5 md:w-[254px] md:shrink-0`}>
            <h3 className="font-body-sb text-base text-[#111827]">{host ? 'Venue logo' : 'Profile picture'}</h3>
            <div className="flex flex-col items-center gap-3">
              <div className={`grid size-24 place-items-center overflow-hidden border-2 border-black ${host ? 'rounded-[14px] bg-white' : 'rounded-full bg-sand'}`}>
                {photo ? (
                  <img key={photo} src={photo} alt={host ? `${profile.venue || profile.name} logo` : `${profile.name}'s profile photo`} className="anim-fade size-full object-cover" />
                ) : (
                  <span aria-label={`No photo. Initials ${initials}`} className="font-head text-2xl text-stone">
                    {initials}
                  </span>
                )}
              </div>
              <div className="flex w-full gap-3 md:flex-col">
                <button type="button" onClick={() => setMode('upload')} className={`${btn} flex-1 text-sm leading-normal tracking-normal text-[#111827]`}>
                  {photo ? `Change ${noun}` : `Upload ${noun}`}
                </button>
                <button type="button" onClick={() => setConfirmRemove(true)} disabled={!photo} className={`${btn} flex-1 text-sm leading-normal tracking-normal text-[#111827]`}>
                  Remove
                </button>
              </div>
            </div>
          </div>

          {mode === 'edit' ? (
            <form onSubmit={save} noValidate className="anim-fade flex flex-1 flex-col gap-4" aria-label="Edit profile details">
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ['name', host ? 'Host name' : 'Full name', name, setName, 'name', 'text'],
                    ['phone', 'Phone number', phone, setPhone, 'tel', 'tel'],
                  ] as const
                ).map(([k, label, val, set, ac, type]) => (
                  <div key={k} className={`${field} flex flex-col gap-1 focus-within:shadow-hard-sm ${errors[k] ? 'border-danger bg-danger-tint' : ''}`}>
                    <label htmlFor={ids[k]} className="text-xs leading-[18px] text-[#6b7280]">
                      {label}
                    </label>
                    <input
                      id={ids[k]}
                      type={type}
                      autoComplete={ac}
                      inputMode={k === 'phone' ? 'numeric' : undefined}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                      aria-invalid={!!errors[k]}
                      aria-describedby={errors[k] ? `${ids[k]}-e` : undefined}
                      className="w-full bg-transparent font-semi text-sm text-[#111827] outline-none"
                    />
                    {errors[k] && (
                      <FieldError id={`${ids[k]}-e`} live={false}>
                        {errors[k]}
                      </FieldError>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone">Event stats update automatically after each booking.</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setMode('view')} className="press min-h-10 border-[1.5px] border-ink bg-white px-4 font-mono-b text-[11px] tracking-[0.6px] uppercase">
                  Cancel
                </button>
                <button type="submit" className="press min-h-10 border-[1.5px] border-ink bg-flame px-5 font-mono-b text-[11px] tracking-[0.6px] text-white uppercase shadow-hard-sm">
                  Save changes
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid flex-1 gap-4 sm:grid-cols-2">
              {[
                ...(host && profile.venue ? [['Venue', profile.venue]] : []),
                [host ? 'Host name' : 'Full name', profile.name],
                ['Phone number', fmtPhone(profile.phone)],
                [host ? 'Events hosted' : 'Events organised', String(stats.events)],
                ['Average rating', stats.rating],
              ].map(([k, v]) => (
                <div key={k} className={`${field} flex flex-col gap-1`}>
                  <dt className="text-xs leading-[18px] text-[#6b7280]">{k}</dt>
                  <dd className="truncate font-semi text-sm text-[#111827]">{v}</dd>
                </div>
              ))}
              <div className={`${field} flex flex-col gap-1 sm:col-span-2 sm:w-1/2 sm:min-w-[260px]`}>
                <dt className="text-xs leading-[18px] text-[#6b7280]">Next event</dt>
                <dd className="font-semi text-sm text-[#111827]">{stats.next}</dd>
              </div>
            </dl>
          )}
        </div>
      )}

      {onLogout && mode === 'view' && (
        <div className="mt-6 flex flex-col gap-3 border-t-2 border-dashed border-ink/25 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-body-sb text-sm text-ink">Log out of SCENE/044</h3>
            <p className="mt-0.5 text-xs leading-[18px] text-stone">
              {host ? 'Your venue, bookings and payouts stay safe. Log back in with your phone number.' : 'Your bookings and reviews stay safe. Log back in with your phone number.'}
            </p>
          </div>
          <button type="button" onClick={() => setConfirmLogout(true)} className={`${btn} inline-flex shrink-0 items-center justify-center gap-2 hover:border-flame hover:text-flame`}>
            <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="square" aria-hidden="true">
              <path d="M15 4H5v16h10M10 12h11M17 8l4 4-4 4" />
            </svg>
            Log out
          </button>
        </div>
      )}

      {confirmLogout && onLogout && (
        <Dialog size="sm" title="Log out?" description={`You're signed in as ${profile.name} (${fmtPhone(profile.phone)}). We'll send a fresh code when you log back in.`} onClose={() => !leaving && setConfirmLogout(false)}>
          <div className="flex justify-end gap-2">
            <button type="button" data-autofocus disabled={leaving} onClick={() => setConfirmLogout(false)} className="press min-h-10 border-[1.5px] border-ink bg-white px-4 font-mono-b text-[11px] tracking-[0.6px] uppercase disabled:opacity-50">
              Stay logged in
            </button>
            <button
              type="button"
              disabled={leaving}
              aria-busy={leaving}
              onClick={() => {
                setLeaving(true)
                setTimeout(onLogout, 600)
              }}
              className="press min-h-10 min-w-28 border-[1.5px] border-ink bg-flame px-4 font-mono-b text-[11px] tracking-[0.6px] text-white uppercase shadow-hard-sm disabled:opacity-80"
            >
              {leaving ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </Dialog>
      )}

      {confirmRemove && (
        <Dialog size="sm" title={host ? 'Remove venue logo?' : 'Remove profile photo?'} description={host ? 'Organisers will see your initials instead. You can upload a new logo any time.' : 'Hosts will see your initials instead. You can upload a new photo any time.'} onClose={() => setConfirmRemove(false)}>
          <div className="flex justify-end gap-2">
            <button type="button" data-autofocus onClick={() => setConfirmRemove(false)} className="press min-h-10 border-[1.5px] border-ink bg-white px-4 font-mono-b text-[11px] tracking-[0.6px] uppercase">
              Keep photo
            </button>
            <button
              type="button"
              onClick={() => {
                onPhoto(null)
                setConfirmRemove(false)
                toast(host ? 'Venue logo removed.' : 'Photo removed successfully.')
              }}
              className="press min-h-10 border-[1.5px] border-ink bg-flame px-4 font-mono-b text-[11px] tracking-[0.6px] text-white uppercase shadow-hard-sm"
            >
              Remove photo
            </button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
