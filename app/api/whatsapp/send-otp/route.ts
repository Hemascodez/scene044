import { NextResponse } from "next/server";
import { sendPhoneOtp } from "@/lib/whatsappOtp";
import { HOST_ACCESS_MESSAGE, isApprovedHostPhone } from '@/lib/venueHostAccess';
import { normalizeIndianPhone } from '@/lib/venueUserAuth';
import { EVENT_HOST_ACCESS_MESSAGE, isApprovedEventHostPhone } from '@/lib/eventHostAccess';

interface SendOtpBody {
  phone?: unknown;
  role?: unknown;
  venue?: unknown;
  eventId?: unknown;
}

export async function POST(request: Request) {
  let body: SendOtpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  if (!normalizeIndianPhone(phone)) {
    return NextResponse.json({ error: "Enter a valid Indian mobile number." }, { status: 400 });
  }

  let result;
  try {
    if (body.role === 'Host') {
      if (body.eventId !== undefined) {
        if (!Number.isSafeInteger(body.eventId) || Number(body.eventId)<=0 || body.venue) return NextResponse.json({error:'Select your event.'},{status:400});
        if (!await isApprovedEventHostPhone(phone,Number(body.eventId))) return NextResponse.json({error:EVENT_HOST_ACCESS_MESSAGE},{status:403});
      } else {
      if (typeof body.venue !== 'string' || !body.venue.trim()) return NextResponse.json({ error: 'Select your venue.' }, { status: 400 });
      if (!await isApprovedHostPhone(phone, body.venue)) return NextResponse.json({ error: HOST_ACCESS_MESSAGE }, { status: 403 });
      }
    }
    result = await sendPhoneOtp(phone);
  } catch (err) {
    console.error("whatsapp send-otp: failed", err);
    return NextResponse.json({ error: "Could not send a code right now. Try again shortly." }, { status: 500 });
  }

  if (!result.ok) {
    if (result.kind === "cooldown") {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }
    console.error("whatsapp send-otp: failed", result.kind, result.error);
    return NextResponse.json({ error: "Could not send a code right now. Try again shortly." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
