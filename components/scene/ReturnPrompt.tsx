"use client";

import type { PublicEvent } from "@/lib/events";
import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { downloadEventIcs, googleCalendarUrl, type CalendarEventInput } from "@/lib/client/ics";
import { Btn, BtnLink, Mono, SaveIcon } from "@/components/scene/ui";

function toCalendarInput(event: PublicEvent): CalendarEventInput {
  return {
    eventId: event.id,
    title: event.title,
    summary: event.summary,
    startAt: event.startAt!,
    endAt: event.endAt,
    isOnline: event.isOnline,
    venueName: event.venueName,
    city: event.city,
    primarySourceDomain: event.primarySourceDomain,
  };
}

/**
 * Fires when someone comes back to the tab after opening a registration page.
 *
 * Replaces a permanent "Add to calendar" button: the moment that actually
 * matters is right after they've registered, not while they're still browsing.
 */
export function ReturnPrompt({
  event,
  saved,
  onSave,
  onClose,
}: {
  event: PublicEvent;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  // No date means nothing to put in a calendar — the prompt would be a dead end.
  const canAddToCalendar = !!event.startAt;
  const calendarInput = canAddToCalendar ? toCalendarInput(event) : null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Did you register?"
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 sm:p-5"
    >
      <div className="scene-rise w-full max-w-lg border-2 border-foreground bg-card shadow-[8px_8px_0_0_var(--color-foreground)]">
        <div className="flex items-center justify-between border-b-2 border-foreground bg-foreground px-3 py-2 text-background">
          <Mono className="text-[11px]">Welcome back · Last viewed</Mono>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="font-mono text-base leading-none hover:text-primary"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-muted-foreground">Did you register for</p>
          <h3 className="mt-0.5 font-display text-lg font-bold leading-tight tracking-tight">
            {event.title}
          </h3>
          {event.startAt && (
            <Mono className="mt-1 block text-[11px] text-muted-foreground">
              {formatSceneDate(event.startAt)} · {formatSceneTime(event.startAt)} IST
            </Mono>
          )}

          {canAddToCalendar ? (
            <>
              <p className="mt-3 text-sm">Lock it in — add it to your calendar so you don&apos;t miss it.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <BtnLink
                  href={googleCalendarUrl(calendarInput!)}
                  variant="solid"
                  className="flex-1 !border-accent !bg-accent !text-accent-foreground hover:!border-foreground hover:!bg-foreground"
                >
                  Add to Google Calendar
                </BtnLink>
                <Btn variant="outline" onClick={() => downloadEventIcs(calendarInput!)}>
                  Apple / Outlook (.ics)
                </Btn>
              </div>
              {!event.endAt && (
                <Mono className="mt-2 block text-[10px] text-muted-foreground">
                  End time not published — calendar entry assumes 2 hours.
                </Mono>
              )}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              This listing has no confirmed date yet, so there&apos;s nothing to add to a calendar. Save it
              and we&apos;ll keep it on your shortlist.
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t-2 border-dashed border-foreground/25 pt-3">
            <button
              type="button"
              onClick={onSave}
              aria-pressed={saved}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground hover:text-primary-ink"
            >
              <SaveIcon filled={saved} />
              {saved ? "Saved to shortlist" : "Save to shortlist"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
