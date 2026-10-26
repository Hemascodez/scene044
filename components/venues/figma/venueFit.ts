import { VENUE_EVENT_TYPES, venueMaxGuests } from '@/lib/venues'
import type { CatalogVenue } from '@/lib/venueCatalog'

/* "How well it fits your event" scores, derived from what a venue's own page
 * lists — its rooms, capacity, amenities and descriptions — so every venue gets
 * one and every number can be traced back to the page.
 *
 * This replaces the hand-entered Time Cafe scores. It stays consistent with the
 * rule in components/venues/VenueScore.tsx (never show an invented number): each
 * row is a weighted checklist over listed facts, the row's note names the facts
 * that earned it and the most important one that is missing, and the panel says
 * how it is scored. Nothing here is guessed from photos or reviews. */

type Signal = { label: string; re: RegExp }

/** Facts a curator might list, matched flexibly because wording varies by venue
 *  ("Strong wifi", "High-speed Wi-Fi", "Air conditioned"). */
const SIGNALS = {
  wifi: { label: 'Wi-Fi', re: /wi-?fi|internet/i },
  projector: { label: 'Projector', re: /projector|screen\b|\btv\b|display/i },
  sound: { label: 'Sound system', re: /sound|speaker|\bpa\b|audio|music system/i },
  mic: { label: 'Microphone', re: /\bmic(rophone)?s?\b/i },
  power: { label: 'Power points', re: /power|charging|outlet|socket/i },
  food: { label: 'Café service', re: /food|caf[eé]|coffee|beverage|menu|kitchen|bbq|barista/i },
  flexible: { label: 'Flexible layout', re: /flexible|movea?ble|modular/i },
  quiet: { label: 'Quiet setting', re: /quiet|calm|private|intimate|conversation/i },
  recording: { label: 'Suited to recording', re: /podcast|recording|interview/i },
  light: { label: 'Natural light', re: /natural(ly)? (light|lit)|sunlit|daylight/i },
  outdoor: { label: 'Open-air space', re: /open[- ]air|terrace|courtyard|garden|outdoor|rooftop|under the sky/i },
  ac: { label: 'Air conditioning', re: /air[- ]?condition|\bac\b/i },
  wellness: { label: 'Studio floor', re: /yoga|wellness|meditation|\bmats?\b/i },
  restroom: { label: 'Washrooms', re: /restroom|washroom|toilet/i },
  openFloor: { label: 'Open floor', re: /studio|mirror|dance|\bhall\b|open floor|event floor/i },
  props: { label: 'Props & mats', re: /\bprops?\b|\bmats?\b|equipment|supplies|stationery/i },
  tables: { label: 'Work tables', re: /\btables?\b|\bdesks?\b/i },
  creative: { label: 'Art workshops welcomed', re: /art workshop|creative gathering|painting|drawing/i },
  pottery: { label: 'Pottery events welcomed', re: /pottery|ceramic|clay workshop/i },
  reading: { label: 'Book readings welcomed', re: /book reading|book club|literary/i },
  social: { label: 'Social gatherings welcomed', re: /social gathering|community meetup|community gathering/i },
  discussion: { label: 'Discussion groups welcomed', re: /discussion|conversation|book reading/i },
} satisfies Record<string, Signal>

type SignalKey = keyof typeof SIGNALS
/** A fact with its weight, or a capacity target that earns partial credit. */
type Criterion = { fact: SignalKey; weight: number } | { guests: number; weight: number }

const f = (fact: SignalKey, weight: number): Criterion => ({ fact, weight })
const cap = (guests: number, weight: number): Criterion => ({ guests, weight })

