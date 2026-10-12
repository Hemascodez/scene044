"use client";

import { Check } from './icons'
import { HOURLY_ID, type VenuePricing } from '@/lib/venuePricing'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

/* "Choose your booking option" — hourly vs the venue's fixed-length packages.
 *
 * Native radios in a fieldset, visually hidden behind the cards: arrow-key
 * selection, the grouped label and the checked state all come from the
 * platform rather than being rebuilt with role="radio". The card is the
 * <label>, so the whole thing is one target (comfortably over 44px).
 *
 * The chosen card is marked three ways — border weight, the hard shadow and a
 * tick — so it never depends on colour alone. */
export function BookingOptions({
  pricing,
  value,
  hours,
  onChange,
  name,
  labelId,
}: {
  pricing: VenuePricing
  /** Package id, or HOURLY_ID. */
  value: string
  /** Current hourly duration, used for the hourly option's running total. */
  hours: number
  onChange: (id: string) => void
  name: string
  labelId: string
}) {
  const options = [
    {
      id: HOURLY_ID,
      name: 'Hourly',
      meta: `${money(pricing.hourlyRate)}/hour · minimum ${pricing.minHours} hours`,
      price: pricing.hourlyRate * Math.max(hours, pricing.minHours),
      listPrice: null as number | null,
    },
    ...pricing.packages.map((p) => ({
      id: p.id,
      name: `${p.name} · ${p.hours} hours`,
      meta: null,
      price: p.price,
      listPrice: p.listPrice,
    })),
  ]

  return (
    <fieldset className="min-w-0">
      <legend id={labelId} className={`${'font-mono-b text-[10px] leading-[15px] tracking-[0.8px] uppercase text-stone'} mb-2`}>
        Choose your booking option
      </legend>
      <div className="flex flex-col gap-2">
        {options.map((o) => {
          const selected = value === o.id
          const saving = o.listPrice === null ? 0 : o.listPrice - o.price
          return (
            <label
              key={o.id}
              className={`press relative flex cursor-pointer items-center gap-3 border-[1.5px] p-3 transition-[background-color,box-shadow,border-color] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-flame motion-reduce:transition-none ${
                selected ? 'border-ink bg-white shadow-hard-sm' : 'border-line bg-paper-2 hover:border-ink/40'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={selected}
                onChange={() => onChange(o.id)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={`grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] ${
                  selected ? 'border-ink bg-ink text-white' : 'border-stone/50 bg-white'
                }`}
              >
                {selected && <Check className="size-3" strokeWidth={3} />}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block font-body-sb text-sm leading-5 text-ink">{o.name}</span>
                {o.meta && <span className="mt-0.5 block text-xs leading-4 text-stone">{o.meta}</span>}
                {saving > 0 && (
                  <span className="mt-1 inline-block bg-moss/12 px-1.5 py-0.5 font-mono-b text-[10px] leading-[14px] tracking-[0.4px] uppercase text-moss">
                    Save {money(saving)}
                  </span>
                )}
              </span>

              <span className="shrink-0 text-right">
                {o.listPrice !== null && (
                  <span className="block text-xs leading-4 text-stone">
                    {/* The old price is struck through visually; screen readers
                        get the words instead, since <s> is not announced. */}
                    <span className="sr-only">Was </span>
                    <s>{money(o.listPrice)}</s>
                  </span>
                )}
                <span className="block font-head text-base leading-6 text-ink">{money(o.price)}</span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
