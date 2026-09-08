"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { PublicEvent } from "@/lib/events";
import { formatSceneDate, formatSceneTime, relativeChecked } from "@/lib/client/istTime";
import {
  audienceTagsFor,
  deriveSceneStatus,
  eventShortIntro,
  eventSummaryBullets,
  posterFor,
} from "@/lib/client/sceneEvent";
import { useOpensInNewTab } from "@/lib/client/usePointerType";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import { eventPath } from "@/lib/seo";
import { AlertsBanner } from "@/components/scene/AlertsBanner";
import { EventGlance } from "@/components/scene/EventGlance";
import { Btn, BtnLink, Mono, SaveIcon, StatusBadge } from "@/components/scene/ui";


export function EventDetail({
  event,
  saved,
  onToggleSave,
  onClose,
  onVisit,
}: {
  event: PublicEvent;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
  onVisit: (event: PublicEvent) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const status = deriveSceneStatus(event);
  const poster = posterFor(event);
  const [posterFailed, setPosterFailed] = useState(false);
  const fieldLabel = getFieldCardForCategory(event.category)?.label ?? event.category;
  const audienceTags = audienceTagsFor(event);
  const intro = eventShortIntro(event);
  const bullets = eventSummaryBullets(event);
  // Phones navigate in place so the Back button returns here; see the hook.
  const newTab = useOpensInNewTab();

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Focus trap: a modal that lets Tab walk into the feed behind it strands
      // keyboard users with no way back to the close button.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  function share() {
    const text = `${event.title}${event.startAt ? ` — ${formatSceneDate(event.startAt)}, ${formatSceneTime(event.startAt)} IST` : ""}. Found on SCENE/044.`;
    const url = `${window.location.origin}${eventPath(event)}`;
    if (navigator.share) {
      navigator.share({ title: event.title, text, url }).catch(() => {
        /* dismissed by the user — not an error */
      });
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  return (
    <div
      className="scene-fade-in fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      style={{ perspective: "1400px" }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        className="scene-flip-in flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden border-2 border-foreground bg-card shadow-[8px_8px_0_0_var(--color-foreground)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b-2 border-foreground bg-foreground px-4 py-2.5 text-background">
          <Mono className="text-[11px]">SCENE/044 · Event</Mono>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close event details"
            className="font-mono text-lg leading-none hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto">
          {posterFailed ? (
            <div className="flex aspect-[16/6] w-full flex-col items-center justify-center border-b-2 border-foreground bg-secondary">
              <Mono className="text-[10px] text-muted-foreground">No poster available</Mono>
            </div>
          ) : (
            <div className="relative aspect-[16/9] w-full overflow-hidden border-b-2 border-foreground bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary third-party poster origins */}
              <img
                src={poster.src}
                alt={poster.isStock ? "" : `Poster for ${event.title}`}
                aria-hidden={poster.isStock || undefined}
                onError={() => setPosterFailed(true)}
                className="size-full object-cover"
              />
              {poster.isStock && (
                <span className="absolute bottom-0 right-0 m-2 bg-foreground/80 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-background/90">
                  Scene image · not the official poster
                </span>
              )}
            </div>
          )}

          <div className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="bg-foreground px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
                {fieldLabel}
              </span>
              <StatusBadge status={status} />
              {event.priceType === "free" && (
                <span className="bg-signal-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Free
                </span>
              )}
              {event.priceType === "paid" && (
                <span className="border-2 border-foreground px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]">
                  {event.priceNote ?? "Paid"}
                </span>
              )}
              {audienceTags.map((tag) => (
                <span
                  key={tag.label}
                  className="border border-foreground/35 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em]"
                >
                  #{tag.label}
                </span>
              ))}
            </div>

            <h2 className="font-display text-2xl font-black leading-tight tracking-tight">{event.title}</h2>

            {intro && <p className="mt-3 text-sm leading-relaxed text-foreground/70">{intro}</p>}

            <EventGlance bullets={bullets} className="mt-5" />

            {status === "cancelled" && (
              <Alert tone="bad">This event has been cancelled by the organizer.</Alert>
            )}
            {status === "postponed" && (
              <Alert>This event was postponed. A new date has not been confirmed.</Alert>
            )}
            {status === "uncertain" && (
              <Alert>
                We found this event but not a confirmed date. Check the original source before making plans.
              </Alert>
            )}

            {/* Only ever set when the source published offers.validThrough —
                the copy is forbidden from inventing a closing date. */}
            {event.registrationNote && (
              <p className="mt-3 inline-flex items-center gap-2 border-l-4 border-warn-ink bg-secondary px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-warn-ink">
                <span aria-hidden>⏱</span>
                {event.registrationNote}
              </p>
            )}

            <div className="mt-4">
              <Row label="Date & time">
                {event.startAt ? (
                  <>
                    {formatSceneDate(event.startAt)} · {formatSceneTime(event.startAt)}
                    {event.endAt && ` – ${formatSceneTime(event.endAt)}`} (IST)
                  </>
                ) : (
                  <span className="italic text-muted-foreground">Not announced</span>
                )}
              </Row>
              <Row label={event.isOnline ? "Format" : "Venue"}>
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
              </Row>
              <Row label="Organizer">
                {event.organizerName ?? (
                  <span className="italic text-muted-foreground">Organizer not available</span>
                )}
              </Row>
              <Row label="Price">
                {event.priceType === "free"
                  ? "Free to attend"
                  : event.priceType === "paid"
                    ? (event.priceNote ?? "Paid — amount not published")
                    : "Not stated on the source page"}
              </Row>
              <Row label="Source">
                {event.primarySourceDomain}
                {event.otherSourceDomains.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    · also seen on {event.otherSourceDomains.join(", ")}
                  </span>
                )}
              </Row>
              <Row label="Last checked">
                {event.lastVerifiedAt
                  ? `${relativeChecked(event.lastVerifiedAt)} by SCENE/044`
                  : "Not re-checked since discovery"}
              </Row>
            </div>

            <AlertsBanner categoryHint={fieldLabel} className="mt-5" />
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-foreground bg-secondary p-4">
          <div className="flex flex-wrap gap-2">
            <BtnLink
              href={`/api/go/${event.id}`}
              variant="solid"
              className="flex-1"
              newTab={newTab}
              onNavigate={() => onVisit(event)}
            >
              View original {newTab ? "↗" : "→"}
            </BtnLink>
            <Btn variant="outline" onClick={onToggleSave}>
              <SaveIcon filled={saved} />
              {saved ? "Saved" : "Save"}
            </Btn>
            <Btn variant="outline" onClick={share}>
              Share
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b-2 border-dashed border-foreground/20 py-3">
      <Mono className="text-[10px] text-muted-foreground">{label}</Mono>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Alert({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "bad" }) {
  return (
    <div
      className={`mt-4 border-l-4 px-3 py-2 text-sm ${
        tone === "bad" ? "border-primary-ink bg-primary/10" : "border-warn-ink bg-warn/10"
      }`}
    >
      {children}
    </div>
  );
}
