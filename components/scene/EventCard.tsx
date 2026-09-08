"use client";

import { useState } from "react";
import Link from "next/link";
import type { PublicEvent } from "@/lib/events";
import { eventPath } from "@/lib/seo";
import { countdown, formatSceneDate, formatSceneTime, relativeChecked } from "@/lib/client/istTime";
import { deriveSceneStatus, isNewlyDiscovered, posterFor } from "@/lib/client/sceneEvent";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import { FreshnessDot, Mono, SaveIcon, StatusBadge } from "@/components/scene/ui";

export function EventCard({
  event,
  saved,
  onToggleSave,
  index = 0,
  lastViewed = false,
}: {
  event: PublicEvent;
  saved: boolean;
  onToggleSave: () => void;
  index?: number;
  lastViewed?: boolean;
}) {
  const status = deriveSceneStatus(event);
  const dimmed = status === "cancelled" || status === "expired";
  const poster = posterFor(event);
  const [posterFailed, setPosterFailed] = useState(false);
  // Tailwind v4 wraps every `hover:` utility in @media (hover: hover), so on a
  // touch screen the lift/zoom/tint never fire. `group-has-[:active]` covers
  // most touch browsers, but iOS Safari only sets :active on elements it
  // considers clickable — this explicit state makes the feedback deterministic
  // everywhere, and is directly assertable in a test.
  const [pressed, setPressed] = useState(false);
  const showImage = !posterFailed;
  const fieldLabel = getFieldCardForCategory(event.category)?.label ?? event.category;
  const href = eventPath(event);

  return (
    <article
      id={`event-${event.id}`}
      data-pressed={pressed ? "true" : undefined}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      onTouchCancel={() => setPressed(false)}
      /* min-w-0: a grid item defaults to min-width:auto, so the card refused
         to shrink below its content and rendered 474px wide inside a 341px
         track — that stray 124px is what made the whole page slide sideways
         on a phone. */
      className="scene-card scene-rise group relative min-w-0"
      // Capped so a long feed doesn't leave the last cards invisible for a second.
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      {/* Punched holes revealing the page ground — the ticket read. */}
      <span className="ticket-notch left-[-9px] top-1/2 size-[18px] -translate-y-1/2" />
      <span className="ticket-notch right-[-9px] top-1/2 size-[18px] -translate-y-1/2" />

      <div className="flex flex-col border-2 border-foreground bg-card shadow-[4px_4px_0_0] shadow-foreground transition-transform duration-200 group-hover:-translate-y-0.5 group-has-[:active]:-translate-y-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 motion-reduce:group-has-[:active]:translate-y-0 sm:min-h-[188px] sm:flex-row">
        {/* STUB — poster on top when stacked, on the left when wide */}
        <Link
          href={href}
          aria-label={`View details for ${event.title}`}
          className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:aspect-auto sm:w-[136px]"
        >
          {showImage ? (
            /* eslint-disable-next-line @next/next/no-img-element -- posters are
               arbitrary third-party origins; next/image would need every future
               event domain pre-registered in next.config remotePatterns. */
            <img
              src={poster.src}
              alt={poster.isStock ? "" : `Poster for ${event.title}`}
              aria-hidden={poster.isStock || undefined}
              onError={() => setPosterFailed(true)}
              className={`size-full object-cover transition-transform duration-500 group-hover:scale-105 group-has-[:active]:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-has-[:active]:scale-100 ${
                dimmed ? "opacity-50 grayscale" : ""
              }`}
              loading="lazy"
            />
          ) : (
            <div className="flex size-full flex-col items-center justify-center bg-secondary">
              <span className="font-display text-4xl font-black tracking-tighter text-muted-foreground/40">
                044
              </span>
              <Mono className="text-[9px] text-muted-foreground">No poster</Mono>
            </div>
          )}

          {/* Date/time overlay. Undated listings show the honest label instead
              of a fabricated date. */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/95 via-foreground/60 to-transparent p-2.5 pt-8 text-background">
            {event.startAt ? (
              <>
                <div className="font-display text-lg font-black leading-none tracking-tight">
                  {formatSceneTime(event.startAt)}
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-background/80">
                  {formatSceneDate(event.startAt)}
                </div>
                <div className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary">
                  {countdown(event.startAt)}
                </div>
              </>
            ) : (
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-background/80">
                Date not announced
              </div>
            )}
          </div>

          {isNewlyDiscovered(event) && (
            <span className="absolute left-0 top-0 m-1.5 bg-accent px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-foreground">
              New
            </span>
          )}
          {/* Top-right stack. Both flags can apply at once, and the bottom of
              the stub is already spoken for by the date/countdown overlay —
              putting anything there collides with it at this width. */}
          {(lastViewed || (poster.isStock && showImage)) && (
            <span className="absolute right-0 top-0 m-1.5 flex flex-col items-end gap-1">
              {lastViewed && (
                <span className="bg-primary-ink px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-white">
                  Last viewed
                </span>
              )}
              {poster.isStock && showImage && (
                <span className="bg-foreground/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-background/90">
                  Scene image
                </span>
              )}
            </span>
          )}
        </Link>

        {/* PERFORATION — horizontal when stacked, vertical when wide */}
        <div className="relative h-0 border-t-2 border-dashed border-foreground sm:h-auto sm:w-0 sm:border-l-2 sm:border-t-0">
          <span className="ticket-notch left-[-9px] top-[-9px] size-[18px]" />
          <span className="ticket-notch right-[-9px] top-[-9px] size-[18px] sm:bottom-[-9px] sm:left-[-9px] sm:right-auto sm:top-auto" />
        </div>

        {/* BODY
            min-w-0 is load-bearing: a flex item defaults to `min-width: auto`,
            so the nowrap `truncate` lines below would set the body's minimum
            width to their full text length and push the whole card open. */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-3.5">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <span className="min-w-0 truncate bg-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-background">
              {fieldLabel}
            </span>
            <StatusBadge status={status} />
          </div>

          <Link
            href={href}
            className="min-w-0 text-left focus-visible:underline focus-visible:outline-none"
          >
            <h3 className="line-clamp-2 font-display text-base font-bold leading-tight tracking-tight break-words transition-colors group-hover:text-primary-ink group-has-[:active]:text-primary-ink">
              {event.title}
            </h3>
          </Link>

          <div className="flex min-w-0 flex-col gap-1 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 font-mono text-muted-foreground" aria-hidden>
                ✦
              </span>
              <span className="truncate">
                {event.organizerName ?? (
                  <span className="italic text-muted-foreground">Organizer not available</span>
                )}
              </span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 font-mono text-muted-foreground" aria-hidden>
                ◈
              </span>
              <span className="truncate">
                {event.isOnline ? (
                  "Online event"
                ) : event.venueName ? (
                  <>
                    {event.venueName}
                    <span className="text-muted-foreground"> · {event.city}</span>
                  </>
                ) : (
                  <span className="italic text-muted-foreground">Venue not announced</span>
                )}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* Rendered only when the source actually stated a price. A null
                priceType means unknown, and showing nothing is the honest
                option — a missing chip is not a claim either way. */}
            {event.priceType === "free" && (
              <span className="border border-signal-ink px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-signal-ink">
                Free
              </span>
            )}
            {event.priceType === "paid" && (
              <span className="border border-foreground px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]">
                {event.priceNote ?? "Paid"}
              </span>
            )}
            <span className="flex items-center gap-1 border border-foreground/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              <FreshnessDot lastVerifiedAt={event.lastVerifiedAt} />
              {event.primarySourceDomain}
            </span>
            {event.otherSourceDomains.length > 0 && (
              <span className="border border-foreground/30 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
                +{event.otherSourceDomains.length} more source
                {event.otherSourceDomains.length === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="mt-auto flex min-w-0 items-center gap-2 border-t-2 border-dashed border-foreground/25 pt-2.5">
            <Link
              href={href}
              className="inline-flex items-center justify-center gap-2 border-2 border-foreground bg-foreground px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-background transition-all duration-150 hover:border-primary hover:bg-primary hover:text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0.5"
            >
              View event →
            </Link>
            <span className="flex-1 truncate font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
              {event.lastVerifiedAt ? `Checked ${relativeChecked(event.lastVerifiedAt)}` : "Not re-checked yet"}
            </span>
            <button
              type="button"
              onClick={onToggleSave}
              aria-pressed={saved}
              aria-label={saved ? `Remove ${event.title} from saved` : `Save ${event.title}`}
              className={`inline-flex items-center border-2 border-foreground px-2 py-1.5 transition-colors ${
                saved ? "bg-foreground text-background" : "bg-transparent hover:bg-secondary"
              }`}
            >
              <SaveIcon filled={saved} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
