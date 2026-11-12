"use client";

import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ticketQrDataUrl } from "@/lib/client/ticketQr";
import type { Ticket } from "@/lib/client/eventRegistration";
import { downloadEventIcs } from "@/lib/client/ics";
import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import type { PublicEventDetail } from "@/lib/events";
import { eventPath } from "@/lib/seo";
import { CalendarIcon, Clock, MapPin, Users } from "@/components/venues/figma/icons";

function hostWhatsappHref(eventTitle: string, ticketCode: string): string | null {
  const digits = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hi! I can't make it to "${eventTitle}". My ticket is ${ticketCode}.`)}`;
}

const mono = "font-mono text-[10px] font-bold tracking-[0.16em] text-[#b5aeaa]";
const button = "flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-[14px] px-3 py-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-50";

/** The supplied QR Ticket design, with responsive flow layout and a real server-issued QR. */
export function TicketView({ ticket, event }: { ticket: Ticket; event: PublicEventDetail }) {
  const reduced = useReducedMotion();
  const [qr, setQr] = useState<string | null>(null);
  const [qrError, setQrError] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    // Four-module quiet zone stays unobstructed: decorations must never make the QR unscannable.
    ticketQrDataUrl(ticket.qrValue)
      .then(url => { if (active) { setQr(url); setQrError(false); } })
      .catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [ticket.qrValue]);

  function addToCalendar() {
    if (!event.startAt) return;
    try {
      downloadEventIcs({ eventId: event.id, title: event.title, summary: event.summary, startAt: event.startAt, endAt: event.endAt, isOnline: event.isOnline, venueName: event.venueName, city: event.city, primarySourceDomain: "scene044.in" });
      setFeedback("Calendar file downloaded. Open it to add the event to your calendar.");
    } catch { setFeedback("Couldn't download the calendar file. Please try again."); }
  }
  async function share() {
    const url = `${window.location.origin}${eventPath(event)}`;
    const text = `I'm going to ${event.title}${event.startAt ? ` on ${formatSceneDate(event.startAt)}` : ""}. Join me?`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, text, url }); }
      catch { /* sharing dismissed; never claim success */ }
    } else {
      try { await navigator.clipboard.writeText(url); setCopied(true); setFeedback("Public event link copied. Your private ticket wasn't shared."); }
      catch { window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener,noreferrer"); }
    }
  }
  const hostHref = hostWhatsappHref(event.title, ticket.code);
  if (ticket.status !== "confirmed") return <p role="alert">This ticket was cancelled and is not valid for entry.</p>;
  return <motion.article aria-label={`Confirmed ticket for ${ticket.name}`} initial={{ opacity: 0, y: reduced ? 0 : 22 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.45 }}
    className="relative mx-auto w-full max-w-[390px] rounded-[26px] border border-white/10 text-white shadow-[0_40px_70px_-30px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)]"
    style={{ background: "linear-gradient(160deg,#1d1211 0%,#110d0d 55%,#140b0b 100%)" }}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[26px]" style={{ background: "radial-gradient(ellipse at 100% 0%,rgba(255,59,47,.3),rgba(255,59,47,0) 55%)" }} />
    <div className="relative px-[22px] pt-[22px]">
      <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.16em] text-[#86efac]">
        <motion.span aria-hidden="true" className="size-2 rounded-full bg-[#4ade80] shadow-[0_0_10px_#4ade80]" animate={reduced ? {} : { scale: [1, 1.5, 1], opacity: [1, 0.45, 1] }} transition={{ duration: 1.6, repeat: 2 }} /> YOU&apos;RE IN
      </div>
      <h2 className="mt-2.5 font-display text-[30px] font-bold leading-[1.08] tracking-[-0.02em]">See you there,<br /><span className="break-words text-[#ff8a77]">{ticket.name.trim().split(/\s+/)[0]}.</span></h2>
      <div className="mt-3.5 flex flex-wrap gap-2 text-xs font-medium text-[#e7dfda]">
        {event.startAt && <><Chip><CalendarIcon className="size-[13px] shrink-0 text-[#ff8a77]" />{formatSceneDate(event.startAt)}</Chip><Chip><Clock className="size-[13px] shrink-0 text-[#ff8a77]" />{formatSceneTime(event.startAt)} IST</Chip></>}
        <Chip><MapPin className="size-[13px] shrink-0 text-[#ff8a77]" /><span className="break-words">{event.isOnline ? "Online" : event.venueName ?? event.city}</span></Chip>
      </div>
    </div>
    <div aria-hidden="true" className="relative mt-[22px] h-6">
      <div className="absolute -left-[13px] top-0 size-6 rounded-full border-r border-white/10 bg-[#0a0808]" />
      <div className="absolute -right-[13px] top-0 size-6 rounded-full border-l border-white/10 bg-[#0a0808]" />
      <div className="absolute inset-x-[22px] top-[11px] border-t-2 border-dashed border-white/20" />
    </div>
    <div className="relative px-[22px] pb-[22px] pt-1">
      <div className="relative mx-auto size-[206px] rounded-[20px] bg-[#fbf6ee] p-3 shadow-[0_0_0_1px_rgba(255,255,255,.2),0_20px_40px_-14px_rgba(255,59,47,.5)]">
        {/* The design's scan accent runs behind, not across, the actual QR modules. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[20px]">
          {!reduced && <motion.div className="absolute inset-x-0 top-0 h-[46px] border-b-2 border-[#ff3b2f] bg-[linear-gradient(180deg,transparent,rgba(255,59,47,.35))]" initial={{ y: -46 }} animate={{ y: [-46, 190, -46] }} transition={{ duration: 3.2, ease: "easeInOut" }} />}
        </div>
        {qr ? <img src={qr} alt={`Ticket QR code for ${ticket.name}`} width={182} height={182} className="relative block size-[182px] bg-[#fbf6ee]" /> : <div role="status" className="relative grid size-[182px] place-items-center bg-[#fbf6ee] px-3 text-center text-xs text-[#14110f]">{qrError ? "QR unavailable. Ask the host to enter the ticket code below." : "Preparing your QR…"}</div>}
        <div aria-hidden="true" className="pointer-events-none absolute -left-1.5 -top-1.5 size-[26px] rounded-tl-[10px] border-l-[3px] border-t-[3px] border-[#ff3b2f]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-1.5 -top-1.5 size-[26px] rounded-tr-[10px] border-r-[3px] border-t-[3px] border-[#ff3b2f]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 -left-1.5 size-[26px] rounded-bl-[10px] border-b-[3px] border-l-[3px] border-[#ff3b2f]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-1.5 -right-1.5 size-[26px] rounded-br-[10px] border-b-[3px] border-r-[3px] border-[#ff3b2f]" />
      </div>
      <div className="mt-5 text-center"><p className={mono}>TICKET</p><p className="mt-1 break-all font-mono text-[clamp(17px,4.8vw,24px)] font-bold tracking-[0.04em] [text-shadow:0_0_24px_rgba(255,59,47,.5)]">{ticket.code}</p></div>
      <dl className="mt-4 grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2">
        <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/5 px-3 py-2.5"><dt className={mono}>NAME</dt><dd className="mt-1 break-words text-[15px] font-bold">{ticket.name}</dd></div>
        <div className="min-w-0 rounded-[14px] border border-white/10 bg-white/5 px-3 py-2.5"><dt className={mono}>WHATSAPP</dt><dd className="mt-1 break-words text-[15px] font-bold">{ticket.phoneMasked}</dd></div>
      </dl>
      <p className="mt-3.5 text-center text-[13px] font-medium leading-relaxed text-[#b5aeaa]">Show this QR at the door. Your ticket is also saved in <a href="/bookings" className="text-[#ff8a77] underline underline-offset-4">My bookings</a>.</p>
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button type="button" className={`${button} bg-[linear-gradient(135deg,#ff8a77,#ff5a43)] text-[#1a0a08] shadow-[0_10px_20px_-8px_rgba(255,59,47,.7),inset_0_1px_0_rgba(255,255,255,.35)]`} onClick={addToCalendar} disabled={!event.startAt}><CalendarIcon className="size-4 shrink-0" /><span>Add to calendar</span></button>
        <button type="button" className={`${button} border border-white/20 bg-white/5`} onClick={() => void share()}><Users className="size-4 shrink-0" /><span>{copied ? "Link copied" : "Invite a friend"}</span></button>
      </div>
      {feedback && <p role="status" className="mt-3 text-center text-xs leading-relaxed text-[#e7dfda]">{feedback}</p>}
      {hostHref && <a href={hostHref} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 w-full items-center justify-center text-center text-xs text-[#b5aeaa] underline underline-offset-4">Can&apos;t make it? Message SCENE</a>}
    </div>
  </motion.article>;
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1.5">{children}</span>;
}
