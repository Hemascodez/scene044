import { normalizeUrl } from "@/lib/domain";
import { CATEGORIES, type Category, type EventStatus, type PriceType } from "@/lib/types";

const EDITABLE_STATUSES: EventStatus[] = ["live", "updated", "postponed", "cancelled", "expired"];

export interface NormalizedAdminEventUpdate {
  eventId: number;
  title: string;
  summary: string | null;
  highlights: string[];
  category: Category;
  startAt: string;
  endAt: string | null;
  isOnline: boolean;
  venueName: string | null;
  venueAddress: string | null;
  organizerName: string | null;
  posterImageUrl: string | null;
  priceType: PriceType | null;
  priceNote: string | null;
  primarySourceUrl: string;
  status: EventStatus;
}

export type AdminEventUpdateResult =
  | { ok: true; value: NormalizedAdminEventUpdate }
  | { ok: false; error: string };

const fail = (error: string): AdminEventUpdateResult => ({ ok: false, error });
const cleanNullable = (value: unknown): string | null =>
  typeof value === "string" ? value.trim() || null : null;

function safeHttpUrl(value: unknown): string | null {
  const raw = cleanNullable(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return normalizeUrl(parsed.toString());
  } catch {
    return null;
  }
}

function safePosterUrl(value: unknown): string | null {
  const raw = cleanNullable(value);
  if (!raw) return null;
  if (/^\/api\/poster\/\d+$/.test(raw)) return raw;
  return safeHttpUrl(raw);
}

export function normalizeAdminEventUpdate(input: unknown): AdminEventUpdateResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("invalid JSON body");
  const body = input as Record<string, unknown>;
  const eventId = Number(body.eventId);
  if (!Number.isInteger(eventId) || eventId <= 0) return fail("invalid eventId");

  const title = cleanNullable(body.title);
  if (!title) return fail("title is required");
  if (!(CATEGORIES as readonly unknown[]).includes(body.category)) return fail("invalid category");

  const startAt = cleanNullable(body.startAt);
  if (!startAt || Number.isNaN(Date.parse(startAt))) return fail("start date is required and must be valid");
  const endAt = cleanNullable(body.endAt);
  if (endAt && (Number.isNaN(Date.parse(endAt)) || Date.parse(endAt) <= Date.parse(startAt))) {
    return fail("end date must be after start");
  }
  if (typeof body.isOnline !== "boolean") return fail("isOnline must be a boolean");

  const venueName = cleanNullable(body.venueName);
  const venueAddress = cleanNullable(body.venueAddress);
  if (!body.isOnline && !venueName && !venueAddress) {
    return fail("venue or address required for in-person events");
  }

  const summary = cleanNullable(body.summary);
  if (summary && summary.split(/\s+/).length > 100) return fail("description must be 100 words or fewer");
  if (!Array.isArray(body.highlights) || body.highlights.some((value) => typeof value !== "string")) {
    return fail("highlights must be an array of strings");
  }
  if (body.highlights.length > 3) return fail("at most 3 perks allowed");
  const highlights = body.highlights.map((value) => value.trim()).filter(Boolean);
  if (highlights.length && !summary) return fail("perks require a summary");
  if (highlights.some((perk) => perk.length > 72)) return fail("perks must be 72 characters or fewer");
  if (new Set(highlights.map((perk) => perk.toLowerCase())).size !== highlights.length) {
    return fail("perks must be unique");
  }

  const status = body.status as EventStatus;
  if (!EDITABLE_STATUSES.includes(status)) return fail("invalid status");
  const primarySourceUrl = safeHttpUrl(body.primarySourceUrl);
  if (!primarySourceUrl) return fail("primarySourceUrl must be an http(s) URL");
  const posterImageUrl = safePosterUrl(body.posterImageUrl);
  if (body.posterImageUrl && !posterImageUrl) return fail("invalid poster URL");

  const priceType = body.priceType == null || body.priceType === "" ? null : body.priceType;
  if (priceType !== null && priceType !== "free" && priceType !== "paid") return fail("invalid priceType");

  return {
    ok: true,
    value: {
      eventId,
      title,
      summary,
      highlights,
      category: body.category as Category,
      startAt: new Date(startAt).toISOString(),
      endAt: endAt ? new Date(endAt).toISOString() : null,
      isOnline: body.isOnline,
      venueName: body.isOnline ? null : venueName,
      venueAddress: body.isOnline ? null : venueAddress,
      organizerName: cleanNullable(body.organizerName),
      posterImageUrl,
      priceType: priceType as PriceType | null,
      priceNote: priceType === "paid" ? cleanNullable(body.priceNote) : null,
      primarySourceUrl,
      status,
    },
  };
}
