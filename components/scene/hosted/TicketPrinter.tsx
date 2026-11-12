"use client";

import type { CSSProperties } from "react";
import { PRINT_TIMING } from "@/lib/client/ticketSound";
import { useStageScale } from "@/lib/client/useStageScale";
import styles from "@/components/scene/hosted/TicketPrinter.module.css";

/**
 * The payment-success ticket printer. `printing` loops while the server
 * confirms the payment; `printed` feeds the ticket out once. Ported from the
 * "Payment success ticket printer" design, in SCENE's colours and fonts.
 *
 * The stage is laid out at its design size (560 × 740) and scaled to the card
 * width, so every coordinate matches the design at any screen size.
 */

const STAGE_W = 560;
const STAGE_H = 740;

// SCENE tokens as literals (app/globals.css): SVG presentation attributes
// don't reliably resolve CSS variables.
const INK = "#14130d"; // --color-foreground
const ACCENT = "#ff2d16"; // --color-primary
const PAPER = "#fbfaf5"; // --color-card
const MONO = "'Space Mono', ui-monospace, SFMono-Regular, Consolas, monospace";

export function TicketPrinter({
  phase,
  eventTitle,
  guestName,
  eventDate,
}: {
  phase: "printing" | "printed";
  eventTitle: string;
  guestName: string;
  eventDate: string;
}) {
  const { frameRef, scale } = useStageScale<HTMLDivElement>(STAGE_W);

  const timing = {
    "--tp-feed": `${PRINT_TIMING.feedMs}ms`,
    "--tp-settle": `${PRINT_TIMING.settleMs}ms`,
  } as CSSProperties;

  return (
    <div ref={frameRef} className="relative w-full" style={{ height: STAGE_H * scale }} aria-hidden>
      <div
        className={styles.stage}
        data-phase={phase}
        style={{ ...timing, transform: `scale(${scale})`, visibility: scale ? "visible" : "hidden" }}
      >
        <div
          className={styles.glow}
          style={{
            position: "absolute",
            left: 30,
            top: 320,
            width: 500,
            height: 400,
            background: "radial-gradient(ellipse at center, rgba(255,45,22,.16), rgba(255,45,22,0) 70%)",
          }}
        />

        <p
          className={`${styles.tag} font-display`}
          style={{ position: "absolute", left: 0, right: 0, top: 0, margin: 0, textAlign: "center", fontSize: 15, fontWeight: 900, letterSpacing: ".06em", color: INK }}
        >
          PAYMENT SUCCESSFUL
        </p>

        {/* Paper path: the ticket starts inside the machine and feeds out of the slot. */}
        <div style={{ position: "absolute", left: 60, top: 252, width: 440, height: 488, overflow: "hidden" }}>
          <div className={styles.ticket} style={{ position: "absolute", left: 40, top: 0, width: 360, height: 430 }}>
            <PrintedTicket eventTitle={eventTitle} guestName={guestName} eventDate={eventDate} />
          </div>
        </div>

        <div className={styles.machine} style={{ position: "absolute", left: 0, top: 34, width: 560, height: 230 }}>
          <Machine />
        </div>
      </div>
    </div>
  );
}

