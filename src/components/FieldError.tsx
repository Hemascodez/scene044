import type { ReactNode } from 'react'

/** Inline validation message: AA-contrast danger red + glyph, so errors never rely on colour alone. */
export default function FieldError({ id, children, className = '', live = true }: { id?: string; children: ReactNode; className?: string; live?: boolean }) {
  if (!children) return null
  return (
    <p id={id} role={live ? 'alert' : undefined} className={`rise flex items-start gap-1.5 font-body-m text-xs leading-[18px] text-danger ${className}`}>
      <span aria-hidden="true" className="mt-px grid size-3.5 shrink-0 place-items-center bg-danger font-mono-b text-[10px] leading-none text-white">
        !
      </span>
      <span>{children}</span>
    </p>
  )
}
