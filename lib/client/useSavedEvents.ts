"use client";

import { useCallback, useSyncExternalStore } from "react";
import { savedEventsStore } from "@/lib/client/savedEventsStore";

/**
 * localStorage-backed shortlist, exposed as a React external store.
 *
 * Deliberately not `useState` + an effect: the store is read through
 * `useSyncExternalStore` so the saved count in the header and the bookmark on
 * every card stay in sync with each other and across browser tabs, and so the
 * server render has a defined snapshot instead of touching localStorage during
 * SSR (which would throw).
 */
export function useSavedEvents() {
  const ids = useSyncExternalStore(
    savedEventsStore.subscribe,
    () => savedEventsStore.getSnapshot().ids,
    () => savedEventsStore.getServerSnapshot().ids,
  );

  // Reads the store rather than closing over `ids` so two toggles fired in the
  // same tick can't clobber each other with a stale array.
  const toggle = useCallback((id: number) => {
    const current = savedEventsStore.getSnapshot().ids;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    savedEventsStore.write({ version: 1, ids: next });
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  return { ids, toggle, has };
}
