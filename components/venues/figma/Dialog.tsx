"use client";

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Close } from './icons'

/** Accessible modal: focus trap, Escape to close, focus restore. */
export default function Dialog({
  title,
  description,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md'
}) {
  const titleId = useId()
  const descId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const el = panel.current!
    const focusables = () =>
      Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'))
    ;(el.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0])?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key !== 'Tab') return
      const f = focusables()
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
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus()
    }
  }, [onClose])

  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-0 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        className={`anim-pop max-h-[92dvh] w-full overflow-y-auto border-[2.5px] border-ink bg-white p-6 shadow-hard-lg sm:p-7 ${size === 'sm' ? 'sm:max-w-[440px]' : 'sm:max-w-[560px]'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="font-head text-xl leading-7 text-ink">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-sm leading-5 text-stone">
                {description}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="-mr-2 -mt-1 grid size-10 shrink-0 place-items-center text-ink transition-colors hover:bg-sand">
            <Close className="size-5" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
