import { CATEGORIES, type Category, type EventStatus, type PriceType } from "@/lib/types";

/**
 * The shape a curator edits and the server persists to
 * `discovery_items.curator_draft`.
 *
 * Dates are kept as separate date/time strings because that's what the form's
 * native `<input type="date">` / `<input type="time">` pair produces; they're
 * combined into an IST instant only at the boundary (see `draftToInstant`).
 * Storing a half-typed ISO string would mean persisting invalid timestamps.
 */
export interface CuratorDraft {
  title: string;
  summary: string;
  category: Category | "";
  startDate: string; // yyyy-mm-dd (IST)
  startTime: string; // HH:mm (IST)
  endDate: string;
  endTime: string;
  isOnline: boolean;
  venueName: string;
  venueAddress: string;
  organizerName: string;
  /** The outbound "View event" destination. Falls back to the source URL. */
  registrationUrl: string;
  posterImageUrl: string;
  /** "" means the source never stated a price — stored as NULL, shown as nothing. */
  priceType: PriceType | "";
  priceNote: string;
  status: Extract<EventStatus, "live" | "postponed" | "cancelled" | "expired">;
}

export function emptyCuratorDraft(): CuratorDraft {
  return {
    title: "",
    summary: "",
    category: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    isOnline: false,
    venueName: "",
    venueAddress: "",
    organizerName: "",
    registrationUrl: "",
    posterImageUrl: "",
    priceType: "",
    priceNote: "",
    status: "live",
  };
}

/** IST is a fixed UTC+05:30 offset with no DST, so this conversion is exact. */
const IST_OFFSET = "+05:30";

export function draftToInstant(date: string, time: string): string | null {
  if (!date) return null;
  const iso = `${date}T${time || "00:00"}:00${IST_OFFSET}`;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

/** Splits a stored UTC instant back into the IST date/time the form expects. */
export function instantToDraftParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") map[p.type] = p.value;
  const hour = String(Number(map.hour) % 24).padStart(2, "0");
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}` };
}

/** Blocking problems only — anything that would publish a misleading card. */
export function validateDraftForPublish(draft: CuratorDraft): string[] {
  const errors: string[] = [];
  if (!draft.title.trim()) errors.push("Title required");
  if (!draft.category) errors.push("Category required");
  else if (!(CATEGORIES as readonly string[]).includes(draft.category)) errors.push("Unknown category");
  if (!draft.startDate) errors.push("Start date required");
  if (!draft.isOnline && !draft.venueName.trim() && !draft.venueAddress.trim()) {
    errors.push("Venue or address required for in-person events");
  }
  const start = draftToInstant(draft.startDate, draft.startTime);
  const end = draftToInstant(draft.endDate, draft.endTime);
  if (draft.startDate && !start) errors.push("Start date is not a valid date");
  if (draft.endDate && !end) errors.push("End date is not a valid date");
  if (start && end && Date.parse(end) <= Date.parse(start)) errors.push("End must be after start");
  for (const [label, value] of [
    ["Registration URL", draft.registrationUrl],
    ["Poster URL", draft.posterImageUrl],
  ] as const) {
    if (value.trim() && !/^https?:\/\/\S+$/i.test(value.trim())) errors.push(`${label} must be http(s)`);
  }
  return errors;
}

/** Non-blocking things a curator should look at before publishing. */
export function draftWarnings(draft: CuratorDraft): string[] {
  const warnings: string[] = [];
  if (!draft.startTime) warnings.push("No start time — the card will show 12:00 am");
  if (!draft.summary.trim()) warnings.push("No summary — the detail view will look bare");
  if (!draft.organizerName.trim()) warnings.push("No organizer — card shows “Organizer not available”");
  if (!draft.posterImageUrl.trim()) warnings.push("No poster — a category Scene image will be used");
  if (!draft.priceType) warnings.push("Price not stated — no Free/Paid chip will show, and it won't appear under “Free to attend”");
  if (!draft.endDate && !draft.endTime) warnings.push("No end time — calendar entries assume 2 hours");
  return warnings;
}
