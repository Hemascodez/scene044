"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { VenueIcon, VenueKicker } from "@/components/venues/VenueUi";

const SLIDES = [
  {
    src: "/venues/time-cafe/zomato-interior-overview.jpeg",
    alt: "Wide view of Time Cafe's warm indoor seating",
    title: "A calm, considered room",
    note: "Indoor seating at Time Cafe",
  },
  {
    src: "/venues/time-cafe/zomato-indoor-seating.jpeg",
    alt: "Flexible seating on the Time Cafe floor",
    title: "Space to gather",
    note: "Comfortable seating for conversations and teams",
  },
  {
    src: "/venues/time-cafe/zomato-cafe-floor.jpeg",
    alt: "Open cafe floor at Time Cafe",
    title: "Cafe floor, made flexible",
    note: "A welcoming setting for your next gathering",
  },
] as const;

export function VenueGallery() {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const slide = SLIDES[index];

  useEffect(() => {
    if (paused || reduceMotion) return;
    const timer = window.setInterval(() => {
      setDirection(1);
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, reduceMotion]);

  function go(delta: number) {
    setDirection(delta > 0 ? 1 : -1);
    setIndex((current) => (current + delta + SLIDES.length) % SLIDES.length);
  }

  function select(nextIndex: number) {
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(nextIndex);
  }

  return (
    <section
      className="mt-4 overflow-hidden rounded-[26px] border border-foreground/15 bg-foreground text-background shadow-[0_24px_70px_rgba(20,19,13,0.12)]"
      aria-roledescription="carousel"
      aria-label="Time Cafe photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") go(-1);
        if (event.key === "ArrowRight") go(1);
      }}
    >
      <div className="relative aspect-[4/3] overflow-hidden sm:aspect-[16/8] lg:aspect-[16/7]">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={slide.src}
            custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: direction * 52, scale: 1.025 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: direction * -36, scale: 0.99 }}
            transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            <Image src={slide.src} alt={slide.alt} fill priority={index === 0} loading={index === 0 ? "eager" : "lazy"} sizes="(max-width: 768px) 100vw, 1280px" className="object-cover" />
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-foreground/90 via-foreground/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 sm:p-6">
          <div className="min-w-0">
            <VenueKicker className="text-background/65">Inside Time Cafe</VenueKicker>
            <h2 className="mt-1 truncate font-display text-2xl font-black tracking-[-0.04em] sm:text-3xl">{slide.title}</h2>
            <p className="mt-1 text-xs text-background/70 sm:text-sm">{slide.note}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => go(-1)} className="grid size-11 place-items-center rounded-full border border-background/30 bg-foreground/45 text-background backdrop-blur transition hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Previous photo"><VenueIcon name="arrow" className="size-5 rotate-180" /></button>
            <button type="button" onClick={() => go(1)} className="grid size-11 place-items-center rounded-full bg-background text-foreground transition hover:bg-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Next photo"><VenueIcon name="arrow" className="size-5" /></button>
          </div>
        </div>
        {!reduceMotion && !paused && <motion.div key={index} className="absolute left-0 top-0 h-1 bg-primary" initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ duration: 5.2, ease: "linear" }} />}
      </div>
      <div className="flex items-center gap-2 overflow-x-auto p-3 sm:p-4">
        {SLIDES.map((item, itemIndex) => (
          <button key={item.src} type="button" onClick={() => select(itemIndex)} aria-label={`Show photo ${itemIndex + 1}: ${item.title}`} aria-current={itemIndex === index ? "true" : undefined} className={`relative h-14 w-20 shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-16 sm:w-24 ${itemIndex === index ? "border-primary" : "border-transparent opacity-55 hover:opacity-100"}`}>
            <Image src={item.src} alt="" fill sizes="96px" className="object-cover" />
          </button>
        ))}
        <button type="button" onClick={() => setPaused((current) => !current)} className="ml-auto min-h-11 shrink-0 rounded-full border border-background/20 px-4 text-xs font-bold text-background/75 hover:border-background/50 hover:text-background">{paused ? "Play slideshow" : "Pause"}</button>
      </div>
    </section>
  );
}