/** What each kind of event needs, most important first. */
const RUBRIC: Partial<Record<(typeof VENUE_EVENT_TYPES)[number], Criterion[]>> = {
  'Tech meetup': [f('wifi', 2), f('projector', 2), cap(25, 2), f('power', 1), f('food', 1), f('sound', 1)],
  Workshop: [f('projector', 2), f('wifi', 1.5), f('flexible', 1.5), f('power', 1.5), cap(15, 1.5), f('food', 1)],
  'Professional gathering': [cap(15, 2), f('food', 1.5), f('wifi', 1), f('ac', 1), f('quiet', 1), f('restroom', 0.5)],
  'Wellness session': [f('wellness', 3), f('quiet', 1.5), f('light', 1), f('ac', 1), cap(10, 1), f('restroom', 0.5)],
  'Art workshop': [f('creative', 3), f('light', 2), cap(12, 1.5), f('ac', 1), f('wifi', 0.5)],
  'Pottery workshop': [f('pottery', 3), f('tables', 2), cap(12, 1.5), f('ac', 1), f('restroom', 0.5)],
  'Book reading': [f('reading', 3), f('quiet', 2), cap(12, 1.5), f('ac', 1), f('sound', 0.5)],
  'Social gathering': [f('social', 3), cap(15, 2), f('ac', 1), f('sound', 1), f('restroom', 0.5)],
  'Discussion group': [f('discussion', 3), f('quiet', 2), cap(12, 1.5), f('ac', 1), f('wifi', 0.5)],
  'Dance class': [f('openFloor', 3), f('sound', 2), cap(15, 1.5), f('ac', 1), f('restroom', 0.5)],
  'Dance workshop': [f('openFloor', 3), f('sound', 2), cap(15, 1.5), f('ac', 1), f('restroom', 0.5)],
  // Theatre and acting want a clear floor to move on, quiet to be heard in,
  // and somewhere to keep props — not projectors or catering.
  'Theatre workshop': [f('openFloor', 3), f('quiet', 1.5), f('props', 1.5), cap(15, 1.5), f('restroom', 0.5), f('ac', 0.5)],
  'Acting workshop': [f('openFloor', 3), f('quiet', 2), f('props', 1), cap(12, 1.5), f('ac', 0.5), f('restroom', 0.5)],
  'Podcast recording': [f('quiet', 3), f('mic', 2), f('recording', 1.5), f('power', 1), f('ac', 0.5)],
  'Interview recording': [f('quiet', 3), f('mic', 2), f('recording', 1.5), f('power', 1), f('ac', 0.5)],
  Photoshoot: [f('light', 3), f('outdoor', 1.5), f('flexible', 1), f('power', 1), f('ac', 0.5)],
  'Videography / ad shoot': [f('light', 2), f('power', 2), f('quiet', 1.5), f('flexible', 1), f('ac', 0.5)],
  'Networking event': [cap(25, 2.5), f('food', 2), f('sound', 1), f('outdoor', 1), f('flexible', 1)],
  'Product launch': [cap(25, 2), f('projector', 1.5), f('sound', 1.5), f('mic', 1), f('food', 1), f('power', 0.5)],
}

export type FitRow = { name: string; score: number; note: string; bestMatch: boolean }
export type VenueFit = {
  source: 'catalog' | 'curator'
  overall: number
  verdict: 'Great fit' | 'Good fit' | 'Fair fit' | 'Limited fit'
  headline: string
  summary: string
  rows: FitRow[]
}

const ROWS = 5

/** Events that measure the same thing; only the best of each is shown. */
const FAMILIES: Record<string, string> = {
  'Book reading': 'conversation',
  'Discussion group': 'conversation',
  'Podcast recording': 'recording',
  'Interview recording': 'recording',
  'Dance class': 'movement',
  'Dance workshop': 'movement',
  'Theatre workshop': 'drama',
  'Acting workshop': 'drama',
  Photoshoot: 'shoot',
  'Videography / ad shoot': 'shoot',
}

// Show the uses the owner actually welcomes ahead of generic suggestions.
// This affects which five rows appear, never their evidence-based scores.
const DECLARED_USES: Partial<Record<(typeof VENUE_EVENT_TYPES)[number], RegExp>> = {
  'Tech meetup': /tech (?:gathering|event|meetup)/i,
  'Art workshop': /art (?:workshop|event)|painting|drawing/i,
  'Pottery workshop': /pottery|ceramic|clay workshop/i,
  'Book reading': /book reading|book club|literary/i,
  'Discussion group': /discussion group|discussion|conversation/i,
  'Social gathering': /social gathering|community meetup|community gathering/i,
  'Wellness session': /wellness session|yoga|meditation/i,
  'Dance class': /dance (?:class|rehearsal|workshop)/i,
  'Dance workshop': /dance (?:class|rehearsal|workshop)/i,
  'Theatre workshop': /theatre|theater/i,
  'Acting workshop': /acting/i,
  'Podcast recording': /podcast recording|podcast table|podcast desk/i,
  'Interview recording': /interview recording|film interviews|shoot interviews/i,
}

/** Everything the page says about the venue and its rooms, as one string. */
function corpus(venue: CatalogVenue) {
  return [
    venue.summary,
    ...venue.amenities,
    ...venue.spaces.flatMap((s) => [s.name, s.eyebrow, s.description, ...s.amenities]),
  ].join(' \n ')
}

