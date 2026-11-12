"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  httpRegistrationApi,
  mockRegistrationApi,
  type RegistrationApi,
} from "@/lib/client/eventRegistration";
import { mergeHostedSeatStats } from "@/lib/client/hostedSeatStats";
import {
  seatSummary,
  type HostedEventDetail,
  type HostedEventInfo,
} from "@/lib/hostedEvents";

type SeatStats = {
  hosted: HostedEventInfo;
  live: boolean;
  api: RegistrationApi;
  refresh: () => Promise<void>;
};
const StatsContext = createContext<SeatStats | null>(null);

/** One server-backed snapshot shared by the hero, bookshelf and Reader pass. */
export function HostedSeatStatsProvider({
  event,
  api: kind,
  children,
}: {
  event: HostedEventDetail;
  api: "http" | "mock";
  children: ReactNode;
}) {
  const [hosted, setHosted] = useState(event.hosted);
  const [live, setLive] = useState(false);
  const mounted = useRef(false);
  const fetching = useRef(false);
  const queued = useRef(false);
  const api = useMemo(
    () =>
      kind === "mock"
        ? mockRegistrationApi({
            registeredCount: event.hosted.registeredCount,
            capacity: event.hosted.capacity,
          })
        : httpRegistrationApi(event.id),
    [kind, event.id, event.hosted.registeredCount, event.hosted.capacity],
  );
  const refresh = useCallback(async function refreshStats() {
    if (fetching.current) { queued.current = true; return; }
    fetching.current = true;
    try {
      const result = mergeHostedSeatStats(event.hosted, await api.getSeats());
      if (mounted.current) {
        if (result) setHosted(result);
        setLive(Boolean(result));
      }
    } catch {
      if (mounted.current) setLive(false);
    } finally {
      fetching.current = false;
      if (queued.current && mounted.current) {
        queued.current = false;
        void refreshStats();
      }
    }
  }, [api, event.hosted]);

  useEffect(() => {
    mounted.current = true;
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    const onStorage = (value: StorageEvent) => {
      if (value.key === `scene044:ticket:${event.id}`) void refresh();
    };
    const initial = setTimeout(() => {
      void refresh();
    }, 0);
    const interval = setInterval(onVisible, 30_000);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      mounted.current = false;
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [event.id, refresh]);

  return (
    <StatsContext.Provider value={{ hosted, live, api, refresh }}>
      {children}
    </StatsContext.Provider>
  );
}

export function useHostedSeatStats() {
  const value = useContext(StatsContext);
  if (!value) throw new Error("Hosted event stats need their provider.");
  return value;
}

/** Same badge/design as before, now subscribed to the real registration count. */
export function HostedSeatBadge({ event }: { event: HostedEventDetail }) {
  const { hosted } = useHostedSeatStats();
  const seat = seatSummary(hosted, event.endAt, undefined, event.status);
  return (
    <span
      aria-live="polite"
      aria-atomic="true"
      className={`px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${seat.state === "open" ? "bg-warn-ink" : seat.state === "sold_out" ? "bg-primary-ink" : "bg-background/20"}`}
    >
      {seat.state === "open" ? `${seat.spotsLeft} spots left` : seat.label}
    </span>
  );
}
