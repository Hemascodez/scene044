"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Mono } from "@/components/scene/ui";
import {
  getAlertsDone,
  getServerAlertsDone,
  markAlertsDone,
  subscribeAlertsOptIn,
} from "@/lib/client/alertsOptIn";

/**
 * Event-alerts opt-in — ported from the Figma Make design.
 *
 * The whole point of this flow is that we never ask for a phone number. The
 * visitor picks what they care about, taps through to WhatsApp, and their own
 * app opens with a message pre-written. They send it themselves. That inbound
 * message IS the consent Meta requires, and it opens a 24-hour window in which
 * replies are free. So there is no contact field below, and there must not be
 * one — a number typed into a form is not an opt-in.
 *
 * Three things deliberately differ from the Make source:
 *
 *  1. The channel control is a real <a href>, not a button calling
 *     window.open() from inside a setTimeout. A deferred window.open is no
 *     longer attributable to the user's tap, so browsers block it as an
 *     unsolicited popup — WhatsApp would have failed routinely even where it
 *     was installed. An anchor is a plain navigation and nothing blocks it.
 *  2. There is no automatic failure detection. The original `catch` could
 *     never fire, so the escape hatch is offered to the visitor rather than
 *     guessed at.
 *  3. The control uses `signal-ink`, not `signal`. White on --color-signal
 *     measures 4.16:1, under the 4.5:1 AA floor; signal-ink is 6.11:1. See the
 *     note in app/globals.css.
 */

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/[^\d]/g, "") ?? "";

const INTERESTS = [
  "Artificial Intelligence",
  "Software Development",
  "Design and UX",
  "Marketing",
  "Cybersecurity",
  "Data",
  "Startups and Founders",
  "Product",
  "Career and Networking",
  "All events",
] as const;

const ROLES = [
  "Student",
  "Working professional",
  "Founder or entrepreneur",
  "Freelancer",
  "Other",
  "Prefer not to say",
] as const;

/**
 * Keyed on FIELD_CARDS labels (lib/fieldCards.ts), which is what callers pass
 * as `categoryHint` — not the raw category slug. Finance & Fintech is
 * deliberately unmapped: there is no matching interest, and preselecting a
 * near-miss is worse than preselecting nothing.
 */
const CATEGORY_TO_INTEREST: Record<string, string> = {
  "AI & Machine Learning": "Artificial Intelligence",
  "Software & Engineering": "Software Development",
  "Product & Design": "Design and UX",
  "Marketing & Growth": "Marketing",
  Cybersecurity: "Cybersecurity",
  "Startups & Business": "Startups and Founders",
  "Data & Cloud": "Data",
};

type Phase = "form" | "opening" | "fallback";

const CTRL =
  "inline-flex min-h-[44px] items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const CTRL_OUTLINE = `${CTRL} border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background active:translate-y-0.5`;
const CTRL_GHOST = `${CTRL} border-2 border-transparent bg-transparent text-foreground hover:border-foreground`;

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9.5 19a2.5 2.5 0 0 0 5 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 8.5c0 3.6 2.9 6.5 6.5 6.5.4 0 .8-.4.8-.9 0-.2-.1-.4-.3-.5l-1.4-.7c-.2-.1-.5-.1-.6.1l-.5.6c-1.1-.5-2-1.4-2.5-2.5l.6-.5c.2-.1.2-.4.1-.6l-.7-1.4c-.1-.2-.3-.3-.5-.3-.5 0-.9.4-.9.8Z" fill="currentColor" />
    </svg>
  );
}

