"use client";
import { clearStoredTicketToken } from "@/lib/client/eventRegistration";
/** Mounted only by the production-disabled dev preview. Never touches the server. */
export function HostedPreviewReset({ eventId }: { eventId: number }) {
  return <button type="button" className="min-h-11 w-full border-b border-foreground bg-card px-4 text-xs" onClick={() => { clearStoredTicketToken(eventId); window.location.reload(); }}>Local sample data only · Reset registration preview</button>;
}
