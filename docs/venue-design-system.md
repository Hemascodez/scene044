# Venue design system

The venue surface (`/venues/**`, `/bookings`, `/host/**`) has its own look,
separate from the events pages: cream paper, 1.5px ink borders, square corners,
hard offset shadows, Montserrat / Space Mono / Work Sans.

It is scoped by the `.venue-surface` class that `VenueShell` applies, so none of
it reaches the events pages. Verified: the events home loads zero venue font
files and still renders in Arial.

## Where things live

| What | Where |
|---|---|
| Shadow tokens (`shadow-hard-sm`, `shadow-hard`, `shadow-hard-lg`) | `app/globals.css` → `@theme inline` |
| Venue fonts + press effect + the motion CSS | `app/globals.css` → `.venue-surface` and "Venue motion" |
| Buttons, kicker, status badge, `venueCard`, `venueInput`, `venueLabel` | `components/venues/VenueUi.tsx` |
| Fonts (imported once) | `components/venues/VenueShell.tsx` |
| Landing sections | `components/venues/landing/` |
| The 48-hour tracker | `components/venues/RequestFlight.tsx` |

## Things that look wrong but are deliberate

- **Fonts are `@fontsource`, not `next/font/google`.** `next/font/google` broke
  the Turbopack build (see `f9d82cc`). Fontsource has no build-time network step.
- **`.venue-surface .font-display` / `.font-mono` are re-pointed in plain CSS.**
  `--font-display` lives in an `inline` theme, so the utility carries a literal
  value and a custom-property override cannot reach it.
- **Inputs use an *unlayered* `font: inherit`; buttons use a `@layer base` one.**
  Unlayered on inputs keeps them at 16px, which stops iOS Safari zooming into a
  focused field. Buttons must be layered so `text-xs font-bold` can win;
  unlayered, it flattened every button to body type.
- **Primary buttons are white on `--color-primary`.** That is 3.56:1, below AA
  for small text, and matches what shipped before. Swapping the fill to
  `--color-primary-ink` (5.99:1) is a one-token change if you want AA.
- **Trust-icon `--len` values are measured**, not guessed. A value even 2 units
  short leaves the tail of the stroke undrawn. Re-measure with
  `getTotalLength()` if an icon path changes.
- **Reduced motion:** the stroke-draw icons need `stroke-dasharray: none;
  stroke-dashoffset: 0`, not just `animation: none`, or they stay invisible.

## The tracker only claims what is true

`RequestFlight` shows: sent → in the host's queue → awaiting decision → answer
appears here, plus the real 48-hour clock. It does **not** say "host notified"
or "host is viewing", because creating a booking sends the host nothing
(`POST /api/venue-bookings`) and nothing records that a host opened a request.
It has no "Withdraw" button because the organizer API has no cancel.

Nothing in the codebase ever moves a booking to `expired`, and there is no
reminder to the host at 48 hours. The tracker handles a `requested` booking past
48h honestly ("hasn't replied… nothing has been charged"). An auto-expire job
and a host reminder are the natural follow-ups.
