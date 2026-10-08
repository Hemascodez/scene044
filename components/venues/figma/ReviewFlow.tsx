"use client";

import { useEffect, useId, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'

const thumbDown = '/venues/figma/review-flow-55f52.svg'
const thumbUp = '/venues/figma/review-flow-76d85.svg'
const handshake = '/venues/figma/review-flow-b8698.png'
const uploadIcon = '/venues/figma/review-flow-1fb95.svg'
const xIcon = '/venues/figma/review-flow-88dd8.svg'
const plusIcon = '/venues/figma/review-flow-f5c51.svg'
const confetti = '/venues/figma/review-flow-77193.png'
const reviewPublishedAnimation = '/venues/figma/review-flow-review-published.mp4'

export type ReviewRole = 'organiser' | 'host'
export type ReviewResult = {
  name: string
  eventType: string
  workedWell: boolean
  aspects: Record<string, boolean | null>
  text: string
  photos: string[]
}

const COPY = {
  organiser: {
    nameLabel: 'Your name',
    eventLabel: 'Event organised',
    events: ['Meetup', 'Product launch', 'Workshop', 'Networking', 'Interview', 'Other'],
    overall: 'Overall experience',
    aspectsLabel: 'How did the space perform?',
    aspects: ['Cleanliness of the venue', 'Seating & layout', 'AV equipment & Wi-Fi', 'Setup & coordination', 'Food & refreshments', 'Host team and support'],
    textLabel: 'How did it go?',
    placeholder: 'Tell us what worked well, what could be better, or anything other organisers should know.',
    photosLabel: 'Add event photos',
    photosHint: 'At least one photo from your event is required.',
    role: 'Organiser',
    successBody: 'Your review is now live and will help other organisers choose the right space for their event.',
    back: 'Back to spaces',
    footnote: 'Your verified feedback helps other event organisers make informed decisions.',
  },
  host: {
    nameLabel: 'Organiser you hosted',
    eventLabel: 'Event hosted',
    events: ['Meetup', 'Product launch', 'Workshop', 'Networking', 'Interview', 'Other'],
    overall: 'Overall, how was the organiser?',
    aspectsLabel: 'How did the organiser do?',
    aspects: ['Communication before the event', 'Arrived and left on time', 'Guest count matched the booking', 'Respected house rules', 'Left the space tidy', 'Payments and paperwork'],
    textLabel: 'How did it go?',
    placeholder: 'Tell other hosts what it was like working with this organiser — what went smoothly and what to plan for.',
    photosLabel: 'Add photos (optional)',
    photosHint: 'Optional. Photos of the setup or the space after the event.',
    role: 'Host',
    successBody: 'Your review is now live and will help other hosts know what to expect from this organiser.',
    back: 'Back to reviews',
    footnote: 'Your verified feedback helps other hosts welcome the right events.',
  },
} as const

const label = "font-body font-semibold text-[16px] leading-[18px] text-[#1c1e25]"
const MAX_PHOTOS = 6

function useTrap(onClose: () => void, dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = ref.current!
    const list = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])'))
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? list()[0])?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab') return
      const f = list()
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
        e.preventDefault()
        f[0].focus()
      }
    }
    document.addEventListener('keydown', onKey)
    const o = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = o
      prev?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dep])
  return ref
}

function Thumb({ up, on, label: l, onClick }: { up: boolean; on: boolean; label: string; onClick: () => void }) {
  const tone = on ? (up ? 'border-2 border-[#10b981] bg-[#10b981]' : 'border-2 border-[#ff432a] bg-[#1c1e25]') : 'border border-[#2d2f38] bg-[#1c1e25]'
  return (
    <button type="button" aria-pressed={on} aria-label={l} onClick={onClick} className={`press grid size-11 shrink-0 place-items-center ${tone}`}>
      <img
        src={up ? thumbUp : thumbDown}
        alt=""
        className={`size-5 ${!up && on ? '[filter:brightness(0)_saturate(100%)_invert(34%)_sepia(98%)_saturate(3336%)_hue-rotate(348deg)_brightness(105%)_contrast(101%)]' : ''}`}
      />
    </button>
  )
}

