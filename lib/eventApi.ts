import { NextResponse } from "next/server";
import { EventTicketError } from "@/lib/hostedEventData";
import { getVenueUserFromRequest } from "@/lib/venueUserAuth";
import { isSameOriginMutation } from "@/lib/venueHostAccess";

export function eventJson(value: unknown, status = 200) {
  return NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function eventApi(
  request: Request,
  action: () => Promise<unknown>,
) {
  if (!isSameOriginMutation(request))
    return eventJson({ error: "Use the SCENE website to continue." }, 403);
  try {
    return eventJson(await action());
  } catch (error) {
    if (error instanceof EventTicketError)
      return eventJson({ error: error.message, ...error.extra }, error.status);
    console.error(
      "Event operation failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return eventJson(
      { error: "Could not complete this request. Please retry shortly." },
      503,
    );
  }
}

export async function eventUser(request: Request) {
  const user = await getVenueUserFromRequest(request);
  if (!user) throw new EventTicketError("Sign in to continue.", 401);
  return user;
}

export async function eventBody(
  request: Request,
): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("content-length") ?? 0) > 100_000)
    throw new EventTicketError("Request is too large.", 413);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new EventTicketError("Enter valid request details.");
  return body;
}
