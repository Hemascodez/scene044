import { NextResponse } from "next/server";
import { createPartnerRequest } from "@/lib/venueCatalog";

/**
 * The "list your venue" form's actual submit target.
 *
 * Before this route existed, PartnerForm.tsx's submit handler only called
 * `setSent(true)` — the visitor saw "You're on the partner list" and the data
 * went nowhere. Every real venue lead up to now was lost.
 */

const MAX_LEN = 4000;

interface PartnerRequestBody {
  name?: unknown;
  phone?: unknown;
  venue?: unknown;
  area?: unknown;
  link?: unknown;
  details?: unknown;
}

function cleanString(value: unknown, max = 300): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed || null;
}

export async function POST(request: Request) {
  let body: PartnerRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const contactName = cleanString(body.name);
  const phone = cleanString(body.phone, 40);
  const venueName = cleanString(body.venue);
  const area = cleanString(body.area);
  const details = cleanString(body.details, MAX_LEN);
  const link = cleanString(body.link, 500);

  if (!contactName || !phone || !venueName || !area || !details) {
    return NextResponse.json(
      { error: "name, phone, venue, area, and details are required" },
      { status: 400 },
    );
  }
  if (link && !/^https?:\/\//i.test(link)) {
    return NextResponse.json({ error: "link must be an http(s) URL" }, { status: 400 });
  }

  try {
    const created = await createPartnerRequest({ contactName, phone, venueName, area, link, details });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("venue partner-requests: failed to store submission", err);
    return NextResponse.json({ error: "Could not submit right now. Try again shortly." }, { status: 500 });
  }
}
