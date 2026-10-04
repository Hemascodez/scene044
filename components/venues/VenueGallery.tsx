"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/lib/client/useScrollLock";
import { VenueIcon } from "@/components/venues/VenueUi";

/**
 * Photo mosaic with a full-screen lightbox.
 *
 * One large photo plus up to four small ones, then "Show all N photos" opens the
 * lightbox. The mosaic adapts to however many photos a venue actually has, so a
 * newly-listed cafe with two photos does not render a gallery full of holes.
 *
 * Photos come from the venue's catalog row (curator-managed) rather than a
 * hardcoded list, so adding a photo in the curator is all it takes to show it.
 */
export function VenueGallery({ venueName, photos }: { venueName: string; photos: string[] }) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const opener = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = photos.length;

  useScrollLock(open);

  const show = useCallback((start: number, trigger: HTMLElement | null) => {
    opener.current = trigger;
    setIndex(start);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Hand focus back to whatever opened the lightbox.
    window.setTimeout(() => opener.current?.focus(), 0);
  }, []);

  const go = useCallback((delta: number) => setIndex((current) => (current + delta + count) % count), [count]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close, go]);

  if (count === 0) return null;

  const small = photos.slice(1, 5);
  const smallCols = small.length <= 2 ? 1 : 2;
  const smallRows = small.length <= 1 ? 1 : 2;
  const alt = (n: number) => `${venueName} — photo ${n + 1} of ${count}`;

  return (
    <section aria-label={`${venueName} photos`} className="mt-8">
      {/* Mobile: the lead photo only, the rest live in the lightbox. */}
      <div className="relative aspect-[4/3] overflow-hidden border-[1.5px] border-foreground bg-secondary sm:hidden">
        <Image src={photos[0]} alt={alt(0)} fill priority sizes="100vw" className="object-cover" />
        <ShowAll count={count} onClick={(event) => show(0, event.currentTarget)} />
      </div>

      {/* sm and up: mosaic. */}
      <div
        className="hidden h-[320px] gap-px overflow-hidden border-[1.5px] border-foreground bg-foreground sm:grid md:h-[400px] lg:h-[447px]"
        style={{ gridTemplateColumns: `${small.length ? "2fr " : ""}${"1fr ".repeat(small.length ? smallCols : 1)}`.trim(), gridTemplateRows: `repeat(${smallRows}, minmax(0, 1fr))` }}
      >
        <button
          type="button"
          onClick={(event) => show(0, event.currentTarget)}
          aria-label={`Open photo 1 of ${count}`}
          className="group relative overflow-hidden bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          style={{ gridRow: `1 / span ${smallRows}` }}
        >
          <Image src={photos[0]} alt={alt(0)} fill priority sizes="(min-width: 1024px) 640px, 60vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
        </button>
        {small.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={(event) => show(i + 1, event.currentTarget)}
            aria-label={`Open photo ${i + 2} of ${count}`}
            className="group relative overflow-hidden bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <Image src={src} alt={alt(i + 1)} fill sizes="(min-width: 1024px) 320px, 30vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transition-none" />
            {i === small.length - 1 && count > 1 && <ShowAll count={count} asSpan />}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`${venueName} photo viewer`}
            className="fixed inset-0 z-[80] flex flex-col bg-foreground/95 text-background"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center justify-between px-4 py-3 sm:px-6">
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.1em]" aria-live="polite">
                {index + 1} / {count}
              </p>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close photo viewer"
                className="venue-press grid size-11 place-items-center border-[1.5px] border-background bg-foreground text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <VenueIcon name="close" />
              </button>
            </div>
            <div className="relative min-h-0 flex-1">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div
                  key={photos[index]}
                  className="absolute inset-0"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Image src={photos[index]} alt={alt(index)} fill sizes="100vw" className="object-contain" />
                </motion.div>
              </AnimatePresence>
            </div>
            {count > 1 && (
              <div className="flex items-center justify-center gap-3 px-4 py-4">
                {([[-1, "Previous photo", "rotate-180"], [1, "Next photo", ""]] as const).map(([delta, label, rotate]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => go(delta)}
                    aria-label={label}
                    className="venue-press grid size-12 place-items-center border-[1.5px] border-background bg-foreground text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <VenueIcon name="arrow" className={`size-5 ${rotate}`} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function ShowAll({ count, onClick, asSpan = false }: { count: number; onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void; asSpan?: boolean }) {
  const cls =
    "absolute bottom-3 right-3 border-[1.5px] border-foreground bg-venue-card px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-foreground shadow-hard-sm";
  if (asSpan) return <span className={cls}>Show all {count} photos</span>;
  return (
    <button type="button" onClick={onClick} className={`${cls} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary`}>
      Show all {count} photos
    </button>
  );
}
