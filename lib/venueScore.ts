/**
 * "Will this venue work for my event?" — a suitability score against a
 * specific event brief, not a generic star rating.
 *
 * The score is honest by construction: a venue only gets credit for a
 * requirement when its curator-entered amenities actually say so. A
 * requirement nobody has confirmed is shown as unknown, never as absent —
 * this app has no way to prove a negative (a venue lacking wifi and a venue
 * nobody asked about wifi look identical in the data), so it never claims one.
 * That is also what makes the score self-improving: every "not confirmed yet"
 * is a concrete question the curator or a reviewer can go answer.
 */

export interface EventProfile {
  key: string;
  label: string;
  /** Confirming all of these is what earns "Good fit". */
  must: string[];
  /** Bonus credit; absence never lowers the band. */
  nice: string[];
}

interface Requirement {
  key: string;
  label: string;
  /** Lowercase substrings checked against the venue's amenity text. Kept short
   *  and generic ("wifi" rather than "strong wifi") so curator phrasing
   *  variance doesn't cause a false "not confirmed". */
  match: string[];
}

const REQUIREMENTS: Requirement[] = [
  { key: "wifi", label: "Strong Wi-Fi", match: ["wifi", "wi-fi"] },
  { key: "projector", label: "Projector / screen", match: ["projector", "screen", "tv"] },
  { key: "whiteboard", label: "Whiteboard", match: ["whiteboard", "white board"] },
  { key: "soundproofing", label: "Soundproofing", match: ["soundproof"] },
  { key: "quiet", label: "Quiet surroundings", match: ["quiet"] },
  { key: "recording-desk", label: "Recording desk", match: ["recording desk", "podcast desk"] },
  { key: "microphones", label: "Microphones", match: ["microphone", "mic "] },
  { key: "camera-setup", label: "Camera setup", match: ["camera"] },
  { key: "breakout", label: "Breakout space", match: ["breakout", "multiple rooms", "side room"] },
  { key: "desks", label: "Desks & seating for hands-on work", match: ["desk", "table"] },
  { key: "power", label: "Power sockets", match: ["power"] },
  { key: "stage", label: "Stage / focal point", match: ["stage", "focal point"] },
  { key: "livestream", label: "Livestreaming support", match: ["livestream", "live stream", "streaming"] },
  { key: "charging", label: "Charging points", match: ["charging"] },
  { key: "registration", label: "Registration area", match: ["registration", "reception"] },
];

const REQUIREMENT_BY_KEY = new Map(REQUIREMENTS.map((r) => [r.key, r]));

export const EVENT_PROFILES: EventProfile[] = [
  {
    key: "podcast",
    label: "Podcast recording",
    must: ["soundproofing", "quiet", "power"],
    nice: ["recording-desk", "microphones", "camera-setup"],
  },
  {
    key: "workshop",
    label: "Workshop",
    must: ["projector", "whiteboard", "power"],
    nice: ["desks", "breakout"],
  },
  {
    key: "tech-meetup",
    label: "Tech meetup",
    must: ["wifi", "projector", "power"],
    nice: ["stage", "livestream", "registration", "charging"],
  },
];

export function getEventProfile(key: string): EventProfile | undefined {
  return EVENT_PROFILES.find((p) => p.key === key);
}

export type RequirementState = "confirmed" | "unconfirmed";

export interface ScoredRequirement {
  key: string;
  label: string;
  state: RequirementState;
}

export type SuitabilityBand = "good-fit" | "workable" | "not-enough-confirmed";

export interface SuitabilityScore {
  profile: EventProfile;
  band: SuitabilityBand;
  must: ScoredRequirement[];
  nice: ScoredRequirement[];
  mustConfirmedCount: number;
  mustTotalCount: number;
}

interface HasAmenities {
  amenities: readonly string[];
  spaces?: readonly { amenities: readonly string[] }[];
}

/** Every amenity phrase the venue has recorded anywhere — its own list plus
 *  every space's — lowercased once for matching. */
function amenityText(venue: HasAmenities): string {
  const own = venue.amenities ?? [];
  const spaceAmenities = (venue.spaces ?? []).flatMap((s) => s.amenities ?? []);
  return [...own, ...spaceAmenities].join(" | ").toLowerCase();
}

function scoreRequirement(key: string, text: string): ScoredRequirement {
  const req = REQUIREMENT_BY_KEY.get(key);
  if (!req) return { key, label: key, state: "unconfirmed" };
  const state: RequirementState = req.match.some((m) => text.includes(m)) ? "confirmed" : "unconfirmed";
  return { key: req.key, label: req.label, state };
}

export function scoreVenueForProfile(venue: HasAmenities, profileKey: string): SuitabilityScore | null {
  const profile = getEventProfile(profileKey);
  if (!profile) return null;
  const text = amenityText(venue);
  const must = profile.must.map((key) => scoreRequirement(key, text));
  const nice = profile.nice.map((key) => scoreRequirement(key, text));
  const mustConfirmedCount = must.filter((r) => r.state === "confirmed").length;

  const band: SuitabilityBand =
    mustConfirmedCount === must.length
      ? "good-fit"
      : mustConfirmedCount > 0
        ? "workable"
        : "not-enough-confirmed";

  return { profile, band, must, nice, mustConfirmedCount, mustTotalCount: must.length };
}

export const SUITABILITY_BAND_COPY: Record<SuitabilityBand, { label: string; tone: "good" | "mid" | "low" }> = {
  "good-fit": { label: "Good fit", tone: "good" },
  workable: { label: "Workable, with gaps", tone: "mid" },
  "not-enough-confirmed": { label: "Not enough confirmed yet", tone: "low" },
};
