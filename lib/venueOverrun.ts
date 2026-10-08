/** Scheduled-command compatibility: use the same queue as the live website. */
import { drainVenueNotifications, queueVenueOverrunNotices } from '@/lib/venueNotifications';

export async function runOverrunSweep() {
  const queued = await queueVenueOverrunNotices();
  const result = await drainVenueNotifications();
  return { queued, ...result, errors: result.failed || result.unknown ? ['Check venue_notifications for failed/unknown attempts.'] : [] };
}
