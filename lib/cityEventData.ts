import { cache } from 'react';
import { getPublicEvents } from './events';
import { query } from './db';
import type { CityHubEvent } from './cityEvents';

/** Read-only public feed enrichment; ingestion and source city assignment
 * remain owned by their existing paths. Shared by metadata and page rendering. */
export const getCityHubEvents = cache(async (): Promise<CityHubEvent[]> => {
  const events = await getPublicEvents(null);
  if (!events.length) return [];
  const { rows } = await query<{ id: number; updatedAt: string; venueAddress: string | null }>(
    'SELECT id, updated_at AS "updatedAt", venue_address AS "venueAddress" FROM events WHERE id = ANY($1::int[])',
    [events.map(event => event.id)],
  );
  const facts = new Map(rows.map(row => [row.id, row]));
  return events.map(event => ({ ...event, ...facts.get(event.id) }));
});
