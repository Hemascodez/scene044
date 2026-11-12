"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useHostedSeatStats } from "@/components/scene/hosted/HostedSeatStats";
import { enrolledMode, joinedSince, shelfSlots } from "@/lib/client/enrolled";
import { RegistrationError } from "@/lib/client/eventRegistration";
import { REGISTER_OPEN_EVENT } from "@/components/scene/hosted/RegisterBar";
import { useHostedAuth } from "@/components/scene/hosted/hostedAuth";
import type { HostedEventDetail } from "@/lib/hostedEvents";
import styles from "@/components/scene/hosted/ReadersEnrolled.module.css";
import { hostedCardSolid } from "@/components/scene/hosted/hostedCard";

/**
 * "Readers enrolled" bookshelf, from the owner's design, in SCENE fonts and
 * red with square corners. One spine per real registration; the next free
 * seat glows as "yours". The count refreshes every 30 s; "LIVE" shows only
 * while that works, and "+1 just joined" only when the real count goes up.
 */

const MUTED = "#b5aeaa";
const RED_TEXT = "#ff8a77";

export function ReadersEnrolled({ event }: { event: HostedEventDetail; api: "http" | "mock"; registerAnchorId?: string }) {
  const reduceMotion = useReducedMotion();
  const { api, hosted, live } = useHostedSeatStats();
  const { requireAuth,profile } = useHostedAuth();
  const [waitlisted, setWaitlisted] = useState(false);
  const [waitBusy, setWaitBusy] = useState(false);
  const [waitError, setWaitError] = useState("");
  useEffect(()=>{let active=true;void api.getWaitlist().then(value=>{if(active)setWaitlisted(value);}).catch(()=>{});return()=>{active=false};},[api,profile?.phone]);
  const seats = { booked: hosted.registeredCount, capacity: hosted.capacity };
  const [joined, setJoined] = useState(0);
  const [freshFrom, setFreshFrom] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const lastCount = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const bookedRef = useRef(seats.booked);
  useEffect(() => {
    bookedRef.current = seats.booked;
  }, [seats.booked]);
  // The shelf fills and the number counts up when the card scrolls into view,
  // not on page load (by then nobody is looking at it). Once only.
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Count up to the real number once, as in the design.
  useEffect(() => {
    if (reduceMotion || !inView) return;
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        n += 1;
        setShown(Math.min(n, bookedRef.current));
        if (n >= bookedRef.current && interval) clearInterval(interval);
      }, 70);
    }, 250);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
  }, [reduceMotion, inView]);

  // Animate changes from the one shared real-registration snapshot.
  useEffect(() => {
    let hideJoined: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(() => {
        const delta = joinedSince(lastCount.current, hosted.registeredCount);
        if (delta > 0 && lastCount.current !== null) {
          setFreshFrom(lastCount.current);
          setJoined(delta);
          setShown(hosted.registeredCount);
          hideJoined = setTimeout(() => setJoined(0), 4200);
        } else if (lastCount.current !== null) {
          setShown(hosted.registeredCount);
        }
        lastCount.current = hosted.registeredCount;
    }, 0);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideJoined);
    };
  }, [hosted.registeredCount]);

  const slots = shelfSlots(seats);
  const display = reduceMotion ? seats.booked : shown;
  const open = Math.max(0, seats.capacity - seats.booked);
  const mode = enrolledMode(seats);
  const play = inView || reduceMotion;

  /** First visitor taps their seat: same as swiping the Reader pass. */
  function takeFirstSeat() {
    window.dispatchEvent(new CustomEvent(REGISTER_OPEN_EVENT));
    document.getElementById("register")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  function toggleWaitlist() {
    setWaitError("");
    requireAuth(async () => {
      setWaitBusy(true);
      try {
        if (waitlisted) await api.leaveWaitlist();
        else await api.joinWaitlist();
        setWaitlisted(!waitlisted);
      } catch (error) {
        setWaitError(error instanceof RegistrationError ? error.message : "Couldn't update the waitlist. Try again.");
      } finally {
        setWaitBusy(false);
      }
    });
  }

  return (
    <section
      ref={sectionRef}
      data-event-id={event.id}
      aria-labelledby="enrolled-title"
      className={`relative overflow-hidden border-2 border-foreground p-5 text-white sm:p-7 ${hostedCardSolid}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(255,45,22,.3), rgba(255,45,22,0) 55%)" }}
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 id="enrolled-title" className="font-mono text-[11px] font-bold tracking-[0.16em]" style={{ color: MUTED }}>
            WHO&apos;S JOINING
          </h2>
          {(mode !== "filling" || live) && (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: RED_TEXT }}>
              <span className={`${styles.dot} size-2 rounded-full bg-primary shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
              {mode === "empty" ? "OPEN FOR SIGN-UPS" : mode === "full" ? "SOLD OUT" : "LIVE"}
            </span>
          )}
        </div>

        <div className="mt-3.5 flex flex-wrap items-baseline gap-3">
          <span className="min-w-[2ch] font-display text-[64px] font-black leading-none tracking-[-0.045em] tabular-nums [text-shadow:0_0_40px_rgba(255,45,22,.45)] sm:text-[76px]" aria-hidden="true">
            {display}
          </span>
          <span className="font-display text-[20px] font-bold leading-[1.15] sm:text-[22px]">
            <span className="sr-only">{seats.booked} </span>
            {mode === "empty" ? "readers so far." : mode === "full" ? "readers in." : seats.booked === 1 ? "reader" : "readers"}
            <br />
            <span style={{ color: RED_TEXT }}>{mode === "empty" ? "Be the first." : mode === "full" ? "Every seat is taken." : "already in."}</span>
          </span>
          {joined > 0 && (
            <span
              role="status"
              className={`${styles.toast} ml-auto self-center border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.1em]`}
              style={{ background: "rgba(74,222,128,.14)", borderColor: "rgba(74,222,128,.5)", color: "#86efac" }}
            >
              +{joined} JUST JOINED
            </span>
          )}
        </div>

        <div className="relative mt-6">
        <div
          role={mode === "empty" ? "group" : "img"}
          aria-label={mode === "empty" ? `${seats.capacity} seats, all open` : `${seats.booked} of ${seats.capacity} seats taken`}
          data-play={play ? "true" : "false"}
          className={`${styles.shelf} flex h-[124px] items-end gap-1 px-0.5 ${mode === "empty" ? "pt-11" : ""}`}
        >
          {slots.map((slot, i) =>
            slot.kind === "taken" ? (
              <div
                key={i}
                className={`${styles.spine} ${freshFrom !== null && i >= freshFrom ? styles.drop : ""}`}
                style={{ height: slot.height, animationDelay: freshFrom !== null && i >= freshFrom ? "0ms" : `${i * 55}ms` }}
              >
                <div
                  className={styles.body}
                  style={{
                    background: `linear-gradient(90deg, rgba(0,0,0,.28), rgba(255,255,255,.14) 42%, rgba(0,0,0,.22)), ${slot.colour[0]}`,
                    animationDelay: `-${i * 200}ms`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,.25), 0 6px 10px -6px rgba(0,0,0,.8)",
                  }}
                >
                  <div className="absolute inset-x-0 top-3 h-[3px] opacity-75" style={{ background: slot.colour[1] }} />
                  <div className="absolute inset-x-0 top-[19px] h-px opacity-50" style={{ background: slot.colour[1] }} />
                  <div className="absolute inset-x-[5px] bottom-3 h-2 opacity-35" style={{ background: slot.colour[1] }} />
                </div>
              </div>
            ) : slot.kind === "you" && mode === "empty" ? (
              <button
                key={i}
                type="button"
                onClick={takeFirstSeat}
                aria-label="Take the first seat"
                className={`${styles.open} ${styles.you} ${styles.youButton}`}
                style={{ height: 104, animationDelay: "0ms" }}
              >
                <span className={styles.youTag} aria-hidden="true">YOU</span>
              </button>
            ) : (
              <div key={i} className={`${styles.open} ${slot.kind === "you" ? styles.you : ""}`} style={{ height: 104, animationDelay: `${i * 55}ms` }} />
            ),
          )}
        </div>
        {mode === "full" && (
          <div aria-hidden="true" data-play={play ? "true" : "false"} className={styles.stampWrap}>
            <span className={styles.stamp}>FULL HOUSE</span>
          </div>
        )}
        </div>
        <div aria-hidden="true" className="h-2.5 bg-[linear-gradient(180deg,#7a4a2b_0%,#4a2a16_100%)] shadow-[0_12px_20px_-6px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.2)]" />

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] font-medium" style={{ color: MUTED }}>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-4 w-2.5 bg-[linear-gradient(180deg,#ff6a55,#e0301f)]" />
              {seats.booked} enrolled
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-4 w-2.5 border-[1.5px] border-dashed border-white/35" />
              {open} {open === 1 ? "seat" : "seats"} open
            </span>
          </div>
          {mode === "empty" && (
            <button
              type="button"
              onClick={takeFirstSeat}
              className="inline-flex min-h-11 items-center font-mono text-[11px] font-bold tracking-[0.12em] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              style={{ color: RED_TEXT }}
            >
              TAKE THE FIRST SEAT →
            </button>
          )}
          {mode === "full" &&
            (waitlisted ? (
              <span className="inline-flex flex-wrap items-center gap-2.5">
                <span
                  className={`${styles.toast} inline-flex items-center gap-2 border px-3 py-1.5 font-mono text-[11px] font-bold tracking-[0.08em]`}
                  style={{ background: "rgba(74,222,128,.14)", borderColor: "rgba(74,222,128,.5)", color: "#86efac" }}
                  role="status"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" /></svg>
                  YOU&apos;RE ON THE WAITLIST
                </span>
                <button
                  type="button"
                  onClick={toggleWaitlist}
                  disabled={waitBusy}
                  className="min-h-11 px-1.5 text-[13px] font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                  style={{ color: RED_TEXT }}
                >
                  Undo
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={toggleWaitlist}
                disabled={waitBusy}
                className={`${styles.waitBtn} inline-flex min-h-11 items-center gap-2 bg-[linear-gradient(135deg,#ff8a77,#ff5a43)] px-3.5 font-display text-sm font-bold text-[#1a0a08] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-70`}
              >
                {waitBusy ? "Joining…" : "Join the waitlist"}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            ))}
        </div>
        {waitError && (
          <p role="alert" className="mt-3 text-sm" style={{ color: RED_TEXT }}>
            {waitError}
          </p>
        )}
      </div>
    </section>
  );
}
