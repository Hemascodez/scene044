import timeCafe from '../assets/profile/e2cba.png'
import roastery from '../assets/profile/05ddf.png'
import tcTerrace from '../assets/venue/76a4b.png'
import tcFloor from '../assets/venue/c2a03.png'
import tcConversation from '../assets/venue/b9ace.png'
import hall from '../assets/237e9.png'
import brew from '../assets/249eb.png'
import salon from '../assets/5f65d.png'
import crowd from '../assets/27065.png'
import jam from '../assets/2010d.png'

export type Status = 'due' | 'confirmed' | 'sent' | 'completed' | 'declined' | 'withdrawn'

/** Hosts commit to answering a request inside this window. */
export const REVIEW_WINDOW_HOURS = 48
const HOUR = 3_600_000

export type Booking = {
  id: string
  status: Status
  eventType: string
  venue: string
  space: string
  img: string
  date: string
  time: string
  guests: string
  /** Epoch ms the request was sent. Drives the in-flight tracker for `sent`. */
  sentAt?: number
  amount?: string
  code?: string
  pin?: string
  note?: string
  reviewed?: boolean
}

export type Review = {
  id: string
  venue: string
  area: string
  img: string
  eventType: string
  rating: number
  when: string
  text: string
  photos?: string[]
  tags: string[]
  helpful: number
}

export type HostReview = { id: string; host: string; venue: string; rating: number; when: string; text: string; tags: string[] }

export const IMAGES = { timeCafe, roastery, hall, brew, salon, crowd, jam }

export const seedBookings: Booking[] = [
  {
    id: 'b1',
    status: 'due',
    eventType: 'Product launch',
    venue: 'Time Cafe & Spaces',
    space: 'Open terrace · BBQ table',
    img: tcTerrace,
    date: 'Sat, 11 Oct 2026',
    time: '17:00 · 4 hours',
    guests: '16 people',
    amount: '₹6,480',
  },
  {
    id: 'b2',
    status: 'confirmed',
    eventType: 'Design workshop',
    venue: 'Time Cafe & Spaces',
    space: 'First-floor event space',
    img: tcFloor,
    date: 'Tomorrow · 28 Sep 2026',
    time: '18:00 · 3 hours',
    guests: '22 people',
    code: 'TC-4468',
    pin: '7M4X21',
  },
  {
    id: 'b3',
    status: 'sent',
    eventType: 'Podcast recording',
    venue: 'Time Cafe & Spaces',
    space: 'Conversation table',
    img: tcConversation,
    date: 'Fri, 17 Oct 2026',
    time: '11:00 · 3 hours',
    guests: '4 people',
    // ~14h into the 48h window, so the demo opens mid-flight rather than at 0%.
    sentAt: Date.now() - 14 * HOUR,
  },
  {
    id: 'b4',
    status: 'completed',
    eventType: 'Tech meetup',
    venue: 'The Brew Room',
    space: 'Main floor',
    img: brew,
    date: 'Sat, 06 Sep 2026',
    time: '16:00 · 4 hours',
    guests: '40 people',
    amount: '₹9,200',
  },
  {
    id: 'b5',
    status: 'declined',
    eventType: 'Networking evening',
    venue: 'Salon 19',
    space: 'Garden lounge',
    img: salon,
    date: 'Thu, 02 Oct 2026',
    time: '19:00 · 3 hours',
    guests: '60 people',
    note: 'The garden lounge is already held for a private event that evening. The host suggested Fri, 03 Oct instead.',
  },
]

export const seedReviews: Review[] = [
  {
    id: 'r1',
    venue: 'Time Cafe and Spaces',
    area: 'Nungambakkam, Chennai',
    img: timeCafe,
    eventType: 'Tech Meetup',
    rating: 3,
    when: 'Just now',
    text: 'Amazing venue for tech meetups! The auditorium acoustics are superb and the seating is very comfortable. Solid fiber Wi-Fi over 300 Mbps during live code demos. Staff was helpful and the AV setup worked flawlessly throughout the event.',
    photos: [hall, crowd, jam],
    tags: ['Fast Wi-Fi & AV Rig', 'Superb Acoustics', 'On-Site Host Support', 'Seating Comfort'],
    helpful: 0,
  },
  {
    id: 'r2',
    venue: 'The Roastery Loft',
    area: 'T.Nagar, Chennai',
    img: roastery,
    eventType: 'Product Launch',
    rating: 3,
    when: '1 month ago',
    text: 'We hosted an intimate launch in the courtyard at dusk. The greenery did all the work — we barely needed decor. Power backup kicked in seamlessly when the street lost supply.',
    tags: ['Fast Wi-Fi & AV Rig', 'On-Site Host Support', 'Seating Comfort'],
    helpful: 5,
  },
  {
    id: 'r3',
    venue: 'The Brew Room',
    area: 'Mylapore, Chennai',
    img: brew,
    eventType: 'Podcast Recording',
    rating: 3,
    when: '4 months ago',
    text: 'The space worked really well for our podcast recording. The AV setup was smooth and the venue team was helpful throughout.',
    tags: ['Fast Wi-Fi & AV Rig', 'Superb Acoustics', 'Seating Comfort'],
    helpful: 8,
  },
]

export const hostReviews: HostReview[] = [
  {
    id: 'h1',
    host: 'Arjun · Time Cafe & Spaces',
    venue: 'Design workshop',
    rating: 5,
    when: '2 weeks ago',
    text: 'Priya shared a clear run-sheet two days ahead, arrived on time and left the floor exactly as she found it. Welcome back any time.',
    tags: ['Clear communication', 'On time', 'Left space tidy'],
  },
  {
    id: 'h2',
    host: 'Meera · The Brew Room',
    venue: 'Tech meetup',
    rating: 5,
    when: '3 weeks ago',
    text: 'Headcount matched the request and the group respected the noise limits after 9pm. Easy to work with.',
    tags: ['Accurate headcount', 'Respectful guests'],
  },
  {
    id: 'h3',
    host: 'Karthik · The Roastery Loft',
    venue: 'Product launch',
    rating: 4,
    when: '1 month ago',
    text: 'Great event. A small heads-up on extra AV needs earlier would have helped us prep, but everything went smoothly.',
    tags: ['Friendly', 'Paid on time'],
  },
]

export const REVIEW_TAGS = ['Fast Wi-Fi & AV Rig', 'Superb Acoustics', 'On-Site Host Support', 'Seating Comfort', 'Easy Parking', 'Great Natural Light']
