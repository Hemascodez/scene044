import { readStorage, writeStorage } from "@/lib/client/storage";

/**
 * Browser side of hosted-event registration: the calls the registration card
 * makes, the checks it runs before calling, and the ticket it remembers.
 * Endpoint shapes are fixed by docs/hosted-event-backend-contract.md.
 */

export interface Ticket {
  code: string;
  name: string;
  phoneMasked: string;
  status: "confirmed" | "cancelled";
  /** What the door scanner reads. Rendered as a QR, never parsed here. */
  qrValue: string;
}

export interface CreatedRegistration {
  registrationToken: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RegistrationDetails {
  name: string;
  email: string;
  phone: string;
}

export interface RegistrationApi {
  sendCode(phone: string): Promise<void>;
  create(input: RegistrationDetails & { code: string }): Promise<CreatedRegistration>;
  verify(input: {
    registrationToken: string;
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): Promise<{ ticket: Ticket; ticketToken: string }>;
  getTicket(token: string): Promise<Ticket | null>;
}

export class RegistrationError extends Error {
  status: number;
  existingTicketToken?: string;
  soldOut?: boolean;

  constructor(message: string, status: number, extra: { existingTicketToken?: string; soldOut?: boolean } = {}) {
    super(message);
    this.name = "RegistrationError";
    this.status = status;
    this.existingTicketToken = extra.existingTicketToken;
    this.soldOut = extra.soldOut;
  }
}

/** 10-digit Indian mobile number (starts 6–9), from however it was typed. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

/** "+91 98765 43210" for display; unparseable input comes back as typed. */
export function formatIndianMobile(input: string): string {
  const digits = normalizeIndianMobile(input);
  return digits ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : input;
}

export function validateDetails(input: RegistrationDetails): Partial<Record<keyof RegistrationDetails, string>> {
  const errors: Partial<Record<keyof RegistrationDetails, string>> = {};
  if (!input.name.trim()) errors.name = "Enter your name";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Enter a valid email";
  if (!normalizeIndianMobile(input.phone)) errors.phone = "Enter a 10-digit mobile number";
  return errors;
}

// ------------------------------------------------------------ ticket storage

const TICKET_STORAGE_VERSION = 1;

function ticketKey(eventId: number): string {
  return `scene044:ticket:${eventId}`;
}

export function readStoredTicketToken(eventId: number): string | null {
  return readStorage<{ version: number; token: string }>(ticketKey(eventId), TICKET_STORAGE_VERSION)?.token ?? null;
}

export function storeTicketToken(eventId: number, token: string): void {
  writeStorage(ticketKey(eventId), { version: TICKET_STORAGE_VERSION, token });
}

export function clearStoredTicketToken(eventId: number): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ticketKey(eventId));
  } catch {
    // storage unavailable — nothing to clear
  }
}

// ------------------------------------------------------------------ HTTP API

async function request<T>(url: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new RegistrationError("Couldn't reach SCENE. Check your connection and try again.", 0);
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // non-JSON body — fall through to the generic message below
  }
  if (!response.ok) {
    const data = (body ?? {}) as { error?: unknown; existingTicketToken?: unknown; soldOut?: unknown };
    throw new RegistrationError(
      typeof data.error === "string" && data.error ? data.error : "Something went wrong. Try again.",
      response.status,
      {
        existingTicketToken: typeof data.existingTicketToken === "string" ? data.existingTicketToken : undefined,
        soldOut: data.soldOut === true ? true : undefined,
      },
    );
  }
  return { status: response.status, body: body as T };
}

