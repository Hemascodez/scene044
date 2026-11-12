import { eventPath } from "@/lib/seo";

/** Private ticket destinations; never use these in analytics or public share links. */
export function eventTicketLocation(event: { id: number; title: string }, token: string): string {
  return `${eventPath(event)}/ticket?ticket=${encodeURIComponent(token)}`;
}

export function validEventTicketToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
