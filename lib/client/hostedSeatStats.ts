import type { HostedEventInfo } from "@/lib/hostedEvents";

/** Never turn a failed or malformed poll into a fabricated zero or a fake join. */
export function mergeHostedSeatStats(
  hosted: HostedEventInfo,
  value: unknown,
): HostedEventInfo | null {
  if (!value || typeof value !== "object") return null;
  const { registeredCount, capacity } = value as {
    registeredCount?: unknown;
    capacity?: unknown;
  };
  if (
    !Number.isSafeInteger(registeredCount) ||
    !Number.isSafeInteger(capacity) ||
    Number(registeredCount) < 0 ||
    Number(capacity) < 1
  )
    return null;
  return {
    ...hosted,
    registeredCount: Number(registeredCount),
    capacity: Number(capacity),
  };
}
