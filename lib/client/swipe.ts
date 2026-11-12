/** How far the thumb must travel (share of the track) to count as a swipe. */
export const SWIPE_COMPLETE_AT = 0.85;
/** Movement below this (px, design scale) is a tap, which also completes. */
export const SWIPE_TAP_SLOP = 6;

/**
 * What releasing the swipe-to-pay thumb does. A tap completes too, so the
 * action never depends on dragging (WCAG 2.5.7 Dragging Movements).
 */
export function resolveSwipe({ dx, max }: { dx: number; max: number }): "complete" | "reset" {
  if (Math.abs(dx) < SWIPE_TAP_SLOP) return "complete";
  return dx >= max * SWIPE_COMPLETE_AT ? "complete" : "reset";
}
