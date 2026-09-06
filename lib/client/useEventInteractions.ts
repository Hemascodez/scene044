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

  /*
   * The phone's Back button closes the detail modal.
   *
   * Without this, Back from an open event leaves the site entirely — on a
   * phone the modal fills the screen, so it reads as a page, and people
   * reasonably press Back expecting to return to the feed. Losing them to the
   * previous site at that moment is the most expensive possible exit.
   *
   * A history entry is pushed when the modal opens and popped when it closes,
   * so Back and the close button do the same thing.
   */
  const openEventModal = useCallback((id: number | null) => {
    setOpenId((current) => {
      if (id !== null && current === null) {
        window.history.pushState({ sceneModal: true }, "");
      } else if (id === null && current !== null && window.history.state?.sceneModal) {
        window.history.back();
      }
      return id;
    });
  }, []);

  useEffect(() => {
    if (openId === null) return;
    // Fires for the pushed entry AND for a real Back — either way the modal
    // should close, and setOpenId here avoids re-entering history.
    const onPop = () => setOpenId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [openId]);

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
    setOpenId: openEventModal,
    openEvent: byId(openId),
    lastViewedId,
    handleVisit,
    returnEvent: byId(returnPromptId),
    dismissReturnPrompt: useCallback(() => setReturnPromptId(null), []),
  };
}
