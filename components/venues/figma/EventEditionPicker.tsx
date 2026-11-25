import type { HostEvent } from '@/lib/client/eventHostApi';
import { hostEventEnded } from '@/lib/client/eventHostWorkspace';
import { formatSceneDateLong } from '@/lib/client/istTime';

export function EventEditionPicker({ events, event, disabled, onSelect, now }: {
  events: HostEvent[];
  event: HostEvent;
  disabled: boolean;
  onSelect: (id: number) => void;
  now: number;
}) {
  const upcoming = events.filter(item => !hostEventEnded(item, now));
  const past = events.filter(item => hostEventEnded(item, now));
  return (
    <div className="border-t border-line py-3">
      <label htmlFor="event-switcher" className="mb-1.5 block font-mono-b text-xs uppercase tracking-wide text-stone">Event edition</label>
      <select
        id="event-switcher"
        aria-describedby="event-edition-help"
        value={event.id}
        disabled={disabled}
        onChange={e => onSelect(Number(e.target.value))}
        className="min-h-11 w-full min-w-0 max-w-full border-[1.5px] border-ink bg-paper px-3 font-head text-base text-ink focus-visible:outline-2 focus-visible:outline-flame disabled:opacity-60 sm:w-auto"
      >
        {upcoming.length > 0 && <optgroup label="Upcoming / happening now">{upcoming.map(item => (
          <option key={item.id} value={item.id}>{formatSceneDateLong(item.startAt)} · {item.title}</option>
        ))}</optgroup>}
        {past.length > 0 && <optgroup label="Past events">{past.map(item => (
          <option key={item.id} value={item.id}>{formatSceneDateLong(item.startAt)} · {item.title}</option>
        ))}</optgroup>}
      </select>
      <p id="event-edition-help" className="mt-1.5 text-xs text-stone">
        {hostEventEnded(event, now) ? 'Past edition. ' : ''}Guest lists, reminders and payments are separate for each date.
      </p>
    </div>
  );
}
