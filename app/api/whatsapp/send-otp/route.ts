import { NextResponse } from "next/server";
import { sendPhoneOtp } from "@/lib/whatsappOtp";

interface SendOtpBody {
  phone?: unknown;
}

export async function POST(request: Request) {
  let body: SendOtpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (!phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  let result;
  try {
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
