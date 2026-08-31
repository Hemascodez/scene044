"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { PublicEvent } from "@/lib/events";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import {
  consumePendingViewedEvent,
  lastViewedStore,
  recordViewedEvent,
} from "@/lib/client/lastViewedEvent";

/**
 * Shared behaviour for any surface that lists events: the shortlist, which
 * detail modal is open, and the "did you register?" prompt after an outbound
 * click. Extracted so the home feed and the per-field pages can't drift apart.
 */
export function useEventInteractions(events: PublicEvent[]) {
  const { ids, toggle, has } = useSavedEvents();
  const [openId, setOpenId] = useState<number | null>(null);
  const [returnPromptId, setReturnPromptId] = useState<number | null>(null);

  // Read through the external store rather than an effect + setState: that
  // keeps the server snapshot defined (localStorage doesn't exist during SSR)
  // without the cascading re-render an effect would cause.
  const lastViewedId = useSyncExternalStore(
    lastViewedStore.subscribe,
    () => lastViewedStore.getSnapshot().eventId,
    () => lastViewedStore.getServerSnapshot().eventId,
  );

  // They opened a registration page in a new tab; ask about it when they return.
  useEffect(() => {
    function onReturn() {
      if (document.visibilityState !== "visible") return;
      const pending = consumePendingViewedEvent();
      if (pending !== null) setReturnPromptId(pending);
    }
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  const handleVisit = useCallback((event: PublicEvent) => {
    recordViewedEvent(event.id);
  }, []);

  const byId = useCallback(
    (id: number | null) => (id === null ? null : events.find((e) => e.id === id) ?? null),
    [events],
  );

  return {
    savedIds: ids,
    toggleSaved: toggle,
    isSaved: has,
    openId,
    setOpenId,
    openEvent: byId(openId),
    lastViewedId,
    handleVisit,
    returnEvent: byId(returnPromptId),
    dismissReturnPrompt: useCallback(() => setReturnPromptId(null), []),
  };
}
