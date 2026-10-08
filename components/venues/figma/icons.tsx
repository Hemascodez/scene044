"use client";

type P = { className?: string; strokeWidth?: number }

const base = (d: React.ReactNode, { className = 'size-4', strokeWidth = 1.75 }: P) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    {d}
  </svg>
)

export const ArrowRight = (p: P) => base(<path d="M5 12h14M13 6l6 6-6 6" />, p)
export const ChevronLeft = (p: P) => base(<path d="M15 6l-6 6 6 6" />, p)
export const ChevronRight = (p: P) => base(<path d="M9 6l6 6-6 6" />, p)
export const ChevronDown = (p: P) => base(<path d="M6 9l6 6 6-6" />, p)
export const Close = (p: P) => base(<path d="M6 6l12 12M18 6L6 18" />, p)
export const Check = (p: P) => base(<path d="M5 12.5l4.5 4.5L19 7.5" />, p)
export const ShieldCheck = (p: P) =>
  base(
    <>
      <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </>,
    p,
  )
export const MapPin = (p: P) =>
  base(
    <>
      <path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </>,
    p,
  )
export const Clock = (p: P) =>
  base(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>,
    p,
  )
/** Verified-organiser seal (rosette + tick), from the approved Figma frame. */
export const VerifiedSeal = ({ className = 'size-4' }: { className?: string }) => (
  <svg viewBox="0 0 16 16" className={className} aria-hidden="true" fill="currentColor">
    <path d="M5.52727 16L4.14545 13.5619L1.52727 12.9524L1.78182 10.1333L0 8L1.78182 5.86667L1.52727 3.04762L4.14545 2.4381L5.52727 0L8 1.10476L10.4727 0L11.8545 2.4381L14.4727 3.04762L14.2182 5.86667L16 8L14.2182 10.1333L14.4727 12.9524L11.8545 13.5619L10.4727 16L8 14.8952L5.52727 16ZM6.14545 14.0571L8 13.219L9.89091 14.0571L10.9091 12.2286L12.9091 11.7333L12.7273 9.6L14.0727 8L12.7273 6.36191L12.9091 4.22857L10.9091 3.77143L9.85455 1.94286L8 2.78095L6.10909 1.94286L5.09091 3.77143L3.09091 4.22857L3.27273 6.36191L1.92727 8L3.27273 9.6L3.09091 11.7714L5.09091 12.2286L6.14545 14.0571ZM7.23636 10.7048L11.3455 6.4L10.3273 5.29524L7.23636 8.53333L5.67273 6.93333L4.65455 8L7.23636 10.7048Z" />
  </svg>
)

export const Star = ({ className = 'size-4' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
    <path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8z" />
  </svg>
)
export const Phone = (p: P) =>
  base(
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z" />,
    p,
  )
export const Search = (p: P) =>
  base(
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>,
    p,
  )
export const Heart = (p: P) =>
  base(<path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />, p)

export const ArrowLeft = (p: P) => base(<path d="M19 12H5M11 6l-6 6 6 6" />, p)
export const Users = (p: P) =>
  base(
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5a3 3 0 010 6M18 14.8c1.8.7 3 2.4 3 5.2" />
    </>,
    p,
  )
export const Wifi = (p: P) =>
  base(
    <>
      <path d="M2.5 9a14 14 0 0119 0M5.5 12.5a9.5 9.5 0 0113 0M8.7 16a5 5 0 016.6 0" />
      <circle cx="12" cy="19.2" r=".8" fill="currentColor" />
    </>,
    p,
  )
export const Mic = (p: P) =>
  base(
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </>,
    p,
  )
export const Coffee = (p: P) =>
  base(
    <>
      <path d="M4 9h12v5a5 5 0 01-5 5H9a5 5 0 01-5-5V9zM16 10h2a2.5 2.5 0 010 5h-2M8 3v3M12 3v3" />
    </>,
    p,
  )
export const Zap = (p: P) => base(<path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />, p)
export const Projector = (p: P) =>
  base(
    <>
      <rect x="2.5" y="7" width="19" height="9" rx="2" />
      <circle cx="15.5" cy="11.5" r="2.2" />
      <path d="M6 19v-3M18 19v-3" />
    </>,
    p,
  )
export const Volume = (p: P) =>
  base(<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5zM15.5 9a4 4 0 010 6M18 6.5a8 8 0 010 11" />, p)
export const Scissors = (p: P) =>
  base(
    <>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8 8l12 9M8 16L20 7" />
    </>,
    p,
  )
export const Quote = (p: P) =>
  base(<path d="M10 7H5.5v5H9c0 2-1 3.5-3 4M19 7h-4.5v5H18c0 2-1 3.5-3 4" />, p)
export const Share = (p: P) =>
  base(
    <>
      <path d="M12 15V3M8 7l4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
    </>,
    p,
  )
export const CalendarIcon = (p: P) =>
  base(
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
    </>,
    p,
  )

export const Bell = (p: P) =>
  base(
    <>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>,
    p,
  )

export const QrCode = (p: P) =>
  base(
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h7" />
    </>,
    p,
  )

export const Wallet = (p: P) =>
  base(
    <>
      <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H4a2 2 0 0 0-2 2v2" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
    </>,
    p,
  )

export const Plus = (p: P) =>
  base(
    <>
      <path d="M12 5v14M5 12h14" />
    </>,
    p,
  )

export const TrendingUp = (p: P) =>
  base(
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>,
    p,
  )

export const Link2 = (p: P) =>
  base(
    <>
      <path d="M15 7h3a5 5 0 0 1 5 5 5 5 0 0 1-5 5h-3m-6 0H6a5 5 0 0 1-5-5 5 5 0 0 1 5-5h3" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </>,
    p,
  )