export default function ReviewFlow({
  role,
  defaultName,
  subject,
  avatar,
  onClose,
  onSubmit,
  onViewReview,
  moderationPending = false,
}: {
  role: ReviewRole
  /** Prefilled reviewee (host) or reviewer (organiser) name */
  defaultName: string
  /** e.g. "Tech Meetup Chennai" */
  subject: string
  avatar?: string | null
  onClose: () => void
  onSubmit?: (r: ReviewResult) => void | Promise<void>
  onViewReview?: () => void
  /** Public venue reviews need curator approval, not instant publication. */
  moderationPending?: boolean
}) {
  const c = COPY[role]
  const reducedMotion = useReducedMotion()
  const [step, setStep] = useState<'form' | 'done'>('form')
  const [name, setName] = useState(defaultName)
  const [eventType, setEventType] = useState<string>(c.events[0])
  const [overall, setOverall] = useState<boolean | null>(null)
  const [aspects, setAspects] = useState<Record<string, boolean | null>>(() => Object.fromEntries(c.aspects.map((a) => [a, null])))
  const [text, setText] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [drag, setDrag] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; overall?: string; photos?: string }>({})
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [photoConsent, setPhotoConsent] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const panel = useTrap(onClose, step)
  const id = { title: useId(), name: useId(), text: useId(), photos: useId(), err: useId() }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const imgs = Array.from(files).filter((f) => f.type.startsWith('image/')).slice(0, MAX_PHOTOS - photos.length)
    imgs.forEach((f) => {
      const r = new FileReader()
      r.onload = () => setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, String(r.result)] : p))
      r.readAsDataURL(f)
    })
    if (imgs.length) setErrors((e) => ({ ...e, photos: undefined }))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const err: typeof errors = {}
    if (!name.trim()) err.name = role === 'host' ? 'Add the organiser’s name.' : 'Add your name.'
    if (overall === null) err.overall = 'Choose “Not great” or “Worked well”.'
    if (role === 'organiser' && photos.length === 0) err.photos = 'Add at least one event photo to publish your review.'
    if (moderationPending && !photoConsent) err.photos = 'Confirm that SCENE can display your event photos with your review.'
    setErrors(err)
    if (Object.keys(err).length) {
      const first = err.name ? id.name : err.overall ? 'overall-0' : 'photo-drop'
      document.getElementById(first)?.focus()
      return
    }
    setBusy(true)
    setSubmitError('')
    try {
      await onSubmit?.({ name: name.trim(), eventType, workedWell: !!overall, aspects, text: text.trim(), photos })
      setStep('done')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save your review. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const quote =
    text.trim() ||
    (overall
      ? role === 'host'
        ? 'Easy to work with from booking to wrap-up — would happily host again.'
        : 'The space worked really well for our event.'
      : 'A few things to plan for next time.')

  return (
    <div className="anim-fade fixed inset-0 z-50 bg-ink/50 sm:grid sm:place-items-center sm:overflow-y-auto sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id.title}
        className="anim-pop flex h-dvh w-full flex-col overflow-hidden bg-[#fcf9f2] sm:h-auto sm:max-h-[92dvh] sm:max-w-[900px] sm:rounded-[18px] sm:border-2 sm:border-[#111] sm:shadow-[0px_25px_60px_-15px_rgba(0,0,0,0.45)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b-2 border-[#111] bg-[#ff432a] px-5 py-4 sm:h-[74px] sm:px-8 sm:py-0">
          {step === 'form' ? (
            <h2 id={id.title} className="font-p-display text-[24px] leading-tight font-bold text-white sm:text-[32px]">
              {role === 'host' ? 'How was the organiser?' : 'Tell us how it went'}
            </h2>
          ) : (
            <h2 id={id.title} className="flex items-center gap-3 font-p-display text-[20px] leading-8 font-bold tracking-[-0.6px] text-white uppercase sm:text-[24px]">
              <span aria-hidden="true" className="size-2.5 rounded-full bg-white" />
              {moderationPending ? 'Review submitted' : 'Review published'}
            </h2>
          )}
          <button type="button" onClick={onClose} aria-label="Close review" className="press grid size-10 shrink-0 place-items-center rounded-[8px] bg-[#111] sm:size-9 sm:rounded-none sm:bg-[#1c1e25]">
            <img src={xIcon} alt="" className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {step === 'form' ? (
            <form onSubmit={submit} noValidate className="flex flex-col gap-7 px-5 pt-7 pb-10 sm:px-10">
              <p className="-mb-2 font-body text-[14px] leading-5 text-[#525252]">
                {role === 'host' ? `You hosted ${subject}. Your review helps other hosts.` : `You hosted an event at ${subject}. Your review helps other organisers.`}
              </p>

              <div className="flex flex-col gap-3.5">
                <label htmlFor={id.name} className={label}>
                  {c.nameLabel}
                </label>
                <input
                  id={id.name}
                  data-autofocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? `${id.name}-e` : undefined}
                  className="w-full border-2 border-black bg-[#f8fafc] aria-invalid:border-danger aria-invalid:bg-danger-tint px-4 py-3 font-p-display text-[14px] text-[#111827] outline-none focus-visible:ring-2 focus-visible:ring-[#ff432a]"
                />
                {errors.name && (
                  <p id={`${id.name}-e`} role="alert" className="text-sm text-danger">
                    {errors.name}
                  </p>
                )}
              </div>

              <fieldset className="flex flex-col gap-3.5">
                <legend className={`${label} mb-3.5`}>{c.eventLabel}</legend>
                <div className="flex flex-wrap gap-2.5">
                  {c.events.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={eventType === t}
                      onClick={() => setEventType(t)}
                      className={`press border-2 px-4 py-2 font-p-display text-[14px] ${eventType === t ? 'border-black bg-[#ff432a] text-white' : 'border-[#2d2f38] text-[#1c1c18] hover:bg-white'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="flex flex-col">
                <legend className={`${label} mb-3.5`}>{c.overall}</legend>
                <div className="flex flex-wrap items-center gap-3 border-2 border-[#2d2f38] bg-white px-4 py-4 sm:h-20 sm:gap-5 sm:px-7 sm:py-0">
                  {([false, true] as const).map((v, i) => (
                    <button
                      key={String(v)}
                      id={`overall-${i}`}
                      type="button"
                      aria-pressed={overall === v}
                      onClick={() => {
                        setOverall(v)
                        setErrors((e) => ({ ...e, overall: undefined }))
                      }}
                      className={`press flex items-center gap-2.5 px-5 py-3.5 font-p-display text-[14px] text-white sm:px-7 ${
                        overall === v ? (v ? 'border-2 border-black bg-[#10b981]' : 'border-2 border-[#ff432a] bg-[#1c1e25]') : 'border border-[#2d2f38] bg-[#1c1e25] opacity-80'
                      }`}
                    >
                      <img src={v ? thumbUp : thumbDown} alt="" className="size-5" />
                      {v ? 'Worked well!' : 'Not great!'}
                    </button>
                  ))}
                  <p aria-live="polite" className="flex items-center gap-2 font-p-display text-[14px] text-[#2e3138]">
                    {overall === true && (
                      <>
                        Glad it worked for you! <img src={handshake} alt="" className="size-5 object-contain" />
                      </>
                    )}
                    {overall === false && 'Thanks — tell us what to fix below.'}
                  </p>
                </div>
                {errors.overall && (
                  <p role="alert" className="mt-2 text-sm text-danger">
                    {errors.overall}
                  </p>
                )}
              </fieldset>

              <fieldset className="flex flex-col gap-3">
                <legend className={`${label} mb-3`}>{c.aspectsLabel}</legend>
                {c.aspects.map((a) => (
                  <div key={a} className="flex min-h-[68px] items-center justify-between gap-3 border-2 border-[#2d2f38] px-4 sm:px-[22px]">
                    <span className="font-p-display text-[14px] text-[#1c1c18]">{a}</span>
                    <div className="flex gap-2.5">
                      <Thumb up={false} on={aspects[a] === false} label={`${a}: not great`} onClick={() => setAspects((s) => ({ ...s, [a]: s[a] === false ? null : false }))} />
                      <Thumb up on={aspects[a] === true} label={`${a}: worked well`} onClick={() => setAspects((s) => ({ ...s, [a]: s[a] === true ? null : true }))} />
                    </div>
                  </div>
                ))}
              </fieldset>

              <div className="flex flex-col gap-3.5">
                <label htmlFor={id.text} className={label}>
                  {c.textLabel}
                </label>
                <textarea
                  id={id.text}
                  rows={5}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={c.placeholder}
                  className="w-full resize-y border-2 border-black bg-transparent px-4 py-3 font-p-display text-[14px] text-[#111827] outline-none placeholder:text-[#4b5563] focus-visible:ring-2 focus-visible:ring-[#ff432a]"
                />
              </div>

              <div className="flex flex-col gap-3.5">
                <p className={label} id={id.photos}>
                  {c.photosLabel}
                  {role === 'organiser' && <span className="text-[#ff432a]"> *</span>}
                </p>
                <p className="-mt-2 text-[13px] text-[#525252]">{c.photosHint}</p>
                <button
                  id="photo-drop"
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDrag(true)
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDrag(false)
                    addFiles(e.dataTransfer.files)
                  }}
                  aria-describedby={errors.photos ? id.err : id.photos}
                  disabled={photos.length >= MAX_PHOTOS}
                  className={`flex h-24 w-full flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed transition-colors disabled:opacity-50 ${
                    errors.photos ? 'border-2 border-[#ff432a] bg-[#fff1ee]' : drag ? 'border-[#111] bg-white' : 'border-[rgba(45,47,56,0.7)] bg-[#fcf9f2] hover:bg-white'
                  }`}
                >
                  <img src={uploadIcon} alt="" className="size-8" />
                  <span className="font-body text-[14px] text-[#1c1c18]">Drop photos here or upload</span>
                </button>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
                {errors.photos && (
                  <p id={id.err} role="alert" className="text-sm text-danger">
                    {errors.photos}
                  </p>
                )}
                {photos.length > 0 && (
                  <ul className="flex flex-wrap gap-3" aria-label="Attached photos">
                    {photos.map((p, i) => (
                      <li key={i} className="anim-pop relative h-[100px] w-[140px] overflow-hidden rounded-[10px]">
                        <img src={p} alt={`Photo ${i + 1}`} className="size-full object-cover" />
                        <button type="button" onClick={() => setPhotos((s) => s.filter((_, k) => k !== i))} aria-label={`Remove photo ${i + 1}`} className="absolute top-1.5 right-1.5 grid size-7 place-items-center bg-black/80">
                          <img src={xIcon} alt="" className="size-3" />
                        </button>
                      </li>
                    ))}
                    {photos.length < MAX_PHOTOS && (
                      <li>
                        <button type="button" onClick={() => fileRef.current?.click()} className="press flex size-[100px] flex-col items-center justify-center gap-1.5 rounded-[10px] border border-[#2d2f38] bg-[#1c1e25]">
                          <img src={plusIcon} alt="" className="size-5" />
                          <span className="font-body text-[11px] text-[#9ca3af]">Add more</span>
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {moderationPending && <label className="flex min-h-11 items-start gap-3 text-sm text-ink">
                <input type="checkbox" checked={photoConsent} onChange={e => setPhotoConsent(e.target.checked)} className="mt-1 size-5 shrink-0" />
                I have permission to share these event photos and agree to show them with my review after approval.
              </label>}
              {submitError && <p role="alert" className="text-sm text-danger-ink">{submitError}</p>}
              <button
                type="submit"
                disabled={busy}
                className="press flex w-full items-center justify-center gap-2 border-[1.5px] border-[#1c1c18] bg-[#ff432a] px-5 py-3 font-mono text-[12px] leading-4 tracking-[0.72px] text-white uppercase shadow-[2px_2px_0_#111] disabled:opacity-70"
              >
                {busy ? 'Saving…' : moderationPending ? 'Submit review' : 'Publish review'} <span aria-hidden="true">→</span>
              </button>
            </form>
          ) : (
            <div className="page-in flex flex-col gap-7 px-5 py-8 sm:p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                {reducedMotion ? <img src={confetti} alt="" className="size-[150px] object-contain" /> : <video
                  src={reviewPublishedAnimation}
                  autoPlay
                  muted
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  className="size-[150px] object-contain"
                />}
                <p data-autofocus tabIndex={-1} className="flex items-center gap-3 font-p-display text-[26px] leading-9 font-bold tracking-[-0.75px] text-[#111] outline-none sm:text-[30px]">
                  Thanks for sharing! <img src={confetti} alt="" className="size-9 object-contain" />
                </p>
                <p className="max-w-[448px] font-body text-[16px] leading-6 text-[#525252]">{moderationPending ? 'Your review and event photos are saved. Our team will check them before they appear on the venue page.' : c.successBody}</p>
              </div>

              <article className="flex flex-col gap-4 rounded-[12px] border-2 border-[#111] bg-white p-[22px] shadow-[4px_4px_0_#111]">
                <div className="flex items-center gap-3 border-b border-[rgba(17,17,17,0.15)] pb-3">
                  {avatar ? <img src={avatar} alt="" className="size-12 rounded-full border-2 border-black object-cover" /> : <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-black bg-paper font-head">{name.trim().slice(0, 1).toUpperCase()}</span>}
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-p-display text-[18px] leading-7 font-bold text-[#111]">{role === 'host' ? defaultName : name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[14px] text-[#ff432a]">{c.role}</span>
                    </p>
                    <p className="font-mono text-[13px] text-[#737373]">
                      {role === 'host' ? `About ${name}` : subject} · <span className="text-[#404040]">Just now</span>
                    </p>
                  </div>
                </div>
                <span className={`inline-flex w-fit items-center gap-1.5 rounded-[8px] border-2 border-[#111] px-3.5 py-1.5 font-p-display text-[12px] tracking-[0.3px] text-white uppercase shadow-[2px_2px_0_#111] ${overall ? 'bg-[#10b981]' : 'bg-[#1c1e25]'}`}>
                  <img src={overall ? thumbUp : thumbDown} alt="" className="size-3.5" />
                  {overall ? 'Worked well!' : 'Not great'}
                </span>
                <blockquote className="border-l-2 border-[rgba(17,17,17,0.2)] pl-3.5 font-body text-[16px] leading-6 text-[#262626] italic">“{quote}”</blockquote>
                {photos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <p className="font-mono text-[13px] text-[#525252]">
                      {photos.length} photo{photos.length > 1 ? 's' : ''} attached
                    </p>
                    <ul className="grid grid-cols-3 gap-2.5">
                      {photos.slice(0, 3).map((p, i) => (
                        <li key={i} className="relative h-[100px] overflow-hidden rounded-[8px] border-2 border-[#111]">
                          <img src={p} alt={`Attached photo ${i + 1}`} className="size-full object-cover" />
                          <span className="absolute right-1 bottom-1 bg-black/70 px-1 font-mono text-[10px] text-white">0{i + 1}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onClose} className="press flex-1 rounded-[10px] border-2 border-[#111] bg-[#fcf9f2] px-5 py-4 font-mono text-[13px] tracking-[0.8px] text-[#111] uppercase shadow-[4px_4px_0_#111]">
                  ← {c.back}
                </button>
                <button
                  type="button"
                  onClick={() => (onViewReview ? onViewReview() : onClose())}
                  className="press flex-1 rounded-[10px] border-2 border-[#111] bg-[#ff432a] px-5 py-4 font-mono text-[13px] tracking-[0.8px] text-white uppercase shadow-[4px_4px_0_#111]"
                >
                  {moderationPending ? 'Done' : 'View my review ↗'}
                </button>
              </div>
              <p className="text-center font-mono text-[11px] text-[#404040]">{moderationPending ? 'Reviews become public after approval.' : `✓ ${c.footnote}`}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
