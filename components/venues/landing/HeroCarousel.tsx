"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { VenueIcon } from "@/components/venues/VenueUi";

export interface CarouselSlide {
  src: string;
  alt: string;
}

/**
 * Hero image carousel. Fades between slides rather than sliding, with an
 * autoplay that stops on hover/focus and never runs under reduced motion.
 *
 * The dot controls are 6px tall visually but sit in a 24×24 hit area: bare 6px
 * buttons were too small to hit reliably (WCAG 2.2 · 2.5.8 asks for 24px).
 */
export function HeroCarousel({ slides, label, className = "" }: { slides: CarouselSlide[]; label: string; className?: string }) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = (delta: number) => setIndex((current) => (current + delta + count) % count);

  useEffect(() => {
    if (paused || reduceMotion || count < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % count), 5500);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion, count]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      className={`group relative overflow-hidden bg-secondary ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
    >
      <div aria-live={paused ? "polite" : "off"} className="absolute inset-0">
        {slides.map((slide, k) => (
          <Image
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            fill
            priority={k === 0}
            loading={k === 0 ? "eager" : "lazy"}
            sizes="(min-width: 1024px) 560px, 100vw"
            aria-hidden={k !== index}
            className={`object-cover transition-[opacity,scale] duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none ${
              k === index ? "opacity-100 scale-100" : "opacity-0 scale-[1.04]"
            }`}
          />
        ))}
      </div>

      {count > 1 && (
        <div className="absolute inset-x-3 top-1/2 flex -translate-y-1/2 justify-between">
          {([
            [-1, "Show previous image", "rotate-180"],
            [1, "Show next image", ""],
          ] as const).map(([delta, text, rotate]) => (
            <button
              key={text}
              type="button"
              aria-label={text}
              onClick={() => go(delta)}
              className="venue-press grid size-11 place-items-center border-[1.5px] border-foreground bg-venue-card text-foreground shadow-hard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <VenueIcon name="arrow" className={`size-5 ${rotate}`} />
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/55 to-transparent px-3 pb-2 pt-12">
        <div className="flex" role="group" aria-label="Choose image">
          {slides.map((_, k) => (
            <button
              key={k}
              type="button"
              aria-label={`Show image ${k + 1} of ${count}`}
              aria-current={k === index}
              onClick={() => setIndex(k)}
              className="group/dot grid h-6 min-w-6 place-items-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={`block h-1.5 transition-all duration-300 ${k === index ? "w-7 bg-white" : "w-3 bg-white/55 group-hover/dot:bg-white/80"}`} />
            </button>
          ))}
        </div>
        <p className="pb-1.5 pr-1 font-mono text-[10px] font-bold tracking-[0.08em] text-white" aria-hidden>
          {index + 1} / {count}
        </p>
      </div>
    </section>
  );
}
