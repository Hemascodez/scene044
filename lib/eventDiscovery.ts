import type { PublicEvent } from '@/lib/events';
import type { Category } from '@/lib/types';
import { classifyDateBucket, formatSceneDateLong, getISTParts } from '@/lib/client/istTime';
import { byPromotedThenSoonest, isHiddenFromFeed } from '@/lib/client/sceneEvent';

export const EVENTS_SEARCH_TITLE = 'Events in Chennai This Week | Meetups & Workshops — SCENE/044';
export const EVENTS_SEARCH_DESCRIPTION = 'Find events in Chennai this week: tech and AI meetups, startup networking, design workshops and finance events. Check dates, venues and registration links.';

export interface EventCollection {
  key: string;
  title: string;
  label: string;
  description: string;
  period: 'week' | 'weekend' | 'today' | 'upcoming';
  categories?: readonly Category[];
  freeOnly?: boolean;
}

// A small, useful set of permanent destinations, not an indexable URL for
// every possible search/filter combination. They refresh from the live feed.
export const EVENT_COLLECTIONS: readonly EventCollection[] = [
  {
    key: 'this-week', label: 'Events this week', title: 'Events in Chennai This Week', period: 'week',
    description: 'Explore Chennai events over the next seven days: tech meetups, AI sessions, founder networking, design workshops and more. Dates and times are in IST; registration stays with the original organiser.',
  },
  {
    key: 'this-weekend', label: 'Events this weekend', title: 'Events in Chennai This Weekend', period: 'weekend',
    description: 'Plan your Chennai weekend with upcoming Saturday and Sunday meetups, workshops and community events. Compare the published dates, venues and prices, then open the original registration page.',
  },
  {
    key: 'today', label: 'Events today', title: 'Events in Chennai Today', period: 'today',
    description: 'See Chennai events happening today, from developer and AI meetups to business and design sessions. Times are shown in IST. Check the organiser’s page for the latest registration and entry details.',
  },
  {
    key: 'free', label: 'Free events', title: 'Free Events in Chennai', period: 'upcoming', freeOnly: true,
    description: 'Discover upcoming free events in Chennai, including professional meetups, community sessions and workshops. Only events explicitly listed as free by the source appear here; registration may still be required.',
  },
  {
    key: 'tech-this-week', label: 'Tech events this week', title: 'Tech Events in Chennai This Week', period: 'week',
    categories: ['tech', 'ai', 'data', 'cybersecurity'],
    description: 'Find this week’s Chennai tech events: developer meetups, AI and machine learning sessions, cloud workshops and cybersecurity gatherings. Explore the next seven days and register with the original organiser.',
  },
  {
    key: 'finance-this-week', label: 'Finance events this week', title: 'Finance Events in Chennai This Week', period: 'week', categories: ['finance'],
    description: 'Browse finance and fintech events in Chennai over the next seven days. Find published dates, locations and entry details for upcoming community sessions, workshops and networking events.',
  },
];

export function eventCollectionPath(collection: Pick<EventCollection, 'key'>): string {
  return `/events/chennai/${collection.key}`;
}

export function getEventCollection(key: string): EventCollection | undefined {
  return EVENT_COLLECTIONS.find(collection => collection.key === key);
}

export function eventsForCollection(events: readonly PublicEvent[], collection: EventCollection, now: Date): PublicEvent[] {
  const today = getISTParts(now);
  // On Sunday, this weekend includes today, not the following Saturday.
  const saturdayOffset = today.weekday === 0 ? -1 : 6 - today.weekday;
  const dayMs = 24 * 60 * 60 * 1000;
  const midnight = Date.UTC(today.year, today.month - 1, today.day) - 5.5 * 60 * 60 * 1000;
  const weekendStart = midnight + saturdayOffset * dayMs;

  return events.filter(event => {
    if (isHiddenFromFeed(event, now)) return false;
    if (collection.categories && !collection.categories.includes(event.category)) return false;
    if (collection.freeOnly && event.priceType !== 'free') return false;
    // A published end time is stronger evidence than the date-only feed rule.
    if (event.endAt && Date.parse(event.endAt) <= now.getTime()) return false;
    if (collection.period === 'upcoming') return true;
    if (!event.startAt || !Number.isFinite(Date.parse(event.startAt))) return false;
    const bucket = classifyDateBucket(event.startAt, now);
    if (collection.period === 'today') return bucket === 'today';
    if (collection.period === 'week') return ['today', 'this_week', 'this_weekend'].includes(bucket);
    const start = Date.parse(event.startAt);
    return start >= Math.max(midnight, weekendStart) && start < weekendStart + 2 * dayMs;
  }).sort(byPromotedThenSoonest);
}

export function eventCollectionDateNote(collection: EventCollection, now: Date): string {
  const today = formatSceneDateLong(now.toISOString());
  if (collection.period === 'today') return `${today} · IST`;
  if (collection.period === 'week') {
    const lastDay = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
    return `${today} – ${formatSceneDateLong(lastDay.toISOString())} · IST`;
  }
  return collection.period === 'weekend' ? 'Saturday & Sunday · IST' : 'Upcoming · IST';
}
