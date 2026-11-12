import type { Profile } from "@/components/venues/figma/AuthModal";
import { normalizeIndianMobile, type RegistrationDetails } from "@/lib/client/eventRegistration";

export interface AttendeeAuthApi {
  send(phone: string): Promise<void>;
  verify(details: RegistrationDetails, code: string): Promise<Profile>;
}

/** Accept OS autofill, a leading trunk zero and an explicitly pasted country code. */
export function attendeePhone(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(2);
  if (digits.length === 13 && digits.startsWith("910")) digits = digits.slice(2);
  return normalizeIndianMobile(digits);
}

export function pastedOtp(value: string): string {
  const match = value.match(/(?:^|\D)(\d{6})(?!\d)/);
  return match?.[1] ?? value.replace(/\D/g, "").slice(0, 6);
}

async function authRequest(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  } catch { throw new Error("Couldn't reach SCENE. Check your connection and try again."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(typeof data.error === "string" ? data.error : "Couldn't verify your number. Try again.");
  return data;
}

export const httpAttendeeAuth: AttendeeAuthApi = {
  async send(phone) {
    const number = attendeePhone(phone);
    if (!number) throw new Error("Enter a valid 10-digit Indian mobile number.");
    await authRequest("/api/whatsapp/send-otp", { phone: number });
  },
  async verify(details, code) {
    const phone = attendeePhone(details.phone);
    if (!phone || !/^\d{6}$/.test(code)) throw new Error("Enter the six-digit WhatsApp code.");
    // The existing account API calls guest accounts Organiser internally. No host access is requested.
    const { profile } = await authRequest("/api/whatsapp/verify-otp", { phone, code, name: details.name.trim(), email: details.email.trim(), role: "Organiser" });
    if (!profile || attendeePhone(profile.phone) !== phone || typeof profile.name !== "string") throw new Error("Couldn't complete sign-in. Try again.");
    return profile as Profile;
  },
};

/** Only used by the production-disabled /dev preview and isolated UI tests. */
export const mockAttendeeAuth: AttendeeAuthApi = {
  async send() {},
  async verify(details, code) {
    if (code !== "123456") throw new Error("Preview code: 123456");
    return { ...details, phone: attendeePhone(details.phone)!, role: "Organiser" };
  },
};
