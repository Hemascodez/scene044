import crypto from "node:crypto";
import { eventJson } from "@/lib/eventApi";
import { handleCapturedEventPayment } from "@/lib/eventRegistrations";
import type { RazorpayPayment } from "@/lib/razorpay";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
  if (!secret)
    return eventJson({ error: "Payment webhook is not configured." }, 503);
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1_000_000)
    return eventJson({ error: "Request too large." }, 413);
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(raw)
    .digest("hex");
  if (
    !/^[a-f0-9]{64}$/.test(signature) ||
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return eventJson({ error: "Invalid signature." }, 401);
  try {
    const body = JSON.parse(raw) as {
      event?: string;
      payload?: { payment?: { entity?: RazorpayPayment } };
    };
    if (body.event !== "payment.captured" && body.event !== "order.paid")
      return eventJson({ ok: true, ignored: true });
    const payment = body.payload?.payment?.entity;
    if (!payment?.id || !payment.order_id || payment.status !== "captured")
      return eventJson({ error: "Missing captured payment." }, 400);
    return eventJson({
      ok: true,
      eventRegistration: await handleCapturedEventPayment(payment),
    });
  } catch {
    // Non-2xx makes Razorpay retry; confirmation + outbox inserts are idempotent.
    return eventJson(
      { error: "Payment reconciliation is temporarily unavailable." },
      503,
    );
  }
}
