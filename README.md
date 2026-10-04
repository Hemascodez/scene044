# Scene044

Venue booking platform for Chennai event spaces — find a space that actually
fits your event, send one clear request, pay only after a host approves.

This repo holds two things:

| Folder | What it is | Stack |
|---|---|---|
| `src/` | The venue booking web app | Vite 8 + React 19 + Tailwind CSS v4 |
| `remotion/` | Motion graphics workspace for video assets | Remotion 4.0.532 |

See [AGENTS.md](./AGENTS.md) for the full architecture guide (screens, design
tokens, animation helpers, dependency constraints).

## Quickstart

```bash
npm install
npm run dev          # venue web app → http://localhost:5173
```

## Web app commands

```bash
npm run dev         # dev server with HMR
npm run build       # production build → dist/
npm run preview     # serve the production build
npm run typecheck   # TypeScript check over src/
```

## Motion graphics commands

```bash
npm run video:studio     # Remotion Studio: live preview + timeline
npm run video:render     # render SampleVideo → out/SampleVideo.mp4
npm run video:typecheck  # TypeScript check over remotion/
npm run video:upgrade    # upgrade remotion + @remotion/* together

# render / still any composition by id
npx remotion render remotion/index.ts <composition-id> out/<name>.mp4
npx remotion still  remotion/index.ts <composition-id> out/frame.png
```

## App structure

```
src/
  App.tsx            # Hash router: home / venue / bookings / partner / host
  components/         # Landing, VenueDetail, MyBookings, HostWorkspace, AuthModal, …
  index.css           # Tailwind v4 theme + design tokens (shadow-hard, ink, anim-pop)
  assets/             # Venue photography, gallery and icon art
remotion/
  config.ts           # 1920×1080 @ 30fps defaults + color tokens
  Root.tsx            # Composition registry
  compositions/       # SampleVideo.tsx (3-scene demo with transitions)
  components/         # AnimatedText, AnimatedShape, Scene, AudioTrack
  utils/animations.ts # spring/interpolate helpers
public/               # Static assets, audio, favicon
```

## Notes

- **No backend.** Bookings, reviews and auth are seeded mock data
  (`src/components/bookingsData.ts`) held in React state + `localStorage`.
- Source was imported from the Figma Make file *Venue Booking App Screens
  Final*; the Figma-specific Vite plugins were replaced with a standard
  Vite config so it builds and runs anywhere.
