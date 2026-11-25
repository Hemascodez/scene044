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

/** The design's spine heights, and spine colours from the poster's book stack, cycled. */
const HEIGHTS = [104, 116, 96, 112, 100, 118, 92, 108, 114, 98, 110, 94, 116, 102];
const SPINES: [string, string][] = [
  ["#6f7a4e", "#e9d3a6"], // sage cloth, gold band
  ["#7c2f24", "#e3ad62"], // maroon
  ["#efe0c8", "#9a4f1f"], // cream paperback
  ["#9a4f1f", "#f6e8d6"], // cinnamon
  ["#3b2516", "#d9a45c"], // espresso
  ["#6f8796", "#f6e8d6"], // dusty blue, from the saucer
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
