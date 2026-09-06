import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import { buildWhatsappOptInLink } from "@/lib/whatsappLink";
import { MAX_EMAIL_LENGTH, isPlausibleEmail, normalizeEmail, sanitizeCategories, subscribeEmail } from "@/lib/subscribers";

/**
 * Public signup. No verification step, by product decision.
 *
 * GET returns the config the signup UI needs (category list, WhatsApp link) so
 * the frontend doesn't have to hardcode either. POST takes an email address.
 * There is no phone field and there must not be one — see lib/whatsappLink.ts.
 */

/** Same crude global ceiling as the tip desk: there's no per-IP store in a
 *  serverless runtime, and an unauthenticated insert endpoint needs a cap. */
const MAX_SIGNUPS_PER_HOUR = 120;

export async function GET() {
  const whatsapp = buildWhatsappOptInLink();
  return NextResponse.json({
    categories: CATEGORIES,
    whatsapp: whatsapp ? { href: whatsapp.href, message: whatsapp.message } : null,
  });
}

export async function POST(request: Request) {
  let body: { email?: unknown; categories?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email.slice(0, MAX_EMAIL_LENGTH + 1) : "";
  const email = normalizeEmail(rawEmail);
  if (!isPlausibleEmail(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const categories = sanitizeCategories(body.categories);
  const source = typeof body.source === "string" ? body.source.slice(0, 60) : "web";

  try {
    const { rows: recent } = await query<{ n: string }>(
      "SELECT count(*)::text AS n FROM subscribers WHERE created_at > now() - interval '1 hour'",
    );
    if (Number(recent[0]?.n ?? 0) >= MAX_SIGNUPS_PER_HOUR) {
      return NextResponse.json(
        { error: "Signups are busy right now — please try again shortly." },
        { status: 429 },
      );
    }

    await subscribeEmail({
      email,
      categories,
      source,
      consentNote: "Signed up via the SCENE/044 web signup field.",
    });

    /*
     * Always the same response whether the row was new or already existed.
     * Reporting "already subscribed" would turn this endpoint into an
     * address-enumeration oracle — anyone could test whether a given person is
     * on the list.
     */
    return NextResponse.json({ ok: true, message: "You're on the list." });
  } catch (err) {
    console.error("subscribe: failed", err);
    return NextResponse.json({ error: "Could not complete signup." }, { status: 500 });
  }
}
