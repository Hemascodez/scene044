import type { ReactNode } from "react";

export type VenueIconName =
  | "arrow"
  | "building"
  | "calendar"
  | "camera"
  | "check"
  | "chevron"
  | "clock"
  | "close"
  | "coffee"
  | "mail"
  | "map"
  | "people"
  | "phone"
  | "projector"
  | "search"
  | "shield"
  | "spark"
  | "star"
  | "wallet";

const PATHS: Record<VenueIconName, ReactNode> = {
  arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  building: <><path d="M4 21V7l8-4 8 4v14" /><path d="M9 21v-4h6v4M8 9h1m6 0h1m-8 4h1m6 0h1" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  camera: <><path d="M14.5 5l-1-2h-3l-1 2H5a2 2 0 00-2 2v11a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2z" /><circle cx="12" cy="12" r="4" /></>,
  check: <path d="M5 12l4 4L19 6" />,
  chevron: <path d="M8 10l4 4 4-4" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  coffee: <><path d="M5 8h11v6a5 5 0 01-5 5h-1a5 5 0 01-5-5z" /><path d="M16 10h2a3 3 0 010 6h-2M7 4h7" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M4 7l8 6 8-6" /></>,
  map: <><path d="M12 21s7-6 7-12a7 7 0 10-14 0c0 6 7 12 7 12z" /><circle cx="12" cy="9" r="2" /></>,
  people: <><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
  phone: <path d="M5 3h4l2 5-2.5 1.5a16 16 0 006 6L16 13l5 2v4a2 2 0 01-2 2C10.2 20.5 3.5 13.8 3 5a2 2 0 012-2z" />,
  projector: <><rect x="3" y="5" width="18" height="12" rx="2" /><circle cx="15" cy="11" r="3" /><path d="M7 17v3m10-3v3" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></>,
  shield: <><path d="M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7z" /><path d="M8.5 12l2 2 5-5" /></>,
  spark: <path d="M12 2l1.7 5.3L19 9l-5.3 1.7L12 16l-1.7-5.3L5 9l5.3-1.7zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  star: <path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  wallet: <><path d="M4 6h14a2 2 0 012 2v11H5a2 2 0 01-2-2V6a3 3 0 013-3h11" /><path d="M15 11h6v5h-6a2.5 2.5 0 010-5z" /></>,
};

export function VenueIcon({ name, className = "size-5" }: { name: VenueIconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {PATHS[name]}
    </svg>
  );
}

export function VenueKicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-primary-ink ${className}`}>
      {children}
    </span>
  );
}

export function VenueSectionHeading({
  kicker,
  title,
  description,
  action,
}: {
  kicker: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-foreground/20 pb-5 sm:flex-row sm:items-end">
      <div className="max-w-2xl">
        <VenueKicker>{kicker}</VenueKicker>
        <h2 className="mt-2 font-display text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h2>
        {description && <p className="mt-2 text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export const venueButton = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white transition-[transform,background-color] duration-200 hover:bg-primary-ink active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45",
  dark:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-[transform,background-color] duration-200 hover:bg-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45",
  outline:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-foreground/25 bg-card px-5 py-2.5 text-sm font-bold text-foreground transition-[transform,border-color,background-color] duration-200 hover:border-foreground hover:bg-secondary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45",
} as const;

export type VenueBookingStatusLabel =
  | "requested"
  | "approved"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "declined"
  | "cancelled"
  | "expired";

export function VenueStatus({ status }: { status: VenueBookingStatusLabel }) {
  const meta = {
    requested: ["Awaiting host", "bg-warn/10 text-warn-ink"],
    approved: ["Approved · pay to confirm", "bg-signal/10 text-signal-ink"],
    confirmed: ["Booked", "bg-signal-ink text-white"],
    checked_in: ["Checked in", "bg-primary text-white"],
    completed: ["Completed", "bg-muted text-muted-foreground"],
    declined: ["Not available", "bg-muted text-muted-foreground"],
    cancelled: ["Cancelled", "bg-muted text-muted-foreground"],
    expired: ["Expired", "bg-muted text-muted-foreground"],
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] ${meta[1]}`}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {meta[0]}
    </span>
  );
}
