/** Periodic sweep: tell an organizer their booked time is up. */

import { sendWhatsappTemplate } from "@/lib/whatsappSend";
import { claimOverrunNotification, findOverrunBookings, type VenueBooking } from "@/lib/venueBookings";

export interface OverrunSweepResult {
  checked: number;
  notified: number;
  skipped: number;
  retryable: number;
  errors: string[];
}

function otpTemplateReady(): { name: string; language: string } | null {
  const name = process.env.WHATSAPP_OVERRUN_TEMPLATE_NAME?.trim();
  const language = process.env.WHATSAPP_OVERRUN_TEMPLATE_LANGUAGE?.trim();
  if (!name || !language) return null;
  return { name, language };
}

async function notifyOne(booking: VenueBooking, template: { name: string; language: string }): Promise<"sent" | "retryable" | "fatal"> {
  const result = await sendWhatsappTemplate({
    to: booking.organizerPhone,
    name: template.name,
    language: template.language,
    bodyParameters: [booking.organizerName, booking.venueName, booking.spaceName],
  });
  if (result.ok) return "sent";
  return result.kind === "retryable" ? "retryable" : "fatal";
}

/**
 * One pass over every booking whose time is up and hasn't been notified yet.
 *
 * A booking without WhatsApp opt-in, or once the template send has failed in
 * a way that will never self-heal (bad template, bad auth), is claimed
 * immediately so the sweep doesn't retry it forever. A retryable failure
 * (rate limit, Meta 5xx) is left unclaimed — the next sweep picks it back up
 * from `findOverrunBookings`.
 */
export async function runOverrunSweep(): Promise<OverrunSweepResult> {
  const result: OverrunSweepResult = { checked: 0, notified: 0, skipped: 0, retryable: 0, errors: [] };
  const template = otpTemplateReady();

  const bookings = await findOverrunBookings();
  for (const booking of bookings) {
    result.checked += 1;

    if (!template || !booking.organizerPhone || !booking.whatsappOptIn) {
      await claimOverrunNotification(booking.id);
      result.skipped += 1;
      continue;
    }

    try {
      const outcome = await notifyOne(booking, template);
      if (outcome === "retryable") {
        result.retryable += 1;
        continue;
      }
      await claimOverrunNotification(booking.id);
      if (outcome === "sent") result.notified += 1;
      else result.skipped += 1;
    } catch (err) {
      result.errors.push(`booking ${booking.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}
