/**
 * All event time maths happens in Asia/Kolkata, regardless of where the
 * visitor or the server is. A Chennai listing that says "this weekend" has to
 * mean Chennai's weekend even when read from another timezone.
 *
 * Month and weekday names are formatted from hand-written tables rather than
 * `Intl`'s own long/short names on purpose: ICU versions disagree on en-IN
 * abbreviations ("Sep" vs "Sept"), and Node's ICU and the browser's ICU
 * disagreeing would produce a React hydration mismatch on every card. Only
 * `Intl`'s numeric parts — which are unambiguous — are trusted.
 */

const IST_TIME_ZONE = "Asia/Kolkata";
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const STALE_CHECK_MS = 48 * 60 * 60 * 1000;

export interface ISTParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0 = Sunday .. 6 = Saturday
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const istFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: IST_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  weekday: "short",
});

export function getISTParts(date: Date): ISTParts {
  const map: Record<string, string> = {};
  for (const part of istFormatter.formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  };
}

/** Midnight IST for the given instant, as a UTC epoch-ms timestamp. */
function istStartOfDayMs(date: Date): number {
  const { year, month, day } = getISTParts(date);
  // IST is a fixed UTC+5:30 offset with no DST, so this is exact.
  return Date.UTC(year, month - 1, day) - 5.5 * 60 * 60 * 1000;
}

export type DateBucket = "today" | "this_week" | "this_weekend" | "later" | "past" | "unknown";

export function classifyDateBucket(startAtIso: string | null, now: Date = new Date()): DateBucket {
  if (!startAtIso) return "unknown";
  const startMs = Date.parse(startAtIso);
  if (Number.isNaN(startMs)) return "unknown";

  const daysDiff = Math.round((istStartOfDayMs(new Date(startMs)) - istStartOfDayMs(now)) / ONE_DAY_MS);
  if (daysDiff < 0) return "past";
  if (daysDiff === 0) return "today";

  // A rolling 7-day window, not a strict Mon-Sun calendar week: on a Sunday a
  // calendar week means "this week" shows nothing even with an event tomorrow,
  // which defeats the point of a "don't miss it" filter.
  if (daysDiff > 6) return "later";

  const eventWeekday = getISTParts(new Date(startMs)).weekday;
  return eventWeekday === 0 || eventWeekday === 6 ? "this_weekend" : "this_week";
}

export function isPastEvent(startAtIso: string | null, now: Date = new Date()): boolean {
  return classifyDateBucket(startAtIso, now) === "past";
}

/** "FRI, 11 SEP" — the stub's date line. */
export function formatSceneDate(iso: string): string {
  const p = getISTParts(new Date(iso));
  return `${WEEKDAY_LABELS[p.weekday]}, ${p.day} ${MONTH_LABELS[p.month - 1]}`;
}

/** Complete date for standalone event pages and other search-facing detail. */
export function formatSceneDateLong(iso: string): string {
  const p = getISTParts(new Date(iso));
  return `${WEEKDAY_LABELS[p.weekday]}, ${p.day} ${MONTH_LABELS[p.month - 1]} ${p.year}`;
}

/** "5:00 pm" — the stub's headline time. */
export function formatSceneTime(iso: string): string {
  const p = getISTParts(new Date(iso));
  const hour12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${hour12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "am" : "pm"}`;
}

/** "in 11d 0h" / "in 3h 20m" — how long until doors open. */
export function countdown(iso: string, now: Date = new Date()): string {
  const diff = Date.parse(iso) - now.getTime();
  if (diff <= 0) return "Started / passed";
  const mins = Math.floor(diff / 60_000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const minutes = mins % 60;
  if (days > 0) return `in ${days}d ${hours}h`;
  if (hours > 0) return `in ${hours}h ${minutes}m`;
  return `in ${minutes}m`;
}

/** "3 hrs ago" — when SCENE/044 last re-checked the listing. */
export function relativeChecked(iso: string, now: Date = new Date()): string {
  const mins = Math.round((now.getTime() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function isStaleCheck(iso: string | null, now: Date = new Date()): boolean {
  if (!iso) return true;
  return now.getTime() - Date.parse(iso) > STALE_CHECK_MS;
}
