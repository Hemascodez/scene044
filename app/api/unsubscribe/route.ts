import { NextResponse } from "next/server";
import { unsubscribeByToken } from "@/lib/subscribers";

/**
 * One-click unsubscribe.
 *
 * Every bulk email has to carry this — Gmail and Yahoo's bulk-sender rules
 * require one-click unsubscribe, and it must work without a login or a
 * confirmation screen.
 *
 * Answers 200 even for an unknown token: a 404 would confirm to a scanner
 * which tokens are real, and there is nothing useful to tell the visitor
 * either way.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  await unsubscribeByToken(token);
  return NextResponse.json({ ok: true, message: "You've been unsubscribed." });
}

/** RFC 8058 one-click: mail clients POST to the List-Unsubscribe-Post URL. */
export async function POST(request: Request) {
  return GET(request);
}
