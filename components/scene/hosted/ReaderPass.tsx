"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { seatSegments } from "@/lib/client/enrolled";
import { resolveSwipe } from "@/lib/client/swipe";
import { playSwipeBurst, setSwipeWhoosh, startSwipeWhoosh, stopSwipeWhoosh } from "@/lib/client/ticketSound";
import { useElementWidth } from "@/lib/client/useStageScale";
import { formatRupees, seatProgress, type HostedEventInfo } from "@/lib/hostedEvents";
import styles from "@/components/scene/hosted/ReaderPass.module.css";

/**
 * The "Reader pass register card" (dark design) in SCENE fonts and red, with
 * square corners. `ReaderPass` is the opening card; `SwipeToPay` is reused at
 * the pay step. The design's "Sound on" toggle and "Replay" link are left out.
 */

const THUMB = 50;
const INSET = 4;
const RED_SOFT = "#ff6a55";
const RED_TEXT = "#ff8a77";
const MUTED = "#b5aeaa";
const GREEN = "#4ade80";

export function ReaderPass({ hosted, onSwipe }: { hosted: HostedEventInfo; onSwipe: () => void }) {
  const price = formatRupees(hosted.pricePaise);
  const seats = seatProgress(hosted);
  const segments = seatSegments(seats);

  return (
    <div className="relative overflow-hidden border-2 border-foreground bg-[linear-gradient(160deg,#211813_0%,#14130d_55%,#170f0c_100%)] p-5 text-white sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 100% 0%, rgba(255,45,22,.34), rgba(255,45,22,0) 55%), radial-gradient(ellipse at 0% 100%, rgba(255,45,22,.14), rgba(255,45,22,0) 50%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: "repeating-linear-gradient(135deg, rgba(255,255,255,.06) 0 1px, transparent 1px 9px)",
          WebkitMaskImage: "linear-gradient(to bottom left, #000, transparent 48%)",
          maskImage: "linear-gradient(to bottom left, #000, transparent 48%)",
        }}
      />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 border border-white/15 bg-white/5 px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.16em]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={RED_SOFT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
              <path d="M14 5v14" strokeDasharray="2 3" />
            </svg>
            READER PASS
          </span>
          <span
            className="inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.12em]"
            style={{ background: "rgba(255,45,22,.18)", borderColor: "rgba(255,106,85,.5)", color: RED_TEXT }}
          >
            <span className={`${styles.dot} size-2 rounded-full bg-primary shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
            {seats.left <= 10 ? `ONLY ${seats.left} ${seats.left === 1 ? "SPOT" : "SPOTS"} LEFT` : `${seats.left} SPOTS LEFT`}
          </span>
        </div>

        <div className="mt-6 flex items-baseline gap-3">
          <span className="font-display text-[56px] font-black leading-none tracking-[-0.045em] [text-shadow:0_0_40px_rgba(255,45,22,.45)] sm:text-[72px]">
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
                  background: segment === "filled" ? `linear-gradient(180deg, ${RED_SOFT}, #e0301f)` : "rgba(255,255,255,.1)",
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: MUTED }}>
            <span>
              {seats.booked} OF {seats.capacity} BOOKED
            </span>
            <span style={{ color: RED_SOFT }}>{seats.left} LEFT</span>
          </div>
        </div>

        <div className="mt-5 border-t border-dashed border-white/20" />

        <div className="mt-5">
          <SwipeToPay label={`Swipe to book · ${price}`} ariaLabel={`Swipe right, or press Enter, to book a reader pass for ${price}`} onComplete={onSwipe} />
        </div>

        <PassFooter />
      </div>
    </div>
  );
}

export function PassFooter({ dark = true }: { dark?: boolean }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-[13px] font-medium leading-5" style={{ color: dark ? "#86efac" : "var(--color-signal-ink)" }}>
      <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={dark ? GREEN : "var(--color-signal-ink)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
      </svg>
      After payment, you&apos;ll get your confirmation on WhatsApp.
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

  const maxX = Math.max(0, trackWidth - THUMB - INSET * 2);
  const x = busy ? maxX : dragX;

  function complete() {
    stopSwipeWhoosh();
    playSwipeBurst();
    setDragX(0);
    setDragging(false);
    onComplete();
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, lastX: 0, lastT: performance.now(), velocity: 0 };
    startSwipeWhoosh();
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
    setSwipeWhoosh(d.velocity, maxX ? nx / maxX : 0);
    setDragX(nx);
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
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
    if (busy) return;
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      complete();
    }
  }

  const trans = dragging ? "none" : "transform .45s cubic-bezier(.2,.9,.25,1.1), opacity .3s ease";
  const fillX = x - trackWidth + THUMB;

  return (
    <div
      ref={trackRef}
      className="relative h-[60px] select-none overflow-hidden border border-white/15 bg-[#1a1211] shadow-[inset_0_2px_8px_rgba(0,0,0,.5)]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "linear-gradient(90deg, rgba(255,45,22,0) 0%, rgba(255,45,22,.7) 100%)", transform: `translateX(${fillX}px)`, transition: trans }}
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
        {busy ? <span className="text-white">{busyLabel}</span> : <span className={styles.label}>{label}</span>}
      </div>
      {!busy && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-[18px] flex items-center" style={{ opacity: Math.max(0, 1 - dragX / 120) }}>
          {[0, 0.18, 0.36].map((delay) => (
            <svg key={delay} className={styles.chev} style={{ animationDelay: `${delay}s`, marginLeft: delay ? -4 : 0 }} width="14" height="18" viewBox="0 0 14 18" fill="none" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 3l6 6-6 6" />
            </svg>
          ))}
        </div>
      )}
      <button
        type="button"
        aria-label={busy ? busyLabel : ariaLabel}
        aria-disabled={busy}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={onKeyDown}
        className={`${styles.thumb} absolute left-1 top-1 flex size-[50px] items-center justify-center bg-[linear-gradient(135deg,#ff7a66,#ff2d16)] text-white shadow-[0_6px_18px_-4px_rgba(255,45,22,.75),inset_0_1px_0_rgba(255,255,255,.35)]`}
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
