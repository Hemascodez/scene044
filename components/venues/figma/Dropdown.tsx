"use client";

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from './icons'

export default function Dropdown({
  label,
  placeholder,
  options,
  value: controlled,
  onChange,
  invalid,
  describedBy,
  className = 'mt-0.5 text-[13px]',
  listClassName = '-left-5 -right-5 top-[calc(100%+16px)]',
}: {
  label: string
  placeholder: string
  options: string[]
  value?: string
  onChange?: (v: string) => void
  invalid?: boolean
  describedBy?: string
  className?: string
  listClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [inner, setInner] = useState('')
  const value = controlled ?? inner
  const setValue = (v: string) => {
    setInner(v)
    onChange?.(v)
  }
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const id = useId()
  const items = [placeholder, ...options]

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [open])

  const pick = (i: number) => {
    setValue(i === 0 ? '' : items[i])
    setOpen(false)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) {
        setActive(Math.max(0, items.indexOf(value || placeholder)))
        setOpen(true)
      } else setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length)
    } else if (e.key === 'Enter' && open) {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Escape' && open) {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={id}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => {
          setActive(Math.max(0, items.indexOf(value || placeholder)))
          setOpen((o) => !o)
        }}
        onKeyDown={onKey}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`flex w-full items-center justify-between gap-2 text-left leading-5 focus:outline-none ${className}`}
      >
        <span className={value ? 'text-ink' : 'text-stone'}>{value || placeholder}</span>
        <ChevronDown className={`size-4 shrink-0 text-stone transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <ul
        id={id}
        role="listbox"
        aria-label={label}
        className={`absolute ${listClassName} z-30 min-w-[220px] origin-top border-[1.5px] border-ink bg-white py-1 shadow-hard transition-all duration-200 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
        }`}
      >
        {items.map((o, i) => (
          <li
            key={o}
            id={`${id}-${i}`}
            role="option"
            aria-selected={i === 0 ? !value : value === o}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(i)}
            className={`flex cursor-pointer items-center justify-between gap-3 px-5 py-2.5 text-[13px] leading-5 ${
              i === 0 ? 'text-stone' : 'text-ink'
            } ${active === i ? 'bg-paper-2' : ''}`}
          >
            {o}
            {(i === 0 ? !value : value === o) && <Check className="size-4 text-flame" strokeWidth={2.25} />}
          </li>
        ))}
      </ul>
    </div>
  )
}
