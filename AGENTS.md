# Scene044 — agent instructions

Read this before changing anything. It is the canonical guide for this
branch; `CLAUDE.md` points here.

## 🎯 Current task: port this into the Next.js app

The goal for this branch is to port its visual design and motion into the
real product on `main`. **Read [docs/NEXTJS-PORT.md](./docs/NEXTJS-PORT.md)
before starting** — it has the screen mapping, the design-token mapping,
the booking-status mapping (including two states the prototype is missing),
and what explicitly must not be ported.

The short version: `main` already has the complete venue product (DB-backed
bookings, Razorpay, WhatsApp OTP, QR check-in). This is a **re-skin and
motion port onto screens that already exist** — not a rebuild, and not a
merge. The prototype's data layer, router and auth are throwaway scaffolding.

## What this branch is

This is the **`venue-redesign`** branch of `Hemascodez/scene044`.

> ⚠️ **`main` is a completely different application.** `main` holds
> `chennai-events-mvp` — a Next.js App Router app with Postgres, Firebase,
> OpenAI, WhatsApp digest crons and QR check-in. This branch shares **no
> history and no stack** with it. Do not try to reconcile, rebase onto, or
> merge `main` into this branch, and do not push to `main`. If a task
> sounds like "integrate this into the real app", that is a **port** to
> Next.js, not a merge — follow [docs/NEXTJS-PORT.md](./docs/NEXTJS-PORT.md).

Two apps live here, sharing one `node_modules` and one React install:

```
src/        venue booking web app   Vite 8 + React 19 + Tailwind v4
remotion/   motion-graphics workspace   Remotion 4.0.532
```

## Setup and verification

```bash
npm install
npm run dev          # venue app  → http://localhost:5173
npm run typecheck    # tsc over src/
npm run build        # production build
npm run video:studio # Remotion Studio
npm run video:render # SampleVideo → out/SampleVideo.mp4
```

Always finish a change with `npm run typecheck && npm run build`. For video
work add `npm run video:typecheck`.

## 🚨 Do not "fix" these — they are deliberate

Each of these looks like a mistake and is not. Changing them breaks the
build or silently reintroduces a bug.

1. **`@vitejs/plugin-react-swc`, NOT `@vitejs/plugin-react`.**
   The Babel version of the plugin pulls Babel 8; Remotion's
   `@remotion/studio-server` depends on `@svgr/*`, which requires Babel 7.
   They cannot coexist — `npm install` fails outright with ERESOLVE.
   SWC avoids Babel entirely. Vite's own terminal output *recommends*
   switching to `@vitejs/plugin-react`. **Ignore that advice here.**

2. **`server.host: "127.0.0.1"` in `vite.config.ts`.**
   Without it Vite binds only to IPv6 `::1`, and `http://127.0.0.1:5173`
   refuses connections while `localhost` works — breaks headless browsers,
   curl and CI in a way that looks intermittent.

3. **`relative` on the host workspace `<nav>`** (`src/components/HostWorkspace.tsx`).
   It looks like a stray utility class. It is the fix for a real mobile bug:
   the tab bar has `overflow-x-auto`, but its scrollable overflow propagated
   to ancestors and made the whole document scroll horizontally on mobile
   (817px of content in a 390px viewport). `relative` makes the nav a
   containing block so the overflow is contained. Do not remove it, and do
   not replace it with `overflow-x: hidden` on the header — that clips the
   sticky header's hard shadow.

4. **Version pins.** `remotion` and every `@remotion/*` package must stay on
   the **same exact version** (`4.0.532`, no `^`). Use `npm run video:upgrade`
   to bump them together. `@types/react` and `@types/react-dom` must stay on
   the same minor (`19.2.7`) or peer resolution fails.

## Architecture

`src/App.tsx` is a hash router: `home`, `venue`, `bookings`, `partner`,
`host` → `#/venue/time-cafe`, `#/bookings`, `#/list-venue`, `#/host`.
Auth is a `Profile` in `localStorage` under `scene044.profile`.

**There is no backend.** All data is seeded from
`src/components/bookingsData.ts` and held in React state. Treat it as a
prototype: if a task implies persistence, say so rather than faking it.

Key screens in `src/components/`: `Landing`, `VenueDetail` (largest —
booking request flow), `MyBookings`, `HostWorkspace`, `VenuePartner`,
`AuthModal`, `ReviewFlow`, `HostReviews`, `BookingConfirmation`, plus
primitives (`Carousel`, `Dialog`, `Dropdown`, `FieldError`).

Demo OTP is `123456`.

## House rules

- **Design tokens live in `src/index.css`** (`--color-ink`, `--color-flame`,
  `font-mono-b`, `shadow-hard`, `anim-pop`, …). Read it before inventing
  styles. Never hardcode hex values in JSX. Tailwind v4 via
  `@tailwindcss/vite` — there is no `tailwind.config.js` and none is needed.
- Visual style is neo-brutalist: cream canvas, near-black ink, hard offset
  shadows, thick `border-[1.5px]`/`[2.5px]` outlines, orange accent,
  monospace eyebrow labels.
- Use double quotes for strings containing apostrophes (`"We're here"`).

## Motion rules (important)

Every animation **must** have a `prefers-reduced-motion: reduce` override —
the existing ones all do, in `src/index.css`. Two specific traps:

- **Stroke-draw icons** (`.trust-icon` in the trust section) animate
  `stroke-dashoffset`. Under reduced motion you must also reset
  `stroke-dasharray: none` and `stroke-dashoffset: 0`, or the icons stay
  **permanently invisible** instead of merely static.
- **`--len` values are per-path and tuned to real SVG path lengths.** Too
  large and the stroke snaps visible immediately; too small and it breaks
  into repeating dashes. Don't normalise them to one value.

Shared motion vocabulary: a completed leg is solid, an in-progress leg is
dashed with a travelling dot (`.rf-dash` / `.rf-signal`). This is used both
in `RequestFlight` (the live 48-hour tracker in My bookings) and in the
landing page's How-it-works trail, deliberately, so the marketing promise
and the real product state look the same. Keep them in sync.

`RequestFlight` is driven by a real `sentAt` timestamp and is **honest by
design** — it says the request is *with* the host, never that the host is
reading it, because there is no backend signal for that. Don't "improve" it
into fake live activity. It has an overdue state past 48h.

## Known outstanding work

- **Tap targets below WCAG 2.2 AA (2.5.8, 24×24 min):** footer links are
  16px tall, hero carousel dots 6px. Fixing needs spacing/design decisions.
- **Asset weight:** ~162MB of images, 29 of them byte-identical duplicates
  across `src/assets`, `src/assets/spaces/assets` and `public/assets`.
  Worth deduping before this branch is merged.
- Audited and working as of the last pass: form validation across auth,
  booking and review; the full book→auth→confirm→bookings flow; and no
  horizontal scroll at 390×844 on any of the five views.
