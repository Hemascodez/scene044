/**
 * Decides whether the intro splash should play.
 *
 * The rule is "on a real page load of the home page, never on internal
 * navigation". Clicking the SCENE/044 wordmark or "Back to all events" is a
 * client-side route change: the document is never re-created, so replaying a
 * five-second intro there feels like the app restarted under you.
 *
 * Two facts are needed, and one alone is not enough:
 *
 *   1. `initialPathname` — the URL this *document* was served for, captured at
 *      module-evaluation time. If the document loaded at /category/ai, then any
 *      later arrival at "/" can only have come from the router.
 *   2. `consumedInThisDocument` — whether the home screen has already mounted
 *      here, which catches home → category → home (initial path is "/" both
 *      times, so the path check alone would replay the intro).
 *
 * Module scope is exactly the right lifetime: created when the bundle is
 * evaluated (once per document) and discarded on reload or hard navigation.
 * sessionStorage would survive a reload, which is the one case that *should*
 * replay; a URL flag would leak into shared links.
 */

const HOME_PATHNAME = "/";

/** The path this document was served for — not affected by later router pushes. */
const initialPathname = typeof window === "undefined" ? null : window.location.pathname;

let consumedInThisDocument = false;

/**
 * Pure read — safe in a `useState` initializer, including React's
 * double-invoked initializer under StrictMode, because it never mutates.
 *
 * Returns `true` during SSR so a genuine page load's server HTML includes the
 * splash and the client's first render matches it. Never mutating on the server
 * also means one request can't influence the next.
 */
export function shouldPlaySplash(): boolean {
  if (typeof window === "undefined") return true;
  if (consumedInThisDocument) return false;
  return initialPathname === HOME_PATHNAME;
}

/** Called from an effect once the home screen has mounted, so later mounts in
 *  the same document (client-side navigations) skip the intro. */
export function markSplashConsumed(): void {
  if (typeof window === "undefined") return;
  consumedInThisDocument = true;
}
