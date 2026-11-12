"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { httpRegistrationApi, mockRegistrationApi } from "@/lib/client/eventRegistration";
import { joinedSince, shelfSlots } from "@/lib/client/enrolled";
import type { HostedEventDetail } from "@/lib/hostedEvents";
import styles from "@/components/scene/hosted/ReadersEnrolled.module.css";

/**
 * "Readers enrolled" bookshelf, from the owner's design, in SCENE fonts and
 * red with square corners. One spine per real registration; the next free
 * seat glows as "yours". The count refreshes every 30 s; "LIVE" shows only
 * while that works, and "+1 just joined" only when the real count goes up.
 */

const POLL_MS = 30_000;
const MUTED = "#b5aeaa";
const RED_TEXT = "#ff8a77";

export function ReadersEnrolled({ event, api: apiKind, }: { event: HostedEventDetail; api: "http" | "mock"; registerAnchorId?: string }) {
  const reduceMotion = useReducedMotion();
  const api = useMemo(() => (apiKind === "mock" ? mockRegistrationApi() : httpRegistrationApi(event.id)), [apiKind, event.id]);
  const [seats, setSeats] = useState({ booked: event.hosted.registeredCount, capacity: event.hosted.capacity });
  const [live, setLive] = useState(false);
  const [joined, setJoined] = useState(0);
  const [freshFrom, setFreshFrom] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const lastCount = useRef<number | null>(null);

  // Count up to the real number once, as in the design.
  useEffect(() => {
    if (reduceMotion) return;
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      interval = setInterval(() => {
        n += 1;
        setShown(Math.min(n, seats.booked));
        if (n >= seats.booked && interval) clearInterval(interval);
      }, 70);
    }, 350);
    return () => {
      clearTimeout(start);
      if (interval) clearInterval(interval);
    };
    // Only the first count animates; later changes update `shown` directly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  // Poll the real seat count.
  useEffect(() => {
    let active = true;
    let hideJoined: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const result = await api.getSeats();
        if (!active || !result) {
          if (active) setLive(false);
          return;
        }
        setLive(true);
        const delta = joinedSince(lastCount.current, result.registeredCount);
        if (delta > 0 && lastCount.current !== null) {
          setFreshFrom(lastCount.current);
          setJoined(delta);
          setShown(result.registeredCount);
          clearTimeout(hideJoined);
          hideJoined = setTimeout(() => active && setJoined(0), 4200);
        } else if (lastCount.current !== null) {
          setShown(result.registeredCount);
        }
        lastCount.current = result.registeredCount;
        setSeats({ booked: result.registeredCount, capacity: result.capacity });
      } catch {
        if (active) setLive(false);
      }
    };
    void poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
      clearTimeout(hideJoined);
    };
  }, [api]);

  const slots = shelfSlots(seats);
  const display = reduceMotion ? seats.booked : shown;
  const open = Math.max(0, seats.capacity - seats.booked);

  return (
    <section
      aria-labelledby="enrolled-title"
      className="relative overflow-hidden border-2 border-foreground bg-[linear-gradient(160deg,#211813_0%,#14130d_55%,#170f0c_100%)] p-5 text-white sm:p-7"
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
          {live && (
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.12em]" style={{ color: RED_TEXT }}>
              <span className={`${styles.dot} size-2 rounded-full bg-primary shadow-[0_0_10px_#ff2d16]`} aria-hidden="true" />
              LIVE
            </span>
          )}
        </div>

        <div className="mt-3.5 flex flex-wrap items-baseline gap-3">
          <span className="min-w-[2ch] font-display text-[64px] font-black leading-none tracking-[-0.045em] tabular-nums [text-shadow:0_0_40px_rgba(255,45,22,.45)] sm:text-[76px]" aria-hidden="true">
            {display}
          </span>
          <span className="font-display text-[20px] font-bold leading-[1.15] sm:text-[22px]">
            <span className="sr-only">{seats.booked} </span>
            {seats.booked === 1 ? "reader" : "readers"}
            <br />
            <span style={{ color: RED_TEXT }}>already in.</span>
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

        <div role="img" aria-label={`${seats.booked} of ${seats.capacity} seats taken`} className="mt-6 flex h-[124px] items-end gap-1 px-0.5">
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
            ) : (
              <div key={i} className={`${styles.open} ${slot.kind === "you" ? styles.you : ""}`} style={{ height: 104, animationDelay: `${i * 55}ms` }} />
            ),
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
        </div>
      </div>
    </section>
  );
}
