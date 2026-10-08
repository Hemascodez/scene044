import { after } from 'next/server';
import { drainVenueNotifications, venueNotificationsEnabled } from '@/lib/venueNotifications';

export function scheduleVenueNotifications(): void {
  if (!venueNotificationsEnabled()) return;
  try { after(async () => {
    try { await drainVenueNotifications(); }
    catch (error) { console.error('Venue notifications deferred to worker', error instanceof Error ? error.name : 'Error'); }
  }); } catch { console.error('Venue notification wakeup unavailable; saved queue will be processed by worker.'); }
}
