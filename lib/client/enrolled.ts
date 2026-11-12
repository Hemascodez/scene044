/**
 * Display logic for the Reader pass seat bar and the "Readers enrolled"
 * bookshelf (from the owner's designs). Pure, so it's tested without a browser.
 */

export type Segment = "filled" | "open";

/** One segment per seat, as in the Reader pass design's segmented bar. */
export function seatSegments({ booked, capacity }: { booked: number; capacity: number }): Segment[] {
  const seats = Math.max(0, capacity);
  const filled = Math.min(seats, Math.max(0, booked));
  return Array.from({ length: seats }, (_, i) => (i < filled ? "filled" : "open"));
}

export interface ShelfSlot {
  kind: "taken" | "you" | "open";
  /** Spine height in px (design scale); open slots are 104. */
  height: number;
  /** [spine colour, band colour] — empty for open slots. */
  colour: [string, string] | [];
}

/** The design's spine heights and SCENE-palette spine colours, cycled. */
const HEIGHTS = [104, 116, 96, 112, 100, 118, 92, 108, 114, 98, 110, 94, 116, 102];
const SPINES: [string, string][] = [
  ["#c41b09", "#ffd9b0"],
  ["#f4f2ea", "#c41b09"],
  ["#2a2524", "#ff6a55"],
  ["#9d1f18", "#f4f2ea"],
  ["#ff2d16", "#14130d"],
  ["#3a2f2c", "#f4f2ea"],
];

/** A spine per reader, the next free seat marked "you", the rest open. */
export function shelfSlots({ booked, capacity }: { booked: number; capacity: number }): ShelfSlot[] {
  const seats = Math.max(0, capacity);
  const taken = Math.min(seats, Math.max(0, booked));
  return Array.from({ length: seats }, (_, i): ShelfSlot => {
    if (i < taken) return { kind: "taken", height: HEIGHTS[i % HEIGHTS.length], colour: SPINES[(i * 5 + 2) % SPINES.length] };
    return { kind: i === taken ? "you" : "open", height: 104, colour: [] };
  });
}

/** How many readers joined between two real readings. Never negative, never on the first read. */
export function joinedSince(previous: number | null, next: number): number {
  if (previous === null) return 0;
  return Math.max(0, next - previous);
}

/** Which Readers enrolled design to show: first visitor, filling up, or full house. */
export function enrolledMode({ booked, capacity }: { booked: number; capacity: number }): "empty" | "filling" | "full" {
  if (capacity > 0 && booked >= capacity) return "full";
  return booked <= 0 ? "empty" : "filling";
}
