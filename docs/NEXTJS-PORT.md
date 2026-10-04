# Porting this prototype into the Next.js app

**Goal:** bring this branch's visual design and motion into the real
product on `main` (`chennai-events-mvp`, Next 16 App Router).

## Read this first: what this port actually is

`main` **already has the complete venue product** — DB-backed bookings,
Razorpay payments, WhatsApp OTP auth, QR check-in, and 16 components in
`components/venues/`. It is live.

So this is a **re-skin and motion port onto screens that already exist**,
not a rebuild and not a feature port. The prototype's value is its visual
design and its motion system. Its data layer, routing and auth are
throwaway scaffolding that exist only because the prototype had no backend.

> ⚠️ The two branches have **unrelated histories and different stacks**.
> Never merge or rebase them into each other. Port file by file, by hand.

## Screen mapping

| Prototype (`src/components/`) | Target on `main` |
|---|---|
| `Landing.tsx` | `app/venues/page.tsx` + `components/venues/VenueShell,VenueCard,VenueSearchBar` |
| `VenueDetail.tsx` | `components/venues/VenueDetail.tsx` + `VenueGallery`, `VenueScore` |
| booking form inside `VenueDetail` | `components/venues/BookingFlow.tsx` |
| `MyBookings.tsx` | `components/venues/BookingsClient.tsx` (`app/bookings/page.tsx`) |
| `HostWorkspace.tsx` | `components/venues/HostDashboard.tsx` (`app/host/page.tsx`) |
| `VenuePartner.tsx` | `components/venues/PartnerForm.tsx` (`app/venues/partner/`) |
| `ReviewFlow.tsx` / `HostReviews.tsx` | `components/venues/SelfReviewForm.tsx`, `VenueReviews.tsx` |
| `RequestFlight.tsx` | **new** — render inside `BookingsClient` (see below) |
| `HowItWorks.tsx`, trust section | sections of `app/venues/page.tsx` |

## 🎨 Token mapping — do NOT copy the prototype's tokens across

`main` already has a design-token system in `app/globals.css` under
`@theme inline`, including venue-specific tokens. Importing the
prototype's `src/index.css` tokens would create two competing palettes.
**Map onto the existing tokens instead:**

| Prototype | Use on `main` |
|---|---|
| `--color-paper` `#fcf9f2` | `--color-venue-paper` `#f7f5ee` |
| `--color-paper-2` | `--color-venue-card` `#fffef9` |
| `--color-ink` `#1c1c18` | `--color-foreground` `#14130d` (borders: `--color-border`) |
| `--color-flame` `#ff432a` | `--color-primary` `#ff2d16` |
| `--color-moss` `#137e55` | `--color-signal` `#0a8f4c` |
| `--color-muted` `#66625d` | `--color-muted-foreground` `#6b675a` |
| `--color-line` `#e6e0d2` | `--color-venue-line` |
| `--color-danger` `#c4210b` | `--color-primary-ink` `#c41b09` |

**Accessibility trap:** the `-ink` variants (`--color-primary-ink`,
`--color-signal-ink`, `--color-warn-ink`) exist specifically so **small
text** passes AA, and `globals.css` documents their contrast ratios. Use
the `-ink` variant for small text, labels and inline errors; use the base
colour only for fills and large text. The prototype's `FieldError` red
must land on `--color-primary-ink`, not `--color-primary`.

## 🔑 Status mapping — and the two gaps

The prototype invented its own status union. The real one is
`VenueBookingStatus` in `lib/venueBookings.ts`. Map:

| Prototype | Real |
|---|---|
| `sent` | `requested` |
| `due` | `approved` (approved, awaiting payment) |
| `confirmed` | `confirmed` |
| `completed` | `completed` |
| `declined` | `declined` |
| `withdrawn` | `cancelled` |

**The prototype has no equivalent for `checked_in` or `expired`.** Both
are real states in `ALLOWED_TRANSITIONS`. If you port the status map
verbatim they will render blank. Design them:

- `checked_in` — guest has arrived and the event is running.
- `expired` — the request timed out (`requested → expired` is an allowed
  transition). This is the tracker's overdue state.

## Porting `RequestFlight` (highest-value piece)

The 48-hour tracker maps onto real data cleanly:

- `sentAt` → `booking.createdAt` (already on `VenueBooking`)
- render **only** when `booking.status === "requested"`
- overdue branch → drive from `expired`, or from elapsed time past the
  response window while still `requested`
- it is **honest by design**: it says the request is *with* the host,
  never that the host is reading it. With a real backend you may now have
  genuine signals (host notified, host viewed) — if so, show them, but
  only where a real event backs them. Do not invent activity.

Keep the shared motion vocabulary: completed leg solid, in-progress leg
dashed with a travelling dot. It is used in both the tracker and the
landing page's How-it-works trail on purpose, so the marketing promise and
the real product state look the same.

## Motion: use `motion`, not raw CSS keyframes

`main` already depends on **`motion` (Framer Motion)** and uses it in 8
components, plus `lottie-react` via `components/ui/LottiePlayer.tsx`.
Translate the prototype's CSS-keyframe animations into `motion` to match
house style.

Two exceptions where plain CSS is simpler and should stay CSS:

- the **stroke-draw icons** (`stroke-dashoffset` on the trust section)
- the **dashed travelling signal** (`.rf-dash` / `.rf-signal`)

**Reduced motion is mandatory.** `globals.css` already has
`prefers-reduced-motion` blocks; extend them. For `motion`, use
`useReducedMotion()`. For the stroke-draw icons you must *also* reset
`stroke-dasharray: none; stroke-dashoffset: 0` — otherwise the icons are
**permanently invisible** instead of merely static.

Also port the mobile fix: the host workspace tab bar needs
`position: relative` alongside `overflow-x-auto`, or its scroll overflow
propagates and the whole document scrolls horizontally on mobile.

## Do NOT port

- `src/App.tsx` hash router — `main` has real App Router routes
- `src/components/bookingsData.ts` seed data — real DB in `lib/venueBookings.ts`
- `AuthModal.tsx`'s fake `123456` OTP — real WhatsApp OTP in `lib/whatsappOtp.ts`
- `localStorage` profile (`scene044.profile`) — real auth in `lib/auth.ts`
- the whole `remotion/` workspace — unrelated to the web app
- `vite.config.ts`, `index.html`, `@vitejs/plugin-react-swc` — Vite-only

## Suggested order

1. Token + status mapping (everything else depends on it)
2. `VenueDetail` + `VenueGallery` — highest traffic
3. `BookingFlow` — the form, including the inline validation copy, which
   is good and worth keeping verbatim
4. `BookingsClient` + **`RequestFlight`**
5. `HostDashboard` (remember the `relative` nav fix)
6. Landing page: How-it-works and trust sections
7. Reviews

## Verify on `main` after each step

```bash
npm run lint
npm run build
```

Then check at **390×844** that `document.scrollWidth === clientWidth` on
every venue route, and re-run with `prefers-reduced-motion` forced to
confirm nothing vanishes or keeps animating.
