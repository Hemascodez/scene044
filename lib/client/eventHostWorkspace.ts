import { classifyLoadError, EventHostError, type EventHostApi, type HostEvent, type HostGuest, type MoneySummary } from './eventHostApi';

export function hostEventEnded(event: HostEvent, now = Date.now()): boolean {
  return Date.parse(event.endAt ?? event.startAt) <= now;
}

/** The current/nearest upcoming edition first; historical editions remain available. */
export function orderedHostEvents(events: HostEvent[], now = Date.now()): HostEvent[] {
  return [...events].sort((a, b) => {
    const aPast = hostEventEnded(a, now);
    const bPast = hostEventEnded(b, now);
    if (aPast !== bPast) return aPast ? 1 : -1;
    const difference = Date.parse(a.startAt) - Date.parse(b.startAt);
    return (aPast ? -difference : difference) || b.id - a.id;
  });
}

export type HostWorkspaceSnapshot = {
  load: 'loading' | 'ready' | 'signin' | 'not_approved' | 'error';
  loadMessage: string;
  pollError: string;
  events: HostEvent[];
  event: HostEvent | null;
  guests: HostGuest[];
  reminders: Awaited<ReturnType<EventHostApi['reminders']>> | null;
  money: MoneySummary | null;
  checkedAt: number;
};

/** One event-scoped snapshot. Late responses may never overwrite another edition. */
export function createHostWorkspace(api: EventHostApi, now = Date.now) {
  const initial: HostWorkspaceSnapshot = {
    load: 'loading', loadMessage: '', pollError: '', events: [], event: null,
    guests: [], reminders: null, money: null, checkedAt: 0,
  };
  let state = initial;
  let selectedId: number | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();
  function update(patch: Partial<HostWorkspaceSnapshot>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  }
  const emptyDetails = { guests: [], reminders: null, money: null };

  async function refresh() {
    const request = ++generation;
    try {
      const list = await api.listEvents();
      if (request !== generation) return;
      const checkedAt = now();
      const events = orderedHostEvents(list, checkedAt);
      const event = events.find(event => event.id === selectedId) ?? events[0] ?? null;
      if (!event) {
        update({ ...emptyDetails, events, event, load: 'not_approved', pollError: '', loadMessage: "This number isn't set up for an event yet." });
        return;
      }
      const changed = event.id !== state.event?.id;
      update({ events, event, checkedAt, ...(changed ? { ...emptyDetails, load: 'loading', pollError: '', loadMessage: '' } : {}) });
      const [guests, reminders] = await Promise.all([api.guests(event.id), api.reminders(event.id)]);
      if (request !== generation) return;
      update({ guests, reminders, load: 'ready', loadMessage: '', pollError: '' });
      // Payment-provider latency must not block check-in or the guest list.
      void api.money(event.id).then(money => {
        if (request === generation) update({ money });
      }).catch(() => {
        if (request === generation) update({ money: null });
      });
    } catch (error) {
      if (request !== generation) return;
      const status = error instanceof EventHostError ? error.status : 0;
      const message = error instanceof Error ? error.message : 'Could not load your event.';
      if (state.load === 'ready' && status !== 401 && status !== 403) {
        // Only retain the last good data for this SAME edition on a network error.
        update({ pollError: message });
      } else {
        update({ ...emptyDetails, load: classifyLoadError(status), loadMessage: message, pollError: '',
          ...(status === 401 || status === 403 ? { events: [], event: null } : {}) });
      }
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refresh,
    selectEvent(eventId: number) {
      const event = state.events.find(event => event.id === eventId);
      if (!event) return;
      selectedId = eventId;
      ++generation;
      // Clear immediately, before starting any request or displaying the new heading.
      update({ ...emptyDetails, event, load: 'loading', loadMessage: '', pollError: '' });
      void refresh();
    },
    invalidate() { ++generation; },
  };
}