export function venueFit(venue: CatalogVenue): VenueFit | null {
  if (!venue.spaces.length) return null
  // Explicit SCENE curator assessment supplied by the owner on 26 Oct 2026.
  // Keep this separate from the automatic checklist and from customer reviews;
  // a suitability score must not invent microphones, soundproofing or supplies.
  if (venue.slug === 'madras-adda') {
    const rows: FitRow[] = [
      { name:'Tech meetup',score:9,note:'SCENE assessment for small tech gatherings; Wi-Fi, projector and speakers are listed.',bestMatch:true },
      { name:'Art workshop',score:9,note:'SCENE assessment for art and pottery workshops; confirm work surfaces, materials and cleanup with the host.',bestMatch:true },
      { name:'Social gathering',score:9,note:'SCENE assessment for casual gatherings and discussions in a small-group setting.',bestMatch:false },
      { name:'Podcast & interview recording',score:9,note:'SCENE assessment for conversational podcasts and interview shoots; confirm ambient noise and recording equipment with the host.',bestMatch:false },
      { name:'Book reading',score:9,note:'SCENE assessment for book readings and small reading-group sessions.',bestMatch:false },
    ]
    return { source:'curator',overall:9,verdict:'Great fit',headline:'A strong fit for small creative and community events',
      summary:`SCENE’s suitability assessment · up to ${venueMaxGuests(venue) ?? 20} guests. Best for tech, arts, conversations and book readings; not recommended for dance workshops.`,rows }
  }
  const text = corpus(venue)
  const has = (k: SignalKey) => SIGNALS[k].re.test(text)
  const maxGuests = venueMaxGuests(venue) ?? 0

  const scored = VENUE_EVENT_TYPES.flatMap((name, order) => {
    const criteria = RUBRIC[name]
    if (!criteria) return []
    let earned = 0
    let total = 0
    const evidence: string[] = []
    const missing: string[] = []
    for (const c of criteria) {
      total += c.weight
      if ('fact' in c) {
        if (has(c.fact)) {
          earned += c.weight
          evidence.push(SIGNALS[c.fact].label)
        } else if (c.weight >= 1.5 && c.fact !== 'food') missing.push(SIGNALS[c.fact].label.toLowerCase())
      } else {
        earned += c.weight * Math.min(1, maxGuests / c.guests)
        if (maxGuests) evidence.push(`up to ${maxGuests} guests`)
      }
    }
    const shown = evidence.slice(0, 3)
    const note = [
      shown.length ? shown.join(', ').replace(/^./, (ch) => ch.toUpperCase()) : '',
      missing[0] ? `no ${missing[0]} listed` : '',
    ].filter(Boolean).join('; ')
    return [{ name, order, declared: DECLARED_USES[name]?.test(text) ?? false, score: Math.round((10 * earned) / total), note }]
  })

  const ranked = scored.sort((a, b) => Number(b.declared) - Number(a.declared) || b.score - a.score || a.order - b.order)
  const usedFamilies = new Set<string>()
  const top = ranked
    .filter((r) => {
      const family = FAMILIES[r.name]
      if (!family) return true
      if (usedFamilies.has(family)) return false
      usedFamilies.add(family)
      return true
    })
    .slice(0, ROWS)
  const best = Math.max(...top.map(row => row.score))
  const rows: FitRow[] = top.map((r) => ({
    name: r.name,
    score: r.score,
    note: r.note,
    // At most the two strongest, and only when they are genuinely strong.
    bestMatch: r.score >= 8 && r.score === best && top.filter((x) => x.score === best).indexOf(r) < 2,
  }))
  const overall = Math.round((rows.reduce((n, r) => n + r.score, 0) / rows.length) * 10) / 10
  const verdict = overall >= 8 ? 'Great fit' : overall >= 6.5 ? 'Good fit' : overall >= 5 ? 'Fair fit' : 'Limited fit'
  const headline = {
    'Great fit': 'Strong fit for your kind of event',
    'Good fit': 'A good fit for several kinds of event',
    'Fair fit': 'Works for some events — check the details',
    'Limited fit': 'Best for a narrow range of events',
  }[verdict]
  const spaces = venue.spaces.length
  const summary = `${spaces} bookable ${spaces === 1 ? 'space' : 'spaces'}${maxGuests ? `, up to ${maxGuests} guests` : ''}. Strongest for ${rows
    .slice(0, 2)
    .map((r) => r.name.toLowerCase())
    .join(' and ')}.`
  return { source:'catalog',overall, verdict, headline, summary, rows }
}