function PrintedTicket({ eventTitle, guestName, eventDate }: { eventTitle: string; guestName: string; eventDate: string }) {
  const notch: CSSProperties = {
    position: "absolute",
    top: -15,
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "#ffffff",
    border: `3px solid ${INK}`,
    boxSizing: "content-box",
  };
  return (
    <div
      style={{
        position: "relative",
        width: 360,
        height: 430,
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        border: `3px solid ${INK}`,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: `6px 6px 0 ${INK}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "12px 25px",
          background: "var(--color-primary-ink)",
          color: "#ffffff",
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: ".14em",
        }}
      >
        <span>SCENE/044</span>
        <span>ADMIT ONE</span>
      </div>
      <div style={{ padding: "22px 25px 0", display: "flex", flexDirection: "column", flex: 1 }}>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 900, color: "var(--color-primary-ink)" }}>
          You&apos;re going to
        </div>
        <div className="font-display" style={{ marginTop: 6, fontSize: 38, lineHeight: 1.02, fontWeight: 900, letterSpacing: "-.02em" }}>
          {eventTitle}
        </div>
        <div style={{ position: "relative", margin: "24px -25px 0", borderTop: `2px dashed ${INK}`, height: 0 }}>
          <div style={{ ...notch, left: -17 }} />
          <div style={{ ...notch, right: -17 }} />
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <TicketLine label="NAME" value={guestName} />
          <TicketLine label="DATE" value={eventDate} />
        </div>
        <div
          style={{
            marginTop: "auto",
            marginBottom: 20,
            height: 40,
            background: `repeating-linear-gradient(90deg, ${INK} 0 2px, transparent 2px 4px, ${INK} 4px 5px, transparent 5px 9px, ${INK} 9px 12px, transparent 12px 14px)`,
          }}
        />
      </div>
    </div>
  );
}

function TicketLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", color: "var(--color-muted-foreground)" }}>{label}</div>
      <div className="font-display" style={{ marginTop: 2, fontSize: 22, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

function Machine() {
  return (
    <svg width="560" height="230" viewBox="0 0 560 230" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="tp-dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1.2" fill={INK} />
        </pattern>
        <g id="tp-star">
          <polygon points="33,8 37.5,19 49,19.5 40,27 43,39 33,32.5 23,39 26,27 17,19.5 28.5,19" fill={INK} />
        </g>
        <g id="tp-heart">
          <path d="M33 38 C14 26 20 10 33 20 C46 10 52 26 33 38Z" fill={INK} />
        </g>
        <g id="tp-diamond">
          <polygon points="33,8 47,24 33,40 19,24" fill={INK} />
        </g>
        <g id="tp-tick">
          <rect x="16" y="14" width="34" height="20" rx="3" fill={ACCENT} stroke={INK} strokeWidth="2" />
          <circle cx="16" cy="24" r="4" fill="#ffffff" stroke={INK} strokeWidth="2" />
          <circle cx="50" cy="24" r="4" fill="#ffffff" stroke={INK} strokeWidth="2" />
          <line x1="33" y1="16" x2="33" y2="32" stroke="#ffffff" strokeWidth="2" strokeDasharray="3 2" />
        </g>
        <g id="tp-strip">
          <use href="#tp-star" />
          <use href="#tp-heart" y="48" />
          <use href="#tp-diamond" y="96" />
          <use href="#tp-tick" y="144" />
          <use href="#tp-star" y="192" />
          <use href="#tp-heart" y="240" />
          <use href="#tp-diamond" y="288" />
          <use href="#tp-tick" y="336" />
        </g>
      </defs>

      <path d="M60 74 C60 30 100 14 160 14 L430 14 L430 30 L128 30 C98 32 90 52 90 74 Z" fill={INK} />
      <rect x="60" y="62" width="440" height="148" rx="10" fill={ACCENT} stroke={INK} strokeWidth="3" />
      <rect x="70" y="128" width="300" height="72" rx="4" fill="url(#tp-dots)" />

      <circle cx="104" cy="64" r="22" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <circle cx="104" cy="64" r="15" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="104" cy="64" r="8" fill="none" stroke={INK} strokeWidth="2" />
      <circle cx="104" cy="64" r="2.5" fill={INK} />

      <rect x="190" y="34" width="232" height="66" rx="6" fill={INK} />
      <rect x="198" y="42" width="66" height="50" fill="#ffffff" />
      <rect x="272" y="42" width="66" height="50" fill="#ffffff" />
      <rect x="346" y="42" width="66" height="50" fill="#ffffff" />
      <svg x="198" y="43" width="66" height="48" overflow="hidden">
        <g className={styles.reel}>
          <use href="#tp-strip" />
        </g>
      </svg>
      <svg x="272" y="43" width="66" height="48" overflow="hidden">
        <g className={`${styles.reel} ${styles.reel2}`}>
          <use href="#tp-strip" />
        </g>
      </svg>
      <svg x="346" y="43" width="66" height="48" overflow="hidden">
        <g className={`${styles.reel} ${styles.reel3}`}>
          <use href="#tp-strip" />
        </g>
      </svg>

      <line x1="68" y1="112" x2="42" y2="86" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      <circle cx="40" cy="84" r="8" fill="#ffffff" stroke={INK} strokeWidth="3" />

      <circle cx="120" cy="150" r="30" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <g className={styles.dial}>
        <circle cx="120" cy="150" r="21" fill="none" stroke={INK} strokeWidth="3" />
        <line x1="120" y1="129" x2="120" y2="171" stroke={INK} strokeWidth="3" />
        <line x1="99" y1="150" x2="141" y2="150" stroke={INK} strokeWidth="3" />
        <line x1="105" y1="135" x2="135" y2="165" stroke={INK} strokeWidth="3" />
        <line x1="135" y1="135" x2="105" y2="165" stroke={INK} strokeWidth="3" />
        <circle cx="120" cy="150" r="5" fill={ACCENT} stroke={INK} strokeWidth="2" />
      </g>

      <rect x="384" y="104" width="104" height="92" rx="5" fill={INK} />
      <rect x="392" y="112" width="88" height="22" rx="3" fill="#000000" stroke="#555555" strokeWidth="1" />
      <text className={styles.statusPrinting} x="398" y="127" fontFamily={MONO} fontSize="10.5" fontWeight="700" letterSpacing=".6" fill="#ff5a4f">
        PRINTING...
      </text>
      <text className={styles.statusReady} x="398" y="127" fontFamily={MONO} fontSize="10.5" fontWeight="700" letterSpacing=".6" fill="#ffffff">
        TICKET READY
      </text>
      <g fill="#ffffff">
        <circle cx="404" cy="152" r="5" />
        <circle cx="426" cy="152" r="5" />
        <circle cx="448" cy="152" r="5" />
        <circle cx="470" cy="152" r="5" />
        <circle cx="404" cy="176" r="5" />
        <circle cx="426" cy="176" r="5" />
      </g>
      <circle cx="470" cy="176" r="6" fill="#444444" stroke="#ffffff" strokeWidth="2" />
      <circle className={styles.ledRed} cx="470" cy="176" r="6" fill="#ff3b30" stroke="#ffffff" strokeWidth="2" />
      <circle className={styles.ledWhite} cx="470" cy="176" r="6" fill="#ffffff" stroke="#ffffff" strokeWidth="2" />

      <path d="M100 196 L100 172 L460 172 L460 196 Z" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <line x1="112" y1="182" x2="448" y2="182" stroke={INK} strokeWidth="2" strokeDasharray="2 5" />
      <rect x="90" y="196" width="380" height="30" rx="15" fill="#ffffff" stroke={INK} strokeWidth="3" />
      <line x1="112" y1="205" x2="448" y2="205" stroke={INK} strokeWidth="2" opacity=".25" />
      <rect x="78" y="192" width="22" height="38" rx="5" fill={INK} />
      <rect x="460" y="192" width="22" height="38" rx="5" fill={INK} />
      <circle cx="89" cy="211" r="4" fill={ACCENT} />
      <circle cx="471" cy="211" r="4" fill={ACCENT} />
    </svg>
  );
}
