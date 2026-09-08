"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { PublicEvent } from "@/lib/events";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import {
  consumePendingViewedEvent,
  lastViewedStore,
} from "@/lib/client/lastViewedEvent";

/**
 * Shared behaviour for any surface that lists events: the shortlist and the
 * "did you register?" prompt after an outbound click. Event cards navigate to
 * permanent detail pages, so the home and category feeds share one route model.
 */
export function useEventInteractions(events: PublicEvent[]) {
  const { ids, toggle, has } = useSavedEvents();
  const [returnPromptId, setReturnPromptId] = useState<number | null>(null);

  // Read through the external store rather than an effect + setState: that
  // keeps the server snapshot defined (localStorage doesn't exist during SSR)
  // without the cascading re-render an effect would cause.
  const lastViewedId = useSyncExternalStore(
    lastViewedStore.subscribe,
    () => lastViewedStore.getSnapshot().eventId,
    () => lastViewedStore.getServerSnapshot().eventId,
  );

  // They opened a registration page and ask about it when they return.
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible") return;
      const pending = consumePendingViewedEvent();
      if (pending !== null) setReturnPromptId(pending);
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    /*
     * On touch devices the registration link navigates same-tab (see
     * usePointerType.ts), so "coming back" is a full reload via the browser's
     * Back button, not a visibility/focus transition on an already-running
     * page — this component mounts already visible, so neither listener ever
     * fires. Checking once on mount catches that path; consumePendingViewedEvent
     * is one-shot and MIN_AWAY_MS-gated, so this is a no-op otherwise.
     */
    onReturn();
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  const byId = useCallback(
    (id: number | null) => (id === null ? null : events.find((e) => e.id === id) ?? null),
    [events],
  );

  return {
    savedIds: ids,
    toggleSaved: toggle,
    isSaved: has,
    lastViewedId,
    returnEvent: byId(returnPromptId),
    dismissReturnPrompt: useCallback(() => setReturnPromptId(null), []),
  };
}
