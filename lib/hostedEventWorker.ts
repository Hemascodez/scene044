import { query } from "@/lib/db";
import { recoverEventRegistration } from "@/lib/eventRegistrations";
import {
  drainEventNotifications,
  eventNotificationsEnabled,
} from "@/lib/eventNotifications";

declare global {
  var __hostedEventTimer: ReturnType<typeof setInterval> | undefined;
}
export function startHostedEventWorker() {
  const reconcile =
    process.env.HOSTED_EVENT_PAYMENT_RECONCILIATION_ENABLED === "true";
  if (
    globalThis.__hostedEventTimer ||
    (!reconcile && !eventNotificationsEnabled())
  )
    return;
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      if (reconcile) {
        const { rows } = await query<{
          id: number;
          order_id: string;
        }>(`SELECT id,order_id FROM event_registrations
          WHERE status='pending' AND order_id IS NOT NULL AND created_at>now()-interval '7 days' ORDER BY updated_at LIMIT 20`);
        for (const r of rows) {
          try {
            await recoverEventRegistration(r);
          } catch {
            /* Retain pending; webhook/browser can retry safely. */
          }
        }
      }
      await drainEventNotifications();
    } catch (error) {
      console.error(
        "Hosted event worker deferred",
        error instanceof Error ? error.name : "Unknown",
      );
    } finally {
      busy = false;
    }
  };
  globalThis.__hostedEventTimer = setInterval(() => {
    void tick();
  }, 60_000);
  globalThis.__hostedEventTimer.unref();
  void tick();
}
