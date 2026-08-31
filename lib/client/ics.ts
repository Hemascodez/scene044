/** Used only when the source didn't publish an end time. Stated as an
 *  assumption in the UI rather than presented as a known fact. */
const ASSUMED_DURATION_MS = 2 * 60 * 60 * 1000;

export interface CalendarEventInput {
  eventId: number;
  title: string;
  summary: string | null;
  startAt: string;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  city: string;
  primarySourceDomain: string;
}

function icsEscape(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function toUtcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function resolveEnd(event: CalendarEventInput): Date {
  if (event.endAt) {
    const end = Date.parse(event.endAt);
    if (!Number.isNaN(end) && end > Date.parse(event.startAt)) return new Date(end);
  }
  return new Date(Date.parse(event.startAt) + ASSUMED_DURATION_MS);
}

function locationOf(event: CalendarEventInput): string {
  return event.isOnline ? "Online" : [event.venueName, event.city].filter(Boolean).join(", ");
}

/** Points at our own redirect so the click is still logged from the calendar entry. */
function goUrl(eventId: number): string {
  return `${window.location.origin}/api/go/${eventId}`;
}

function descriptionOf(event: CalendarEventInput): string {
  return [event.summary, `Source: ${event.primarySourceDomain}`, `Details: ${goUrl(event.eventId)}`]
    .filter(Boolean)
    .join("\n");
}

export function downloadEventIcs(event: CalendarEventInput): void {
  const start = new Date(Date.parse(event.startAt));
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SCENE044//Chennai Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:scene044-event-${event.eventId}@scene044.app`,
    `DTSTAMP:${toUtcStamp(new Date())}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(resolveEnd(event))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `LOCATION:${icsEscape(locationOf(event))}`,
    `DESCRIPTION:${icsEscape(descriptionOf(event))}`,
    `URL:${goUrl(event.eventId)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `scene044-event-${event.eventId}.ics`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Google Calendar's public template URL — no OAuth, no stored credentials. */
export function googleCalendarUrl(event: CalendarEventInput): string {
  const start = new Date(Date.parse(event.startAt));
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toUtcStamp(start)}/${toUtcStamp(resolveEnd(event))}`,
    details: descriptionOf(event),
    location: locationOf(event),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
