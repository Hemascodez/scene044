"use client";

import { useRef, useState } from "react";

/**
 * "Last time" photos. A swipeable row on phones (the next photo peeks in so
 * the row reads as scrollable), a four-column grid from `sm` up. Tapping a
 * photo opens it full size in a native <dialog>, which brings Escape-to-close
 * and focus handling for free.
 */
export function HostedGallery({ photos }: { photos: { src: string; alt: string }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<{ src: string; alt: string } | null>(null);

  function show(photo: { src: string; alt: string }) {
    setOpen(photo);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0">
        {photos.map((photo, index) => (
          <li key={photo.src} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <button
              type="button"
              onClick={() => show(photo)}
              className="block aspect-[4/5] w-full overflow-hidden border-2 border-foreground bg-muted transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label={`Open photo ${index + 1} of ${photos.length}: ${photo.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- static local photos, sized by the frame */}
              <img src={photo.src} alt={photo.alt} loading="lazy" decoding="async" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="m-auto max-h-[92dvh] max-w-[min(92vw,960px)] border-2 border-foreground bg-card p-0 backdrop:bg-foreground/80"
      >
        {open && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element -- static local photo */}
            <img src={open.src} alt={open.alt} className="max-h-[80dvh] w-full object-contain" />
            <figcaption className="flex items-center justify-between gap-3 border-t-2 border-foreground px-3 py-2">
              <span className="text-sm">{open.alt}</span>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="min-h-11 shrink-0 border-2 border-foreground px-4 font-mono text-xs font-semibold uppercase tracking-[0.14em] hover:bg-foreground hover:text-background"
              >
                Close
              </button>
            </figcaption>
          </figure>
        )}
      </dialog>
    </>
  );
}
