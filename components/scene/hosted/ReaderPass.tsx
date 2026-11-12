"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useElementWidth } from "@/lib/client/useStageScale";
import { resolveSwipe } from "@/lib/client/swipe";
import { formatRupees, seatProgress, type HostedEventInfo } from "@/lib/hostedEvents";
import styles from "@/components/scene/hosted/ReaderPass.module.css";

/**
 * The "Reader pass register card" design, in SCENE colours. `ReaderPass` is
 * the opening state (pass, price, seats, swipe); `SwipeToPay` is reused at the
 * pay step.
 */

const THUMB = 48;
const INSET = 4;

export function ReaderPass({ hosted, onSwipe }: { hosted: HostedEventInfo; onSwipe: () => void }) {
  const price = formatRupees(hosted.pricePaise);
  const seats = seatProgress(hosted);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 bg-foreground px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 9a2 2 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a2 2 0 0 1 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1z" />
            <path d="M14 5v14" strokeDasharray="2 3" />
          </svg>
          READER PASS
        </span>
        <span className="inline-flex items-center gap-2 bg-primary-ink px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
          <span className={`${styles.dot} size-1.5 rounded-full bg-white`} aria-hidden="true" />
          {seats.left <= 10 ? `Only ${seats.left} ${seats.left === 1 ? "spot" : "spots"} left` : `${seats.left} spots left`}
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-2.5">
        <span className="font-display text-[56px] font-black leading-none tracking-[-0.04em] text-primary sm:text-[68px]">{price}</span>
        <span className="text-[15px] font-medium text-muted-foreground">per reader</span>
      </div>

      <div className="mt-6">
        <div
          className="h-3 overflow-hidden border-2 border-foreground bg-muted"
          role="progressbar"
          aria-label="Seats booked"
          aria-valuemin={0}
          aria-valuemax={seats.capacity}
          aria-valuenow={seats.booked}
        >
          <div
            className={`${styles.fill} h-full bg-primary`}
            style={{ width: `${seats.percent}%` }}
          />
        </div>
        <div className="mt-2.5 flex justify-between font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          <span>
            {seats.booked} of {seats.capacity} booked
          </span>
          <span className="font-semibold text-primary-ink">{seats.left} left</span>
        </div>
      </div>

      <div className="mt-6">
        <SwipeToPay label={`Swipe to book · ${price}`} ariaLabel={`Swipe right, or press Enter, to book a reader pass for ${price}`} onComplete={onSwipe} />
      </div>

      <PassFooter />
    </div>
  );
}

export function PassFooter() {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-[18px] gap-y-2 text-[13px] font-medium text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-signal-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="5" width="20" height="14" rx="3" />
          <path d="M2 10h20" />
        </svg>
        Pay by UPI or card
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-signal-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12z" />
        </svg>
        Confirmation on WhatsApp
      </span>
    </div>
  );
}

/**
 * Swipe-to-pay slider from the design. Drag the thumb past 85%, tap it, or
 * press Enter / Space / → to complete. While `busy`, it sits at the end with a
 * spinner and `busyLabel`.
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
  const start = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const maxX = Math.max(0, trackWidth - THUMB - INSET * 2);
  const x = busy ? maxX : dragX;

  function complete() {
    setDragX(0);
    setDragging(false);
    onComplete();
  }

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    if (busy) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = e.clientX;
    setDragging(true);
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    setDragX(Math.max(0, Math.min(maxX, e.clientX - start.current)));
  }
  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    if (start.current === null) return;
    const dx = e.clientX - start.current;
    start.current = null;
    if (resolveSwipe({ dx, max: maxX }) === "complete") complete();
    else {
      setDragX(0);
      setDragging(false);
    }
  }
  function onPointerCancel() {
    start.current = null;
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
  const labelOpacity = busy ? 1 : Math.max(0, 1 - dragX / 160);

  return (
    <div
      ref={trackRef}
      className="relative h-[60px] select-none overflow-hidden border-2 border-foreground bg-foreground"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, rgba(255,45,22,0) 0%, rgba(255,45,22,.45) 100%)",
          transform: `translateX(${x - trackWidth + THUMB}px)`,
          transition: trans,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-14 pr-12 font-mono text-xs font-semibold uppercase tracking-[0.12em]"
        style={{ opacity: labelOpacity }}
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
        className={`${styles.thumb} absolute left-1 top-1 flex size-12 items-center justify-center bg-primary text-white`}
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
