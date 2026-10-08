import { drainVenueNotifications, queueVenueOverrunNotices, venueNotificationsEnabled } from '@/lib/venueNotifications';

declare global {
  var __venueNotificationTimer: ReturnType<typeof setInterval> | undefined;
  var __venueNotificationLastSweep: string | undefined;
}

/** Railway runs a persistent Node server. DB claims protect overlapping replicas. */
export function startVenueNotificationWorker(): void {
  if (!venueNotificationsEnabled() || globalThis.__venueNotificationTimer) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await queueVenueOverrunNotices(); await drainVenueNotifications(); globalThis.__venueNotificationLastSweep = new Date().toISOString(); }
    catch (error) { console.error('Venue notification worker failed', error instanceof Error ? error.name : 'Error'); }
    finally { running = false; }
  };
  globalThis.__venueNotificationTimer = setInterval(() => { void tick(); }, 60_000);
  globalThis.__venueNotificationTimer.unref();
  void tick();
  console.info('Venue notification worker started (60-second sweep)');
}
