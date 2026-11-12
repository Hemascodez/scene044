"use client";

import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import type { Ticket } from "@/lib/client/eventRegistration";
import { downloadEventIcs } from "@/lib/client/ics";
import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import type { PublicEventDetail } from "@/lib/events";
import { Btn, Mono } from "@/components/scene/ui";

/** wa.me needs the country code and digits only; hide the link when unset. */
function hostWhatsappHref(eventTitle: string, ticketCode: string): string | null {
  const digits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  if (digits.length < 11 || digits.length > 15) return null;
  const text = `Hi! I can't make it to "${eventTitle}". My ticket is ${ticketCode}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function TicketView({ ticket, event }: { ticket: Ticket; event: PublicEventDetail }) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    toDataURL(ticket.qrValue, { margin: 1, width: 320, color: { dark: "#14130d", light: "#fbfaf5" } })
      .then((url) => live && setQr(url))
      .catch(() => live && setQr(null));
    return () => {
      live = false;
    };
  }, [ticket.qrValue]);

  const hostHref = hostWhatsappHref(event.title, ticket.code);

  function addToCalendar() {
    if (!event.startAt) return;
    downloadEventIcs({
      eventId: event.id,
      title: event.title,
      summary: event.summary,
      startAt: event.startAt,
      endAt: event.endAt,
      isOnline: event.isOnline,
      venueName: event.venueName,
      city: event.city,
      primarySourceDomain: "scene044.in",
    });
  }

  function share() {
    const url = window.location.href.split("?")[0];
    const text = `I'm going to ${event.title}${event.startAt ? ` on ${formatSceneDate(event.startAt)}` : ""}. Join me?`;
    if (navigator.share) {
      navigator.share({ title: event.title, text, url }).catch(() => {
        /* dismissed */
      });
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  return (
    <div>
      <Mono className="text-[10px] text-signal-ink">You&apos;re in</Mono>
      <p className="mt-1 font-display text-2xl font-black leading-tight tracking-tight">
        See you there, {ticket.name.split(" ")[0]}.
      </p>
      {event.startAt && (
        <p className="mt-1 text-sm text-muted-foreground">
          {formatSceneDate(event.startAt)} · {formatSceneTime(event.startAt)} IST · {event.venueName}
        </p>
      )}

      <div className="mt-4 flex flex-col items-center gap-3 border-2 border-foreground bg-card p-4 sm:flex-row sm:items-center">
        <div className="size-40 shrink-0 border-2 border-foreground bg-card">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL generated in the browser
            <img src={qr} alt={`Ticket QR code for ${ticket.name}`} className="size-full" />
          ) : (
            <div className="size-full animate-pulse bg-muted" aria-hidden />
          )}
        </div>
        <dl className="w-full text-center sm:text-left">
          <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Ticket</dt>
          <dd className="font-mono text-lg font-semibold tracking-wider">{ticket.code}</dd>
          <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Name</dt>
          <dd className="text-sm font-semibold">{ticket.name}</dd>
          <dt className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">WhatsApp</dt>
          <dd className="text-sm">{ticket.phoneMasked}</dd>
        </dl>
      </div>

      <p className="mt-3 text-sm leading-relaxed">We&apos;ve sent your ticket on WhatsApp. Show this QR at the door.</p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Btn variant="outline" className="min-h-11 w-full" onClick={addToCalendar} disabled={!event.startAt}>
          Add to calendar
        </Btn>
        <Btn variant="outline" className="min-h-11 w-full" onClick={share}>
          Invite a friend
        </Btn>
      </div>

      {hostHref && (
        <a
          href={hostHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Can&apos;t make it? Message the host
        </a>
      )}
    </div>
  );
}
