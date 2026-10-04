# Scene044 — Agent Instructions

Scene044 is a **venue booking platform** (Chennai event spaces) plus a
**Remotion motion-graphics workspace** for producing video/motion assets.
Two apps, one repo, one `node_modules`.

```
src/        → the venue booking web app   (Vite + React 19 + Tailwind v4)
remotion/   → motion graphics workspace   (Remotion 4.0.532)
```

---

## Part 1 — The web app (`src/`)

Vite + React 19 + Tailwind CSS v4 (via `@tailwindcss/vite`, no tailwind.config
file — theme customisation lives in `src/index.css`). TypeScript, `@/*` alias
→ `src/*`. Built with `@vitejs/plugin-react-swc` (SWC, not Babel — see
"Dependency constraints" below before changing this).

### Routing / app shell
`src/App.tsx` is a hash-router. Views: `home`, `venue`, `bookings`, `partner`,
`host`, mapped to `#/venue/time-cafe`, `#/bookings`, `#/list-venue`, `#/host`.
Auth state is a `Profile` persisted in `localStorage` under `scene044.profile`
(also `scene044.photo`, `scene044.hostLogo`).

### Screens (`src/components/`)
| File | Role |
|---|---|
| `Landing.tsx` | Marketing home: hero carousel, search, how-it-works, venue index |
| `VenueDetail.tsx` | Venue page + booking request flow (largest file) |
| `MyBookings.tsx` | Guest's bookings list + review entry points |
| `HostWorkspace.tsx` | Host dashboard: requests, calendar, listings |
| `VenuePartner.tsx` | "List your venue" partner pitch page |
| `BookingConfirmation.tsx` | Post-request confirmation summary |
| `ReviewFlow.tsx` / `HostReviews.tsx` | Leaving + managing reviews |
| `AuthModal.tsx` | Sign in / sign up, role = Guest or Host |
| `ProfileCard.tsx`, `HowItWorks.tsx` | Supporting sections |
| `Carousel.tsx`, `Dialog.tsx`, `Dropdown.tsx`, `FieldError.tsx` | Primitives |
| `bookingsData.ts` | `seedBookings` / `seedReviews` mock data + types |
| `icons.tsx` | Inline SVG icon set |
| `useReveal.ts` | IntersectionObserver scroll-reveal hook |

**There is no backend.** All data is seeded from `bookingsData.ts` and held in
React state. Treat it as a prototype when asked to "save" anything.

### Design language
Neo-brutalist: cream canvas, near-black ink, hard offset shadows
(`shadow-hard`), thick `border-[2.5px]` outlines, orange accent, monospace
eyebrow labels, bold display headings. Utility classes and the custom theme
(`--color-ink`, `font-body-sb`, `shadow-hard`, `anim-pop`, etc.) are defined in
`src/index.css` — **read that file before inventing new styles**, and extend
the theme there rather than hardcoding hex values in JSX.

### Commands
```bash
npm run dev         # Vite dev server → http://localhost:5173
npm run build       # production build → dist/
npm run preview     # preview the production build
npm run typecheck   # tsc over src/
```

---

## Part 2 — Motion graphics (`remotion/`)

Remotion **4.0.532**. Entry point is `remotion/index.ts`; every composition is
registered in `remotion/Root.tsx`. Docs: https://www.remotion.dev/docs

```
remotion/
  config.ts                 # Resolution / fps / duration + color tokens
  Root.tsx                  # Registers every <Composition>
  index.ts                  # registerRoot() — do not edit
  compositions/SampleVideo.tsx   # 3-scene demo with transitions
  components/               # AnimatedText, AnimatedShape, Scene, AudioTrack
  utils/animations.ts       # springIn, fadeSlideIn, easeInterpolate, progressBetween
```

### Core concepts
- Animation is a pure function of `useCurrentFrame()`. No imperative timeline.
- `useVideoConfig()` → `{ width, height, fps, durationInFrames }`.
- `<Sequence from={N}>` shifts a child's frame 0 to parent frame `N`.
- `<TransitionSeries>` (`@remotion/transitions`) chains scenes with
  `<TransitionSeries.Transition presentation={fade()|slide()|wipe()} timing={linearTiming({durationInFrames})} />`.
- Prefer the helpers in `remotion/utils/animations.ts` over raw `interpolate`
  so motion stays consistent.

### Adding a composition
1. Create `remotion/compositions/YourName.tsx`.
2. Register it in `remotion/Root.tsx` with a unique `id`, pulling
   `width`/`height`/`fps` from `VIDEO_CONFIG` in `remotion/config.ts`.
3. If it's multi-scene, export a computed duration constant (see
   `SAMPLE_VIDEO_DURATION_IN_FRAMES`) so duration can't drift from content.

### Audio
Put files in `public/audio/`, then
`<AudioTrack src="music.mp3" volume={0.6} fadeInFrames={30} fadeOutFrames={30} durationInFrames={total} />`.
To sync to a beat: `frameOfEvent = Math.round(seconds * fps)`.

### Changing resolution / fps / duration
Edit `remotion/config.ts` (`VIDEO_CONFIG`). Per-composition length is the
`durationInFrames` in `Root.tsx`.

### Commands
```bash
npm run video:studio     # Remotion Studio (preview + timeline)
npm run video:render     # SampleVideo → out/SampleVideo.mp4
npm run video:typecheck  # tsc over remotion/
npm run video:upgrade    # bump remotion + @remotion/* together
npx remotion render remotion/index.ts <id> out/<name>.mp4    # render any composition
npx remotion still  remotion/index.ts <id> out/frame.png     # single frame
```

---

## Dependency constraints (read before touching package.json)

- **Keep `remotion` and all `@remotion/*` pinned to the same exact version**
  (`4.0.532`, no `^`). Use `npm run video:upgrade` to bump them together.
- **Use `@vitejs/plugin-react-swc`, not `@vitejs/plugin-react`.** The Babel
  version of the plugin pulls Babel 8, which conflicts with Babel 7 required by
  Remotion's `@svgr/*` chain in `@remotion/studio-server`. SWC avoids Babel
  entirely and resolves cleanly. Switching back will break `npm i`.
- `@types/react` and `@types/react-dom` must stay on the **same minor**
  (`19.2.7` / `19.2.7`) or npm peer resolution fails.
- The web app and the video workspace share one `node_modules` and one React
  install (19.2.3) — that's intentional, so motion work can import the app's
  components if needed.

## Conventions
- Shared visual logic → `src/components/`; animation math → `remotion/utils/`.
- Don't hardcode colors. Web: use the theme tokens in `src/index.css`.
  Video: use `COLORS` in `remotion/config.ts`.
- Use double quotes for strings containing apostrophes (`"We're here"`).
- Verify changes with `npm run typecheck` + `npm run build`; for video,
  `npm run video:typecheck` and a short
  `npx remotion render remotion/index.ts <id> out/check.mp4 --frames=0-29`.
