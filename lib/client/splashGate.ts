/**
 * Decides whether the intro splash should play.
 *
 * The rule: play it on a genuine arrival or a reload of the home page, never
 * when the visitor is coming *back* to it. Three different things all count as
 * "coming back", and each needs its own signal:
 *
 *   1. In-app link navigation (wordmark, "Back to all events") — the document
 *      is never recreated, so a module-scope flag catches it.
 *   2. Browser Back/Forward — these pages are `force-dynamic`, which sends
 *      `Cache-Control: no-store` and therefore *disables the bfcache*. Back
 *      re-fetches the document and starts a fresh JS context, resetting the
 *      flag above. Only the Navigation Timing API can tell this apart from a
 *      real visit.
 *   3. Landing deep (e.g. /category/ai) and then going Home — the document was
 *      never served for "/", so arriving there is internal navigation.
 *
 * `SKIP_SPLASH_ATTRIBUTE` is set by an inline script in the document head
 * (see app/layout.tsx) rather than decided in React, because a back-navigation
 * still server-renders the splash into the HTML. Deciding it in a component
 * would mean either a hydration mismatch or a visible flash of the intro
 * before React could remove it. CSS keyed off the attribute hides it before
 * the first paint instead.
 */

const HOME_PATHNAME = "/";

export const SKIP_SPLASH_ATTRIBUTE = "data-skip-splash";

/** Runs in the document head, before any paint. Kept dependency-free and tiny
 *  because it blocks rendering. */
export const SKIP_SPLASH_INLINE_SCRIPT = `try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type==='back_forward'){document.documentElement.setAttribute('${SKIP_SPLASH_ATTRIBUTE}','1')}}catch(e){}`;

/** The path this document was served for — unaffected by later router pushes. */
const initialPathname = typeof window === "undefined" ? null : window.location.pathname;

let consumedInThisDocument = false;

/** True when the browser restored this page via Back/Forward. */
export function isBackForwardNavigation(): boolean {
  if (typeof window === "undefined") return false;
  if (document.documentElement.hasAttribute(SKIP_SPLASH_ATTRIBUTE)) return true;
  try {
    const entry = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return entry?.type === "back_forward";
  } catch {
    return false;
  }
}

/**
 * Pure read — safe in a `useState` initializer, including React's
 * double-invoked initializer under StrictMode.
 *
 * Deliberately does NOT consider back/forward: that's handled by the inline
 * script and the mount effect, so the server and the client's first render
 * agree and hydration stays clean.
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
