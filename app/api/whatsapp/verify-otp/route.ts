import { NextResponse } from "next/server";
import { verifyPhoneOtp } from "@/lib/whatsappOtp";

interface VerifyOtpBody {
  phone?: unknown;
  code?: unknown;
}

export async function POST(request: Request) {
  let body: VerifyOtpBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!phone || !code) {
    return NextResponse.json({ error: "phone and code are required" }, { status: 400 });
  }

  let result;
  try {
    result = await verifyPhoneOtp(phone, code);
  } catch (err) {
    console.error("whatsapp verify-otp: failed", err);
    return NextResponse.json({ error: "Could not verify right now. Try again shortly." }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
