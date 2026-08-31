import type { ReactNode } from "react";
import type { SceneStatus } from "@/lib/client/sceneEvent";
import { STATUS_META } from "@/lib/client/sceneEvent";
import { isStaleCheck } from "@/lib/client/istTime";

export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-mono uppercase tracking-[0.14em] ${className}`}>{children}</span>;
}

/**
 * Status is never conveyed by colour alone — every badge carries its own text
 * label, and the live states add a blinking dot on top. That's what makes the
 * red "Cancelled" badge readable to someone who can't distinguish it from the
 * green "Confirmed" one.
 */
export function StatusBadge({ status }: { status: SceneStatus }) {
  const meta = STATUS_META[status];
  const tone = {
    ok: "bg-signal-ink text-white",
    warn: "bg-warn-ink text-white",
    bad: "bg-primary-ink text-white",
    muted: "bg-muted text-foreground",
  }[meta.tone];

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${tone}`}
    >
      {meta.tone !== "muted" && (
        <span className="scene-blink inline-block size-1.5 rounded-full bg-current" aria-hidden />
      )}
      {meta.label}
    </span>
  );
}

/** Green when we re-checked the listing recently, amber once it's over 48h old. */
export function FreshnessDot({ lastVerifiedAt }: { lastVerifiedAt: string | null }) {
  const stale = isStaleCheck(lastVerifiedAt);
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${stale ? "bg-warn-ink" : "bg-signal-ink"}`}
      aria-hidden
    />
  );
}

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 px-4 py-2.5 font-mono text-xs font-semibold uppercase tracking-[0.14em] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const BTN_VARIANTS = {
  solid:
    "bg-foreground text-background border-2 border-foreground hover:bg-primary hover:border-primary hover:text-primary-foreground active:translate-y-0.5",
  outline:
    "bg-transparent text-foreground border-2 border-foreground hover:bg-foreground hover:text-background active:translate-y-0.5",
  ghost: "bg-transparent text-foreground border-2 border-transparent hover:border-foreground",
} as const;

export type BtnVariant = keyof typeof BTN_VARIANTS;

interface BtnBaseProps {
  children: ReactNode;
  variant?: BtnVariant;
  className?: string;
  title?: string;
}

export function Btn({
  children,
  onClick,
  variant = "solid",
  className = "",
  disabled,
  title,
  type = "button",
}: BtnBaseProps & {
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Anchor-shaped twin of `Btn`.
 *
 * Outbound registration links must be real anchors pointing at
 * `/api/go/{id}` — a router push or `window.open` would skip the 302 and the
 * click log, and would take the visitor's place in the feed with it.
 */
export function BtnLink({
  children,
  href,
  variant = "solid",
  className = "",
  title,
  newTab = true,
  onNavigate,
}: BtnBaseProps & { href: string; newTab?: boolean; onNavigate?: () => void }) {
  return (
    <a
      href={href}
      title={title}
      onClick={onNavigate}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
      {newTab && <span className="sr-only"> (opens in a new tab)</span>}
    </a>
  );
}

export function SaveIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4 shrink-0" aria-hidden>
      <path
        d="M6 3h12v18l-6-4-6 4V3z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
