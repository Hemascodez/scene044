import { CATEGORIES, type Category } from "@/lib/types";

/**
 * Curator-facing groupings for the queue filters.
 *
 * Two independent axes: where a candidate came from, and what field it is
 * about. Both are derived rather than stored, so no backfill is needed and a
 * new platform simply falls into "other" until it is worth naming.
 */

export const SOURCE_TYPES = [
  "linkedin",
  "luma",
  "meetup",
  "eventbrite",
  "company",
  "community",
  "other",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  linkedin: "LinkedIn",
  luma: "Luma",
  meetup: "Meetup",
  eventbrite: "Eventbrite",
  company: "Company website",
  community: "University / community",
  other: "Other",
};

/** Domains matched by suffix, so subdomains group with their parent. */
const PLATFORM_DOMAINS: [SourceType, string[]][] = [
  ["linkedin", ["linkedin.com"]],
  ["luma", ["lu.ma", "luma.com"]],
  ["meetup", ["meetup.com"]],
  ["eventbrite", ["eventbrite.com", "eventbrite.co.uk", "eventbrite.com.au", "eventbrite.ca", "eventbrite.sg"]],
];

/** Signals a domain belongs to a university, chapter or volunteer community
 *  rather than a company marketing site. */
const COMMUNITY_MARKERS = [
  ".edu", ".ac.in", "iitm", "annauniv", "srmist", "vit.ac", "college", "university",
  "gdg.community.dev", "owasp.org", "chennaijs", "chennaipy", "hasgeek",
  "friends.figma.com", "umo.design", "ieee", "chapter", "meetups.", "community",
  "devfolio", "hackerearth", "konfhub", "dev.events", "ixdf.org",
];

export function classifySourceType(domain: string): SourceType {
  const host = domain.toLowerCase().replace(/^www\./, "");
  for (const [type, domains] of PLATFORM_DOMAINS) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return type;
  }
  if (COMMUNITY_MARKERS.some((marker) => host.includes(marker))) return "community";
  // Anything left with a real domain is somebody's own site. "other" is
  // reserved for things we could not parse at all.
  return host.includes(".") ? "company" : "other";
}

/**
 * Category filter options.
 *
 * These are the nine categories the pipeline actually assigns — deliberately
 * not an aspirational list, because a filter that can never match anything is
 * worse than no filter. Two labels from the brief are worth noting: its
 * "Development" is our `tech`, and it asked for "Career/Networking", which no
 * category maps to today; those events currently land in `startups` or `tech`.
 */
export const CATEGORY_FILTER_LABELS: Record<Category, string> = {
  ai: "AI",
  tech: "Development",
  design: "Design",
  marketing: "Marketing",
  cybersecurity: "Cybersecurity",
  data: "Data",
  product: "Product",
  startups: "Startups",
  finance: "Finance",
};

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
