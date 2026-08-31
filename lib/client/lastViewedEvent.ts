import { createStorageStore } from "@/lib/client/storage";

/**
 * Two related but distinct facts, deliberately stored separately:
 *
 *  - PENDING_KEY (sessionStorage): "they just left for a registration page and
 *    haven't been asked about it yet". One-shot — consumed by the return
 *    prompt so it fires exactly once per outbound click, and session-scoped
 *    because a prompt about a tab you opened yesterday is noise.
 *
 *  - lastViewedStore (localStorage): "the most recent event they opened",
 *    which keeps marking that card so they can find their place again.
 *    Persistent, never consumed, and exposed as a React external store so the
 *    badge updates without a setState-inside-an-effect round trip.
 */
const PENDING_KEY = "scene044:pendingReturn";

/** Below this, they almost certainly bounced straight back (mis-click, popup
 *  blocked) rather than actually looking at the registration page. */
const MIN_AWAY_MS = 3000;

interface PendingReturn {
  eventId: number;
  viewedAt: number;
}

export interface LastViewedState {
  version: 1;
  eventId: number | null;
}

export const lastViewedStore = createStorageStore<LastViewedState>("scene044:lastViewed", 1, {
  version: 1,
  eventId: null,
});

export function recordViewedEvent(eventId: number): void {
  if (typeof window === "undefined") return;
  try {
    const value: PendingReturn = { eventId, viewedAt: Date.now() };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable — the return prompt is best-effort, never blocking
  }
  lastViewedStore.write({ version: 1, eventId });
}

export function consumePendingViewedEvent(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as PendingReturn;
    window.sessionStorage.removeItem(PENDING_KEY);
    if (Date.now() - value.viewedAt < MIN_AWAY_MS) return null;
    return Number.isInteger(value.eventId) ? value.eventId : null;
  } catch {
    return null;
  }
}
