import type { Category } from "@/lib/types";

export interface FieldCard {
  key: string;
  label: string;
  description: string;
  categories: Category[];
  /**
   * A typographic mark, not an icon-font glyph. The design leans on plain
   * Unicode so there's no icon webfont to load and nothing that can render as
   * raw ligature text ("bookmark") if a font arrives late.
   */
  mark: string;
}

export const FIELD_CARDS: FieldCard[] = [
  { key: "ai", label: "AI & Machine Learning", description: "Models, agents, research and applied AI", categories: ["ai"], mark: "◐" },
  { key: "tech", label: "Software & Engineering", description: "Web, mobile, backend and developer communities", categories: ["tech"], mark: "⌘" },
  { key: "cybersecurity", label: "Cybersecurity", description: "AppSec, privacy, defence and security research", categories: ["cybersecurity"], mark: "⌬" },
  { key: "product-design", label: "Product & Design", description: "UX, product strategy and digital craft", categories: ["product", "design"], mark: "◇" },
  { key: "marketing", label: "Marketing & Growth", description: "Brand, content, community and distribution", categories: ["marketing"], mark: "↗" },
  { key: "startups", label: "Startups & Business", description: "Founders, funding, demos and new ventures", categories: ["startups"], mark: "▲" },
  { key: "data", label: "Data & Cloud", description: "Analytics, infrastructure and platform engineering", categories: ["data"], mark: "≋" },
  { key: "finance", label: "Finance & Fintech", description: "Payments, markets and financial technology", categories: ["finance"], mark: "₹" },
];

export function getFieldCardByKey(key: string): FieldCard | undefined {
  return FIELD_CARDS.find((c) => c.key === key);
}

/** Field card a given backend category belongs to (Product & Design covers two). */
export function getFieldCardForCategory(category: Category): FieldCard | undefined {
  return FIELD_CARDS.find((c) => c.categories.includes(category));
}

/**
 * Resolves a URL segment that may be one key ("ai") or several, comma-joined
 * ("ai,marketing"), into a single FieldCard-shaped view — a real card for one
 * key, or a synthetic combined one for several, so every consumer (metadata,
 * structured data, the events query) can keep working with one FieldCard
 * shape either way. Returns undefined only when NONE of the keys are real —
 * a mix of one valid and one bogus key still renders using the valid ones.
 */
export function getFieldCardForKeys(rawKey: string): FieldCard | undefined {
  // Next hands the dynamic segment back exactly as it appeared in the URL,
  // comma included or percent-encoded as "%2C" depending on how the link was
  // built — decode defensively rather than assuming either form.
  let decoded = rawKey;
  try {
    decoded = decodeURIComponent(rawKey);
  } catch {
    // malformed percent-encoding: fall back to the raw string
  }
  const requested = decoded.split(",").map((k) => k.trim()).filter(Boolean);
  const cards = FIELD_CARDS.filter((card) => requested.includes(card.key));
  if (cards.length === 0) return undefined;
  if (cards.length === 1) return cards[0];

  const categories = [...new Set(cards.flatMap((card) => card.categories))];
  return {
    key: cards.map((card) => card.key).join(","),
    label: combinedFieldLabel(cards),
    description: cards.map((card) => card.description).join(" · "),
    categories,
    mark: cards[0].mark,
  };
}

/**
 * The distinct field-card keys covering a set of categories, in FIELD_CARDS
 * order rather than input order — a subscriber's own category array has no
 * meaningful order, and this way the same set of interests always produces
 * the same URL regardless of how they were originally recorded.
 */
export function fieldCardKeysForCategories(categories: readonly Category[]): string[] {
  const keys = new Set<string>();
  for (const category of categories) {
    const card = getFieldCardForCategory(category);
    if (card) keys.add(card.key);
  }
  return FIELD_CARDS.filter((card) => keys.has(card.key)).map((card) => card.key);
}

/** URL for one or several field cards at once — /category/ai for one key,
 *  /category/ai,marketing for several. Unknown keys are dropped rather than
 *  producing a 404 for the whole page over one bad key. */
export function multiCategoryPath(keys: readonly string[]): string {
  const valid = keys.filter((key) => getFieldCardByKey(key));
  return `/category/${valid.join(",")}`;
}

/** "AI & Machine Learning", or "AI & Machine Learning, Marketing & Growth"
 *  for several — used wherever a single card's `label` doesn't cover a
 *  combined view (page titles, digest message body). */
export function combinedFieldLabel(cards: readonly FieldCard[]): string {
  return cards.map((card) => card.label).join(", ");
}
