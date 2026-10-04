"use client";

import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { VenueIcon } from "@/components/venues/VenueUi";

const HOUR = 3_600_000;
const MINUTE = 60_000;
/** The response window the product promises hosts and organizers. */
export const REVIEW_WINDOW_HOURS = 48;

/**
 * The stages a `requested` booking passes through, and what each one means.
 *
 * Every stage here is something the system can actually vouch for, which is
 * why there is no "host notified" or "host is viewing it":
 *  - creating a booking does not message the host (see POST /api/venue-bookings);
 *    the host sees it when their dashboard next polls
 *  - nothing records that a host has opened a request
 * So the tracker shows what is TRUE: it is sent, it is sitting in the host's
 * queue, it is waiting on a decision, and the answer will appear on this page.
 * The one moving part is the real 48-hour clock.
 */
const STAGES = [
  { k: "sent", label: "Sent", hint: "Request logged" },
  { k: "queue", label: "In queue", hint: "On host's dashboard" },
  { k: "decision", label: "Awaiting host", hint: "Approve or decline" },
  { k: "answer", label: "Answer", hint: "Appears here" },
] as const;
/** Sent and in-queue are both true from the moment the booking row exists. */
const ACTIVE = 2;

const formatLeft = (ms: number) => {
  const h = Math.floor(ms / HOUR);
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.round(ms / MINUTE))}m left`;
};
const formatDue = (due: number) => new Date(due).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });

/**
 * "Request in flight" — a live view of the wait for a host's decision.
 *
 * There is deliberately no "Withdraw request" action: the organizer side of the
 * API has no way to cancel, and a button that did nothing would be worse than
 * none. If one is added later it belongs in the footer below.
 */
export function RequestFlight({ createdAt }: { createdAt: string }) {
  // Re-render each minute so the countdown stays truthful without a backend push.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE);
    return () => clearInterval(timer);
  }, []);

  const start = Number.isFinite(Date.parse(createdAt)) ? Date.parse(createdAt) : now;
  const windowMs = REVIEW_WINDOW_HOURS * HOUR;
  const due = start + windowMs;
  const remaining = due - now;
  const overdue = remaining <= 0;
  const progress = Math.min(1, Math.max(0, (now - start) / windowMs));

  return (
    <div className="border-[1.5px] border-foreground bg-venue-paper shadow-hard-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b-[1.5px] border-dashed border-foreground/30 px-4 py-2.5">
        <p className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase leading-[15px] tracking-[0.1em] text-foreground">
          <span aria-hidden className={`rf-beacon size-1.5 ${overdue ? "bg-primary-ink" : "bg-primary"}`} />
          {overdue ? "Past the 48-hour window" : "Request in flight"}
        </p>
        <p className={`font-mono text-[10px] uppercase leading-[15px] tracking-[0.06em] ${overdue ? "font-bold text-primary-ink" : "text-muted-foreground"}`}>
          {overdue ? `Was due ${formatDue(due)}` : `${formatLeft(remaining)} · by ${formatDue(due)}`}
        </p>
      </div>

      <ol className="flex items-start px-4 pb-3 pt-4">
        {STAGES.map((stage, i) => {
          const done = i < ACTIVE;
          const on = i === ACTIVE;
          const pending = i > ACTIVE;
          return (
            <Fragment key={stage.k}>
              <li aria-current={on ? "step" : undefined} className="flex w-[66px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[84px]">
                <span
                  aria-hidden
                  className={`relative grid size-7 place-items-center border-[1.5px] transition-colors duration-500 ${
                    done ? "border-foreground bg-signal text-white" : on ? `border-foreground bg-primary text-white ${overdue ? "" : "rf-halo"}` : "border-foreground/30 bg-white text-foreground/30"
                  }`}
                >
                  {done ? <VenueIcon name="check" className="size-3.5" /> : <span className={`size-1.5 rounded-full ${on ? "bg-white" : "bg-foreground/30"}`} />}
                </span>
                <span className={`font-mono text-[9px] font-bold uppercase leading-3 tracking-[0.06em] ${pending ? "text-muted-foreground/70" : "text-foreground"}`}>{stage.label}</span>
                <span className="hidden text-[10px] leading-[13px] text-muted-foreground sm:block">{stage.hint}</span>
              </li>
              {i < STAGES.length - 1 && (
                <span aria-hidden className="relative mt-[13px] h-[2px] min-w-4 flex-1 overflow-hidden bg-foreground/15">
                  {/* Completed track fills solid; the leg in progress stays dashed. */}
                  {i < ACTIVE ? (
                    <span className="rf-fill absolute inset-0 bg-foreground" />
                  ) : i === ACTIVE ? (
                    <>
                      <span className={`rf-dash absolute inset-0 ${overdue ? "opacity-40" : ""}`} />
                      {!overdue && <span className="rf-signal absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary" />}
                    </>
                  ) : null}
                </span>
              )}
            </Fragment>
          );
        })}
      </ol>

      <div className="px-4 pb-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={REVIEW_WINDOW_HOURS}
          aria-valuenow={Math.round(progress * REVIEW_WINDOW_HOURS)}
          aria-label={`${REVIEW_WINDOW_HOURS} hour response window`}
          className="h-1 w-full overflow-hidden bg-foreground/10"
        >
          <span className={`block h-full origin-left transition-transform duration-700 ease-out ${overdue ? "bg-primary-ink" : "bg-primary"}`} style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-foreground/15 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-5 text-foreground">
          {overdue
            ? "The host hasn't replied within 48 hours. Nothing has been charged — you can keep waiting, or look at other spaces."
            : `The host reviews your request within ${REVIEW_WINDOW_HOURS} hours. Nothing is charged yet.`}
        </p>
        {overdue && (
          <Link href="/venues/search" className="inline-block shrink-0 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-foreground underline underline-offset-4 hover:text-primary-ink">
            Find another space →
          </Link>
        )}
      </div>

      <p className="sr-only" aria-live="polite">
        {overdue
          ? `This request is past the ${REVIEW_WINDOW_HOURS} hour response window. Nothing has been charged.`
          : `Stage ${ACTIVE + 1} of ${STAGES.length}: ${STAGES[ACTIVE].label}. ${formatLeft(remaining)} in the host's ${REVIEW_WINDOW_HOURS} hour window.`}
      </p>
    </div>
  );
}
