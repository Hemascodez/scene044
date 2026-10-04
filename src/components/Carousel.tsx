import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from './icons'

type Slide = { src: string; alt: string }

export default function Carousel({
  slides,
  label,
  className = '',
  autoplay = false,
}: {
  slides: Slide[]
  label: string
  className?: string
  autoplay?: boolean
}) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length
  const go = (d: number) => setI((v) => (v + d + n) % n)

  useEffect(() => {
    if (!autoplay || paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setI((v) => (v + 1) % n), 5500)
    return () => clearInterval(t)
  }, [autoplay, paused, n])

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={`group relative overflow-hidden bg-sand ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1)
        if (e.key === 'ArrowRight') go(1)
      }}
    >
      <div aria-live={paused ? 'polite' : 'off'} className="absolute inset-0">
        {slides.map((s, k) => (
          <img
            key={s.src}
            src={s.src}
            alt={s.alt}
            aria-hidden={k !== i}
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} of ${n}`}
            loading={k === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 size-full object-cover transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${
              k === i ? 'opacity-100 scale-100' : 'opacity-0 scale-[1.04]'
            }`}
          />
        ))}
      </div>

      <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
        {[
          { d: -1, l: 'Show previous image', I: ChevronLeft },
          { d: 1, l: 'Show next image', I: ChevronRight },
        ].map(({ d, l, I }) => (
          <button
            key={l}
            type="button"
            aria-label={l}
            onClick={() => go(d)}
            className="press grid size-10 place-items-center border-[1.5px] border-ink bg-paper text-ink shadow-hard-sm"
          >
            <I className="size-5" />
          </button>
        ))}
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/55 to-transparent px-4 pt-12 pb-4">
        <div className="flex gap-1.5" role="group" aria-label="Choose image">
          {slides.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Show image ${k + 1} of ${n}`}
              aria-current={k === i}
              onClick={() => setI(k)}
              className={`h-1.5 transition-all duration-300 ${k === i ? 'w-7 bg-white' : 'w-3 bg-white/55 hover:bg-white/80'}`}
            />
          ))}
        </div>
        <p className="font-mono-b text-[10px] leading-[15px] tracking-[0.8px] text-white" aria-hidden="true">
          {i + 1} / {n}
        </p>
      </div>
    </section>
  )
}
