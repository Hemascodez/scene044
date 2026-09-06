"use client";

/**
 * Whether this browser has already been through the alerts flow.
 *
 * We cannot know whether someone actually pressed send in WhatsApp — the
 * handoff leaves our page entirely and the only real confirmation is the
 * inbound message arriving on our side, which the browser never learns about.
 *
 * So this is deliberately NOT a claim that they are subscribed. It records one
 * thing only: they told us they were done, so stop showing the banner. Nothing
 * is written to the database, because a self-reported click is not the consent
 * Meta requires — that remains the message they send us.
 *
 * Consequence worth knowing: someone who taps through and never sends still
 * stops seeing the banner. Nagging a person who believes they already
 * subscribed is worse than quietly missing one signup.
 */

const KEY = "scene044:alertsDone";
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeAlertsOptIn(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires for other tabs, so a dismissal in one is respected in all.
  if (typeof window !== "undefined") window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    if (typeof window !== "undefined") window.removeEventListener("storage", onChange);
  };
}

export function getAlertsDone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    // Private mode or blocked storage — showing the banner is the safe default.
    return false;
  }
}

/** Server can't read localStorage; render the banner and let the client hide
 *  it on hydration if needed. */
export function getServerAlertsDone(): boolean {
  return false;
}

export function markAlertsDone(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* nothing to do — the banner simply shows again next visit */
  }
  notify();
}

export function clearAlertsDone(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  notify();
}
