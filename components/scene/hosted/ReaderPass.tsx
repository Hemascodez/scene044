"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { seatSegments } from "@/lib/client/enrolled";
import { resolveSwipe, SWIPE_COMPLETE_AT } from "@/lib/client/swipe";
import { playSwipeBurst, setSwipeWhoosh, startSwipeWhoosh, stopSwipeWhoosh } from "@/lib/client/ticketSound";
import { useElementWidth } from "@/lib/client/useStageScale";
import { formatRupees, seatProgress, type HostedEventInfo } from "@/lib/hostedEvents";
import styles from "@/components/scene/hosted/ReaderPass.module.css";
import { hostedCardSolid } from "@/components/scene/hosted/hostedCard";

/**
 * The "Reader pass register card" in SCENE fonts and the poster theme's
 * colours (see `.hosted-theme` in app/globals.css). `ReaderPass` is the opening card; `SwipeToPay` is reused at
 * the pay step. The design's "Sound on" toggle and "Replay" link are left out.
 */

const THUMB = 50;
const INSET = 4;
const ACCENT = "var(--h-accent)";
const ACCENT_INK = "var(--h-accent-ink)";
const MUTED = "var(--h-ink-soft)";

export function ReaderPass({ hosted, onSwipe }: { hosted: HostedEventInfo; onSwipe: () => void }) {
  const price = formatRupees(hosted.pricePaise);
  const seats = seatProgress(hosted);
  const segments = seatSegments(seats);

  return (
    <div className={`relative overflow-hidden border-2 border-foreground p-5 sm:p-7 ${hostedCardSolid}`}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 0% 100%, rgba(194,122,62,.14), rgba(194,122,62,0) 50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "repeating-linear-gradient(135deg, rgba(154,79,31,.07) 0 1px, transparent 1px 9px)",
          WebkitMaskImage: "linear-gradient(to bottom left, #000, transparent 48%)",
          maskImage: "linear-gradient(to bottom left, #000, transparent 48%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 border border-[var(--h-line-strong)] bg-[var(--h-card)] px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.16em]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
              <path d="M14 5v14" strokeDasharray="2 3" />
            </svg>
            READER PASS
          </span>
          <span
            className="inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em]"
            style={{ background: "var(--h-accent-soft)", borderColor: "rgba(154,79,31,.4)", color: ACCENT_INK }}
          >
            <span className={`${styles.dot} size-2 rounded-full bg-[var(--h-accent)] shadow-[0_0_10px_rgba(217,164,92,.9)]`} aria-hidden="true" />
            {seats.left <= 10 ? `ONLY ${seats.left} ${seats.left === 1 ? "SPOT" : "SPOTS"} LEFT` : `${seats.left} SPOTS LEFT`}
          </span>
        </div>

        <div className="mt-6 flex items-baseline gap-3">
          <span className="font-display text-[56px] font-black leading-none tracking-[-0.045em] [text-shadow:0_0_40px_rgba(217,164,92,.55)] sm:text-[72px]">
            {price}
          </span>
          <span className="text-[15px] font-medium" style={{ color: MUTED }}>
            per reader
          </span>
        </div>

        <div className="mt-6">
          <div
            className="flex gap-1"
            role="progressbar"
            aria-label="Seats booked"
            aria-valuemin={0}
            aria-valuemax={seats.capacity}
            aria-valuenow={seats.booked}
          >
            {segments.map((segment, i) => (
              <div
                key={i}
                className={`h-3 min-w-0 flex-1 ${segment === "filled" ? styles.seg : styles.segOpen}`}
                style={{
                  background: segment === "filled" ? "linear-gradient(180deg, var(--h-accent-light), var(--h-accent))" : "rgba(59,37,22,.1)",
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: MUTED }}>
            <span>
              {seats.booked} OF {seats.capacity} BOOKED
            </span>
            <span style={{ color: ACCENT_INK }}>{seats.left} LEFT</span>
          </div>
        </div>

        <div className="mt-5 border-t border-dashed border-[var(--h-line-strong)]" />

        <div className="mt-5">
          <SwipeToPay label={`Swipe to book · ${price}`} ariaLabel={`Swipe right, or press Enter, to book a reader pass for ${price}`} onComplete={onSwipe} />
        </div>

        <PassFooter />
      </div>
    </div>
  );
}

export function PassFooter() {
  return (
    <p className="mt-4 flex items-start gap-2 text-[13px] font-medium leading-5" style={{ color: "var(--h-sage, var(--color-signal-ink))" }}>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
      </svg>
      After payment, your ticket opens on its own page and in My bookings. WhatsApp updates are optional.
    </p>
  );
}

/**
 * Swipe-to-pay slider from the design. Drag past 85%, tap the thumb, or press
 * Enter / Space / → to complete. While dragging: speed streaks and a whoosh
 * that follows the drag; on completion a burst. While `busy`, it sits at the
 * end with a spinner and `busyLabel`.
 */
export function SwipeToPay({
  label,
  ariaLabel,
  busy = false,
  busyLabel = "Taking you to Razorpay…",
  onComplete,
}: {
  label: string;
  ariaLabel: string;
  busy?: boolean;
  busyLabel?: string;
  onComplete: () => void;
}) {
  const { ref: trackRef, width: trackWidth } = useElementWidth<HTMLDivElement>();
  const drag = useRef<{ startX: number; lastX: number; lastT: number; velocity: number } | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const suppressClick = useRef(false);

  const maxX = Math.max(0, trackWidth - THUMB - INSET * 2);
  const x = busy ? maxX : dragX;

  function complete() {
    drag.current = null;
    setDragX(0);
    setDragging(false);
    // Sound is decorative; never let an unavailable audio context block booking.
    try { stopSwipeWhoosh(); playSwipeBurst(); } catch { /* silent fallback */ }
    onComplete();
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (busy) return;
    suppressClick.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* native click still works */ }
    drag.current = { startX: e.clientX, lastX: 0, lastT: performance.now(), velocity: 0 };
    try { startSwipeWhoosh(); } catch { /* sound cannot block registration */ }
    setDragging(true);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    const nx = Math.max(0, Math.min(maxX, e.clientX - d.startX));
    const now = performance.now();
    const instant = Math.abs(nx - d.lastX) / Math.max(1, now - d.lastT);
    d.velocity = d.velocity * 0.6 + instant * 0.4;
    d.lastX = nx;
    d.lastT = now;
    try { setSwipeWhoosh(d.velocity, maxX ? nx / maxX : 0); } catch { /* silent fallback */ }
    setDragX(nx);
    // Open immediately at the threshold, even if pointer-up/capture is lost.
    if (maxX > 0 && nx >= maxX * SWIPE_COMPLETE_AT) {
      suppressClick.current = true;
      complete();
    }
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    suppressClick.current = true;
    if (resolveSwipe({ dx: e.clientX - d.startX, max: maxX }) === "complete") complete();
    else {
      stopSwipeWhoosh();
      setDragX(0);
      setDragging(false);
    }
  }
  function onPointerCancel() {
    drag.current = null;
    stopSwipeWhoosh();
    setDragX(0);
    setDragging(false);
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (busy || e.repeat) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      complete();
    }
  }

  const trans = dragging ? "none" : "transform .45s cubic-bezier(.2,.9,.25,1.1), opacity .3s ease";
  // The fill trails the thumb and ends at its centre, so it never peeks out
  // around a resting thumb (that read as a drop shadow). Hidden until it moves.
  const fillX = x - trackWidth + INSET + THUMB / 2;
  const fillVisible = busy || x > 0;

  return (
    <div
      ref={trackRef}
      className="relative h-[60px] select-none overflow-hidden border border-[var(--h-line-strong)] bg-[var(--h-card-2)] shadow-[inset_0_2px_6px_rgba(59,37,22,.16)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, rgba(217,164,92,0) 0%, rgba(217,164,92,.75) 100%)",
          transform: `translateX(${fillX}px)`,
          opacity: fillVisible ? 1 : 0,
          transition: trans,
        }}
      />
      {dragging && dragX > 8 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ transform: `translateX(${fillX}px)` }}>
          <div className={styles.streak} />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-14 pr-12 font-display text-[15px] font-bold sm:text-[17px]"
        style={{ opacity: busy ? 1 : Math.max(0, 1 - dragX / 160) }}
        aria-live="polite"
      >
        {busy ? <span className="text-[var(--h-ink)]">{busyLabel}</span> : <span className={styles.label}>{label}</span>}
      </div>
      {!busy && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[18px] flex items-center" style={{ opacity: Math.max(0, 1 - dragX / 120) }}>
          {[0, 0.18, 0.36].map((delay) => (
            <svg key={delay} className={styles.chev} style={{ animationDelay: `${delay}s`, marginLeft: delay ? -4 : 0 }} width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="var(--h-accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 3l6 6-6 6" />
            </svg>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={busy ? busyLabel : ariaLabel}
        aria-disabled={busy}
        disabled={busy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onKeyDown={onKeyDown}
        onClick={(e) => {
          if (busy) return;
          if (suppressClick.current && e.detail !== 0) { suppressClick.current = false; return; }
          complete();
        }}
        className={`${styles.thumb} absolute left-1 top-1 flex size-[50px] items-center justify-center bg-[linear-gradient(135deg,var(--h-accent-light),var(--h-accent))] text-[var(--h-on-ink)]`}
        style={{ transform: `translateX(${x}px) scale(${dragging ? 1.05 : 1})`, transition: trans }}
      >
        {busy ? (
          <svg className={styles.spin} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
            <path d="M12 3a9 9 0 1 0 9 9" />
          </svg>
        ) : (
          <svg className={styles.nudge} width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </div>
  );
}
