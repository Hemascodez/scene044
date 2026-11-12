/**
 * Organiser side of hosted events: the calls the event workspace
 * (/host/events) makes, a mock for the dev preview, and the pure helpers its
 * screens use. Endpoint shapes: docs/hosted-event-backend-contract.md.
 */

export interface HostEvent {
  id: number;
  slug: string;
  title: string;
  posterImageUrl: string | null;
  startAt: string;
  endAt: string | null;
  venueName: string | null;
  capacity: number;
  registeredCount: number;
  checkedInCount: number;
  pricePaise: number;
}

export type GuestStatus = "confirmed" | "checked_in" | "cancelled";

export interface HostGuest {
  code: string;
  ticketToken: string;
  name: string;
  /** Full number — only ever shown to the approved organiser. */
  phone: string;
  email: string;
  status: GuestStatus;
  registeredAt: string;
  checkedInAt: string | null;
}

export interface ReminderTemplate {
  id: string;
  name: string;
  preview: string;
  audience: number;
  lastSentAt: string | null;
}

export interface ReminderSend {
  id: string;
  templateName: string;
  sentAt: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface MoneySummary {
  grossPaise: number;
  feesPaise: number;
  netPaise: number;
  paymentsCount: number;
  /** Human line from the backend, e.g. "Next settlement on 24 Nov". */
  settlement: string;
  payments: { at: string; guest: string; amountPaise: number; paymentId: string; status: "captured" | "failed" | "refunded" }[];
}

export interface CheckInResult {
  guest: HostGuest;
  alreadyCheckedIn: boolean;
}

export interface EventHostApi {
  listEvents(): Promise<HostEvent[]>;
  guests(eventId: number): Promise<HostGuest[]>;
  checkIn(eventId: number, by: { token: string } | { code: string }): Promise<CheckInResult>;
  reminders(eventId: number): Promise<{ templates: ReminderTemplate[]; history: ReminderSend[] }>;
  sendReminder(eventId: number, templateId: string): Promise<ReminderSend>;
  money(eventId: number): Promise<MoneySummary>;
}

export class EventHostError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "EventHostError";
    this.status = status;
  }
}

// ------------------------------------------------------------------ helpers

export type GuestFilter = "all" | "not_arrived" | "checked_in" | "cancelled";

/** Search by name, ticket code (any case) or the last digits of the phone. */
export function filterGuests(guests: HostGuest[], query: string, filter: GuestFilter): HostGuest[] {
  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  return guests.filter((g) => {
    if (filter === "not_arrived" && g.status !== "confirmed") return false;
    if (filter === "checked_in" && g.status !== "checked_in") return false;
    if (filter === "cancelled" && g.status !== "cancelled") return false;
    if (!q) return true;
    return (
      g.name.toLowerCase().includes(q) ||
      g.code.toLowerCase().includes(q) ||
      g.email.toLowerCase().includes(q) ||
      (digits.length >= 3 && g.phone.replace(/\D/g, "").endsWith(digits))
    );
  });
}

/** Quotes commas/quotes/newlines, and prefixes formula starters (= + - @) with ' so
 *  spreadsheets show text: no injected formulas, and +91 numbers stay intact. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function guestsCsv(guests: HostGuest[]): string {
  const rows = [["Name", "Phone", "Email", "Ticket", "Status", "Registered", "Checked in"]];
  for (const g of guests) rows.push([g.name, g.phone, g.email, g.code, g.status, g.registeredAt, g.checkedInAt ?? ""]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

const TICKET_HOSTS = new Set(["scene044.in", "www.scene044.in"]);

/** Token from a ticket link (`…?ticket=<token>` on SCENE or `extraHost`) or a bare token; else null. */
export function parseTicketQr(text: string, extraHost?: string): string | null {
  const raw = text.trim();
  try {
    const url = new URL(raw);
    if (!TICKET_HOSTS.has(url.hostname) && url.hostname !== extraHost) return null;
    return url.searchParams.get("ticket") || null;
  } catch {
    return /^[A-Za-z0-9_-]{6,128}$/.test(raw) ? raw : null;
  }
}

export function classifyLoadError(status: number): "signin" | "not_approved" | "error" {
  if (status === 401) return "signin";
  if (status === 403) return "not_approved";
  return "error";
}

// --------------------------------------------------------------------- HTTP

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new EventHostError("Couldn't reach SCENE. Check your connection and try again.", 0);
  }
  const body = (await response.json().catch(() => null)) as (T & { error?: unknown }) | null;
  if (!response.ok) {
    const message = body && typeof body.error === "string" ? body.error : "Something went wrong. Try again.";
    throw new EventHostError(message, response.status);
  }
  return body as T;
}