export function AlertsBanner({
  categoryHint = null,
  className = "",
}: {
  categoryHint?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const alreadyDone = useSyncExternalStore(
    subscribeAlertsOptIn,
    getAlertsDone,
    getServerAlertsDone,
  );

  // Nothing to opt into without a number — better to render nothing than a
  // banner whose button goes nowhere. And nothing to ask twice of someone who
  // has already been through the flow.
  if (!WHATSAPP_NUMBER || alreadyDone) return null;

  return (
    <div className={`border-2 border-foreground bg-foreground p-5 text-background sm:p-6 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 hidden text-primary sm:block" aria-hidden>
            <BellIcon />
          </span>
          <div>
            <Mono className="text-[11px] text-primary">Stay in the loop</Mono>
            <h3 className="mt-1 font-display text-xl font-black leading-tight tracking-tight sm:text-2xl">
              Scene podunga, bro.
            </h3>
            <p className="mt-1.5 max-w-md text-sm leading-relaxed text-background/70">
              Get Chennai&apos;s tech scene at your fingertips. No spam, only scene.
            </p>
          </div>
        </div>
        <div className="shrink-0" ref={triggerRef}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`${CTRL} w-full border-2 border-primary bg-primary text-primary-foreground hover:border-background hover:bg-background hover:text-foreground active:translate-y-0.5 sm:w-auto`}
          >
            Get Scened →
          </button>
        </div>
      </div>

      {open && (
        <AlertsSheet
          categoryHint={categoryHint}
          onClose={() => {
            setOpen(false);
            triggerRef.current?.querySelector("button")?.focus();
          }}
        />
      )}
    </div>
  );
}

const FIELD =
  "w-full border-2 border-foreground bg-background px-3 py-2 text-sm outline-none focus:bg-secondary focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background placeholder:text-muted-foreground/60";

function AlertsSheet({
  categoryHint,
  onClose,
}: {
  categoryHint?: string | null;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [interests, setInterests] = useState<string[]>(() => {
    const pre = categoryHint ? CATEGORY_TO_INTEREST[categoryHint] : undefined;
    return pre ? [pre] : [];
  });
  const [showValidation, setShowValidation] = useState(false);
  const [phase, setPhase] = useState<Phase>("form");
  const [copied, setCopied] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const toggleInterest = (opt: string) =>
    setInterests((cur) => (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]));

  const lines = useMemo(
    () => [
      `Name: ${name.trim() || "Not provided"}`,
      `I'm a: ${role || "Not specified"}`,
      `Interested in: ${interests.length ? interests.join(", ") : "Not specified"}`,
    ],
    [name, role, interests],
  );

  // encodeURIComponent, not URLSearchParams: the latter encodes spaces as "+",
  // which WhatsApp renders literally in the message box.
  const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Scene, I'd like to receive Chennai event alerts.\n\n${lines.join("\n")}`,
  )}`;

  /** Returns false and shows the alert when nothing is selected. Called from
   *  the anchor's click handler so an invalid tap preventDefaults instead of
   *  navigating. */
  const valid = () => {
    if (interests.length === 0) {
      setShowValidation(true);
      groupRef.current?.focus();
      return false;
    }
    return true;
  };

  const copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="alerts-heading"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="scene-rise relative max-h-[88vh] w-full max-w-lg overflow-y-auto border-2 border-foreground bg-background text-foreground shadow-[8px_8px_0_0] shadow-foreground focus:outline-none"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-foreground bg-foreground px-4 py-3 text-background">
          <div className="flex items-baseline gap-1.5">
            <Mono className="text-[11px] text-primary">Scene alerts</Mono>
            <span className="font-display text-lg font-black tracking-tighter">Keep me posted</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-11 place-items-center font-mono text-lg leading-none text-background/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            ✕
          </button>
        </div>

        {phase === "form" && (
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <h2 id="alerts-heading" className="font-display text-xl font-black leading-tight tracking-tight sm:text-2xl">
              What should we keep you posted about?
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              Tell us what you&apos;re interested in, then continue in WhatsApp.
            </p>

            <div className="mt-5 space-y-5">
              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">Name (optional)</Mono>
                <input
                  className={`mt-1.5 ${FIELD}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="What should we call you?"
                  autoComplete="name"
                />
              </label>

              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">You are a…</Mono>
                <select className={`mt-1.5 ${FIELD}`} value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">Select one (optional)</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <Mono className="text-[10px] text-muted-foreground">Events you&apos;re interested in *</Mono>

                {interests.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {interests.map((it) => (
                      <span
                        key={it}
                        className="inline-flex items-center gap-1.5 border-2 border-foreground bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-foreground"
                      >
                        {it}
                        <button
                          type="button"
                          onClick={() => toggleInterest(it)}
                          aria-label={`Remove ${it}`}
                          className="grid size-4 place-items-center leading-none hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div
                  ref={groupRef}
                  role="group"
                  aria-label="Events you're interested in"
                  tabIndex={-1}
                  className={`mt-2 flex flex-wrap gap-1.5 focus:outline-none ${
                    showValidation && interests.length === 0 ? "border-2 border-primary p-2" : ""
                  }`}
                >
                  {INTERESTS.map((opt) => {
                    const on = interests.includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          toggleInterest(opt);
                          setShowValidation(false);
                        }}
                        className={`inline-flex min-h-[44px] items-center gap-1.5 border-2 border-foreground px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                          on ? "bg-primary text-primary-foreground" : "bg-background hover:bg-secondary"
                        }`}
                      >
                        <span aria-hidden className="text-xs">
                          {on ? "✓" : "+"}
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {showValidation && interests.length === 0 && (
                  <p
                    role="alert"
                    className="mt-2 flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-primary-ink"
                  >
                    <span aria-hidden>⚠</span>
                    Pick at least one topic so we know what to send.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 border-t-2 border-foreground pt-4">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!valid()) {
                    e.preventDefault();
                    return;
                  }
                  setPhase("opening");
                }}
                className={`${CTRL} w-full border-2 border-signal-ink bg-signal-ink text-white hover:border-foreground hover:bg-foreground active:translate-y-0.5`}
              >
                <WhatsAppIcon />
                Continue with WhatsApp
              </a>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                No phone number field here. WhatsApp opens with the message already written — you share
                your number only when you press send.
              </p>
            </div>
          </div>
        )}

        {phase === "opening" && (
          <div className="flex flex-col items-center px-6 py-14 text-center" aria-live="polite">
            <span className="text-primary">
              <WhatsAppIcon />
            </span>
            <span className="scene-blink mt-3 inline-block size-2 rounded-full bg-primary" />
            <h3 className="mt-4 font-display text-xl font-black tracking-tight">Opening WhatsApp…</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Review the prefilled message and send it yourself — that&apos;s how we know it&apos;s really you.
            </p>
            {/* Self-reported, and phrased that way on purpose. The handoff
                leaves our page, so the browser never learns whether they
                pressed send — this only stops us asking again. */}
            <div className="mt-6 flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  markAlertsDone();
                  onClose();
                }}
                className={`${CTRL} w-full border-2 border-signal-ink bg-signal-ink text-white hover:border-foreground hover:bg-foreground active:translate-y-0.5 sm:w-auto`}
              >
                ✓ Sent it — don&apos;t ask again
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {/* Offered rather than auto-detected: there is no reliable
                    signal that an app-handoff failed. */}
                <button type="button" onClick={() => setPhase("fallback")} className={CTRL_GHOST}>
                  Nothing opened?
                </button>
                <button type="button" onClick={() => setPhase("form")} className={CTRL_GHOST}>
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {phase === "fallback" && (
          <div className="px-4 py-6 sm:px-5" aria-live="assertive">
            <div className="flex items-start gap-3 border-l-4 border-primary bg-secondary px-3 py-3">
              <span className="font-display text-2xl leading-none text-primary-ink" aria-hidden>
                ✕
              </span>
              <div>
                <h3 className="font-display text-xl font-black tracking-tight">WhatsApp didn&apos;t open</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Copy your preferences and message us directly instead.
                </p>
              </div>
            </div>

            <div className="mt-4 border-2 border-foreground bg-card p-3">
              <Mono className="text-[10px] text-muted-foreground">Your preferences</Mono>
              <pre className="mt-1.5 whitespace-pre-wrap font-mono text-xs text-foreground">{lines.join("\n")}</pre>
              <Mono className="mt-2 block text-[10px] text-muted-foreground">Send to +{WHATSAPP_NUMBER}</Mono>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={copyDetails}
                className={`${CTRL} border-2 border-primary bg-primary text-primary-foreground hover:border-foreground hover:bg-foreground active:translate-y-0.5`}
              >
                {copied ? "Copied ✓" : "Copy details"}
              </button>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPhase("opening")}
                className={CTRL_OUTLINE}
              >
                <WhatsAppIcon />
                Try again
              </a>
              <button type="button" onClick={onClose} className={CTRL_GHOST}>
                Cancel
              </button>
            </div>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Your selections are saved here — nothing was lost.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
