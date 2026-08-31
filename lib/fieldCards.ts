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