function post(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function httpEventHostApi(): EventHostApi {
  const base = "/api/host/events";
  return {
    async listEvents() {
      return (await call<{ events: HostEvent[] }>(base)).events;
    },
    async guests(eventId) {
      return (await call<{ guests: HostGuest[] }>(`${base}/${eventId}/guests`)).guests;
    },
    checkIn: (eventId, by) => call<CheckInResult>(`${base}/${eventId}/checkin`, post(by)),
    reminders: (eventId) => call<{ templates: ReminderTemplate[]; history: ReminderSend[] }>(`${base}/${eventId}/reminders`),
    sendReminder: (eventId, templateId) => call<ReminderSend>(`${base}/${eventId}/reminders`, post({ templateId })),
    money: (eventId) => call<MoneySummary>(`${base}/${eventId}/payments`),
  };
}

// --------------------------------------------------------------------- mock

const NAMES = [
  "Asha Raman", "Vijay Kumar", "Meera Iyer", "Anand Asokan", "Om Prakash", "Raji Subramanian", "Karthik Nair",
  "Divya Menon", "Arjun Rao", "Lakshmi Venkat", "Nikhil Shah", "Priya Das", "Sanjay Pillai", "Kavya Reddy",
];

/** Dev preview only: Chapter Lounge with 14 readers, 3 already at the door. */
export function mockEventHostApi(): EventHostApi {
  const event: HostEvent = {
    id: 9044,
    slug: "lets-do-more-reading-9044",
    title: "Let's do more reading",
    posterImageUrl: "/events/chapter-lounge/poster.jpg",
    startAt: "2026-11-22T05:30:00.000Z",
    endAt: "2026-11-22T07:30:00.000Z",
    venueName: "Madras Adda",
    capacity: 20,
    registeredCount: NAMES.length,
    checkedInCount: 3,
    pricePaise: 29900,
  };
  const guests: HostGuest[] = NAMES.map((name, i) => {
    const n = String(101 + i).padStart(4, "0");
    return {
      code: `SCN-READ-${n}`,
      ticketToken: `mock-ticket-${n}`,
      name,
      phone: `+9198765${String(10000 + i * 137).slice(-5)}`,
      email: `${name.split(" ")[0].toLowerCase()}@example.com`,
      status: i < 3 ? "checked_in" : "confirmed",
      registeredAt: new Date(Date.UTC(2026, 10, 12 + Math.floor(i / 3), 9 + i)).toISOString(),
      checkedInAt: i < 3 ? `2026-11-22T05:${String(10 + i * 4).padStart(2, "0")}:00.000Z` : null,
    };
  });
  const history: ReminderSend[] = [
    { id: "r-1", templateName: "You're in — save the date", sentAt: "2026-11-15T12:00:00.000Z", sent: 9, delivered: 9, failed: 0 },
  ];
  const templates = (): ReminderTemplate[] => {
    const audience = guests.filter((g) => g.status !== "cancelled").length;
    return [
      { id: "day-before", name: "Day-before reminder", preview: "Hi {name}! See you tomorrow at Madras Adda for Let's do more reading, 11 am. Bring your book 📚", audience, lastSentAt: null },
      { id: "morning-of", name: "Morning-of reminder", preview: "Good morning {name}! We start at 11 am — doors open 10:30. Your QR ticket: {link}", audience, lastSentAt: null },
      { id: "directions", name: "Directions", preview: "Madras Adda, Mylapore. Map: {map}. Reply here if you need help finding us.", audience, lastSentAt: history[0].sentAt },
    ];
  };
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const find = (id: number) => {
    if (id !== event.id) throw new EventHostError("Event not found.", 404);
  };

  return {
    async listEvents() {
      await wait(250);
      return [{ ...event, checkedInCount: guests.filter((g) => g.status === "checked_in").length }];
    },
    async guests(eventId) {
      find(eventId);
      await wait(250);
      return guests.map((g) => ({ ...g }));
    },
    async checkIn(eventId, by) {
      find(eventId);
      await wait(300);
      const guest =
        "code" in by
          ? guests.find((g) => g.code.toLowerCase() === by.code.trim().toLowerCase())
          : guests.find((g) => g.ticketToken === by.token);
      if (!guest) throw new EventHostError("No ticket matches that code.", 404);
      if (guest.status === "cancelled") throw new EventHostError("This ticket was cancelled.", 409);
      if (guest.status === "checked_in") return { guest: { ...guest }, alreadyCheckedIn: true };
      guest.status = "checked_in";
      guest.checkedInAt = new Date().toISOString();
      return { guest: { ...guest }, alreadyCheckedIn: false };
    },
    async reminders(eventId) {
      find(eventId);
      await wait(200);
      return { templates: templates(), history: [...history] };
    },
    async sendReminder(eventId, templateId) {
      find(eventId);
      await wait(600);
      const template = templates().find((t) => t.id === templateId);
      if (!template) throw new EventHostError("Unknown template.", 400);
      const send: ReminderSend = {
        id: `r-${history.length + 1}`,
        templateName: template.name,
        sentAt: new Date().toISOString(),
        sent: template.audience,
        delivered: template.audience,
        failed: 0,
      };
      history.unshift(send);
      return send;
    },
    async money(eventId) {
      find(eventId);
      await wait(250);
      const paid = guests.filter((g) => g.status !== "cancelled");
      const grossPaise = paid.length * event.pricePaise;
      const feesPaise = Math.round(grossPaise * 0.0236);
      return {
        grossPaise,
        feesPaise,
        netPaise: grossPaise - feesPaise,
        paymentsCount: paid.length,
        settlement: "Razorpay settles 2 working days after each payment.",
        payments: paid.map((g, i) => ({
          at: g.registeredAt,
          guest: g.name,
          amountPaise: event.pricePaise,
          paymentId: `pay_MOCK${String(1000 + i)}`,
          status: "captured" as const,
        })),
      };
    },
  };
}
