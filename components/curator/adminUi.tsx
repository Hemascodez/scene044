"use client";

import { forwardRef, type ReactNode } from "react";

/**
 * Scoped dark-admin primitives.
 *
 * The public app is light paper-and-ink; the curator surface commits to its own
 * dark green-tinted palette. Deliberately hard-coded hex rather than the global
 * theme tokens — remapping `--color-background` for one route would leak into
 * anything shared, and the visual break is the point: you can tell at a glance
 * whether you're looking at the public site or the internal tool.
 */

export const ADMIN_GREEN = "#39ff9b";

const INPUT_CLS =
  "w-full border border-[#2c4236] bg-[#0b1611] px-3 py-2 font-sans text-sm text-[#e9efe7] placeholder:text-[#4d6155] transition-colors focus:border-[#39ff9b] focus:outline-none";

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#39ff9b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a130f] active:translate-y-px";

const BTN_VARIANTS = {
  primary:
    "bg-[#39ff9b] text-[#04160d] border border-[#39ff9b] hover:bg-[#5effb0] shadow-[0_0_0_1px_rgba(57,255,155,0.25)]",
  outline:
    "bg-transparent text-[#e9efe7] border border-[#33493c] hover:border-[#39ff9b] hover:text-[#39ff9b]",
  ghost: "bg-transparent text-[#8ba295] border border-transparent hover:text-[#e9efe7] hover:bg-white/5",
  danger:
    "bg-transparent text-[#ff8a7a] border border-[#5a3230] hover:bg-[#ff5a45] hover:text-[#160504] hover:border-[#ff5a45]",
} as const;

export function AdminBtn({
  children,
  onClick,
  variant = "outline",
  className = "",
  disabled,
  title,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: keyof typeof BTN_VARIANTS;
  className?: string;
  disabled?: boolean;
  title?: string;
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

export function AdminLink({
  children,
  href,
  variant = "outline",
  className = "",
  newTab = true,
}: {
  children: ReactNode;
  href: string;
  variant?: keyof typeof BTN_VARIANTS;
  className?: string;
  newTab?: boolean;
}) {
  return (
    <a
      href={href}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${className}`}
    >
      {children}
    </a>
  );
}

export function AdminLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ba295]">
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5">
        <AdminLabel>{label}</AdminLabel>
        {required && (
          <span className="text-[#39ff9b]" aria-hidden>
            *
          </span>
        )}
      </span>
      {children}
      {hint && <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f7568]">{hint}</span>}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TextInput({ className = "", ...props }, ref) {
    return <input ref={ref} {...props} className={`${INPUT_CLS} ${className}`} />;
  },
);

export function TextArea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT_CLS} resize-y leading-relaxed ${className}`} />;
}

export function Select({ className = "", ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT_CLS} ${className}`} />;
}

/** A status pill that never relies on colour alone — always carries a glyph and a label. */
export function Pill({
  tone,
  glyph,
  children,
}: {
  tone: "green" | "amber" | "red" | "muted" | "blue";
  glyph: string;
  children: ReactNode;
}) {
  const map = {
    green: "border-[#2f7a52] bg-[#0f2a1c] text-[#5effb0]",
    amber: "border-[#8a6a1e] bg-[#2a2110] text-[#ffcf7a]",
    red: "border-[#8a3630] bg-[#2a1310] text-[#ff9a8a]",
    muted: "border-[#39493f] bg-[#141f19] text-[#8ba295]",
    blue: "border-[#2f5a8a] bg-[#0f1d2a] text-[#7ab8ff]",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${map}`}
    >
      <span aria-hidden>{glyph}</span>
      {children}
    </span>
  );
}

export function Divider() {
  return <div className="h-px w-full bg-[#25382e]" />;
}

export function AdminWordmark({ suffix }: { suffix?: string }) {
  return (
    <div className="flex items-baseline gap-0.5">
      <span className="font-display text-lg font-black tracking-tighter text-[#e9efe7]">SCENE</span>
      <span className="bg-[#39ff9b] px-1.5 font-display text-lg font-black tracking-tighter text-[#04160d]">
        /044
      </span>
      {suffix && (
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8ba295]">{suffix}</span>
      )}
    </div>
  );
}
