import type { CatalogVenue } from '@/lib/venueCatalog'
import {
  Accessibility, Check, Clock, Coffee, MapPin, Mic, Projector, Restroom, Scissors,
  Seating, ShieldCheck, Snowflake, Sparkle, Sun, Users, Volume, Wifi, Zap,
} from './icons'

/* "What this space offers" for venues other than Time Cafe.
 *
 * Time Cafe's list is hand-written design copy with its own icons, groups and
 * one-line details. Every other venue only has amenity strings a curator
 * typed, so this gives them the same shape — an icon that matches the item and
 * a few named groups — without inventing detail lines that nobody wrote. */

type Icon = (p: { className?: string; strokeWidth?: number }) => React.ReactElement
type Group = 'perform' | 'connected' | 'space' | 'support'

/** First match wins, so put the specific patterns above the general ones. */
const RULES: { re: RegExp; icon: Icon; group: Group }[] = [
  { re: /projector|screen|\btv\b|display|hdmi/i, icon: Projector, group: 'perform' },
  { re: /\bmics?\b|microphone/i, icon: Mic, group: 'perform' },
  { re: /sound|speaker|music system|audio|\bpa\b|bluetooth/i, icon: Volume, group: 'perform' },
  { re: /wi-?fi|internet|broadband|leased line/i, icon: Wifi, group: 'connected' },
  { re: /power|charging|charg|socket|outlet|generator|\bups\b/i, icon: Zap, group: 'connected' },
  { re: /coffee|caf[eé]|food|beverage|barista|kitchen|snack|tea|water|refreshment/i, icon: Coffee, group: 'connected' },
  { re: /air[- ]?condition|\bac\b|cooling|fan/i, icon: Snowflake, group: 'connected' },
  { re: /natural(ly)? (light|lit)|sunlit|daylight|window|skylight|garden|terrace|open[- ]air/i, icon: Sun, group: 'space' },
  { re: /seat|chair|table|desk|furnitur|mat(s)?\b|cushion/i, icon: Seating, group: 'space' },
  { re: /interior|ambien|decor|calm|quiet|aesthetic|plant|greener/i, icon: Sparkle, group: 'space' },
  { re: /lift|elevator|ramp|accessib|wheelchair|step[- ]free/i, icon: Accessibility, group: 'support' },
  { re: /restroom|washroom|toilet|changing/i, icon: Restroom, group: 'support' },
  { re: /parking|valet|car\b|two[- ]wheeler/i, icon: MapPin, group: 'support' },
  { re: /staff|reception|technician|support|host|waiting|concierge|assist|team/i, icon: Users, group: 'support' },
  { re: /security|cctv|backup|safe|first aid|sanitis|clean/i, icon: ShieldCheck, group: 'support' },
  { re: /prop|supplies|equipment|stationery|whiteboard|craft/i, icon: Scissors, group: 'space' },
  { re: /hour|timing|flexible|slot/i, icon: Clock, group: 'support' },
]

const GROUPS: { key: Group; g: string; n: string }[] = [
  { key: 'perform', g: 'Present & perform', n: 'Screen, sound and stage' },
  { key: 'connected', g: 'Stay connected & fed', n: 'Power, network and refreshments' },
  { key: 'space', g: 'The space itself', n: 'Light, seating and setup' },
  { key: 'support', g: 'Support on the day', n: 'People and practicalities' },
]

/** Curators type amenities inconsistently ("calming interiors"), so show them
 *  sentence-cased unless the entry already starts with a capital or a digit. */
function tidy(text: string) {
  const t = text.trim()
  return /^[a-z]/.test(t) ? t[0].toUpperCase() + t.slice(1) : t
}

/** Venue-level amenities, falling back to the rooms' own lists — some venues
 *  record everything on the room (Chennai Yoga Studio). */
export function venueAmenityList(venue: CatalogVenue): string[] {
  const source = venue.amenities.length
    ? venue.amenities
    : venue.spaces.flatMap((space) => space.amenities)
  const seen = new Map<string, string>()
  for (const item of source) {
    const text = tidy(item)
    if (text) seen.set(text.toLowerCase(), text)
  }
  return [...seen.values()]
}

export interface AmenityGroup {
  g: string
  n: string
  cols: string
  items: { I: Icon; t: string; d: string }[]
}

/** Grouped amenities in Time Cafe's shape; empty groups are dropped so the
 *  numbered badges stay sequential. */
export function venueAmenityGroups(venue: CatalogVenue): AmenityGroup[] {
  const items = venueAmenityList(venue).map((t) => {
    const rule = RULES.find((r) => r.re.test(t))
    return { I: rule?.icon ?? Check, t, d: '', group: rule?.group ?? 'support' }
  })
  return GROUPS.flatMap(({ key, g, n }) => {
    const members = items.filter((i) => i.group === key)
    if (!members.length) return []
    // One column count for every group, so cards stay the same size down the
    // section rather than a lone item stretching the full width.
    return [{ g, n, cols: 'sm:grid-cols-3', items: members.map(({ I, t, d }) => ({ I, t, d })) }]
  })
}