function postJson(body: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export function httpRegistrationApi(eventId: number): RegistrationApi {
  const base = `/api/events/${eventId}`;
  return {
    async sendCode(phone) {
      await request(`${base}/registrations/otp`, postJson({ phone: normalizeIndianMobile(phone) ?? phone }));
    },
    async create({ name, email, phone, code }) {
      const { body } = await request<CreatedRegistration>(
        `${base}/registrations`,
        postJson({ name: name.trim(), email: email.trim(), phone: normalizeIndianMobile(phone) ?? phone, code }),
      );
      return body;
    },
    async verify(input) {
      const { body } = await request<{ ticket: Ticket; ticketToken: string }>(`${base}/registrations/verify`, postJson(input));
      return body;
    },
    async getTicket(token) {
      try {
        const { body } = await request<{ ticket: Ticket }>(`${base}/tickets/${encodeURIComponent(token)}`);
        return body.ticket;
      } catch (error) {
        if (error instanceof RegistrationError && error.status === 404) return null;
        throw error;
      }
    },
  };
}

// ----------------------------------------------------------------- dev mock

const MOCK_CODE = "123456";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maskPhone(phone: string): string {
  return `+91 ••••• ${phone.slice(-5)}`;
}

/**
 * In-memory stand-in for the backend, for the dev preview page only.
 * Code 123456 passes; phones ending 0000 hit "sold out", 1111 "already
 * registered"; payment always verifies.
 */
const MOCK_TICKETS_KEY = "scene044:mock-tickets";

/** Mock tickets live in sessionStorage so a reload of the preview still finds them. */
function loadMockTickets(): Map<string, Ticket> {
  const tickets = new Map<string, Ticket>([
    ["mock-existing", { code: "SCN-READ-0007", name: "Returning reader", phoneMasked: "+91 ••••• 11111", status: "confirmed", qrValue: "mock-existing" }],
  ]);
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(MOCK_TICKETS_KEY) ?? "{}") as Record<string, Ticket>;
    for (const [token, ticket] of Object.entries(saved)) tickets.set(token, ticket);
  } catch {
    // no window or storage — in-memory only
  }
  return tickets;
}

function saveMockTickets(tickets: Map<string, Ticket>): void {
  try {
    window.sessionStorage.setItem(MOCK_TICKETS_KEY, JSON.stringify(Object.fromEntries(tickets)));
  } catch {
    // no window or storage — in-memory only
  }
}

export function mockRegistrationApi(): RegistrationApi {
  const pending = new Map<string, RegistrationDetails>();
  const tickets = loadMockTickets();
  let counter = tickets.size;

  return {
    async sendCode(phone) {
      await wait(400);
      if (!normalizeIndianMobile(phone)) throw new RegistrationError("Enter a valid Indian mobile number.", 400);
    },
    async create({ name, email, phone, code }) {
      await wait(400);
      const normalized = normalizeIndianMobile(phone) ?? "";
      if (code !== MOCK_CODE) throw new RegistrationError("That code didn't match. Check WhatsApp and try again.", 400);
      if (normalized.endsWith("0000")) throw new RegistrationError("Sorry, this event just sold out.", 409, { soldOut: true });
      if (normalized.endsWith("1111")) {
        throw new RegistrationError("You're already registered for this event.", 409, { existingTicketToken: "mock-existing" });
      }
      counter += 1;
      const registrationToken = `mock-reg-${counter}`;
      pending.set(registrationToken, { name: name.trim(), email, phone: normalized });
      return { registrationToken, orderId: `order_mock_${counter}`, amount: 29900, currency: "INR", keyId: "rzp_test_mock" };
    },
    async verify({ registrationToken }) {
      await wait(800);
      const details = pending.get(registrationToken);
      if (!details) throw new RegistrationError("We couldn't find that registration.", 404);
      const ticketToken = `mock-ticket-${registrationToken}`;
      const ticket: Ticket = {
        code: `SCN-READ-${String(100 + counter).padStart(4, "0")}`,
        name: details.name,
        phoneMasked: maskPhone(details.phone),
        status: "confirmed",
        qrValue: ticketToken,
      };
      tickets.set(ticketToken, ticket);
      saveMockTickets(tickets);
      return { ticket, ticketToken };
    },
    async getTicket(token) {
      await wait(200);
      return tickets.get(token) ?? null;
    },
  };
}
