export type Status = 'due' | 'confirmed' | 'sent' | 'completed' | 'declined' | 'withdrawn'

/** Hosts commit to answering a request inside this window. */
export const REVIEW_WINDOW_HOURS = 48

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
  /** Real booking: bearer token (pay / withdraw) and the check-in QR as SVG markup. */
  token?: string
  endsAt?: string | null
  qrSvg?: string
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


export const REVIEW_TAGS = ['Fast Wi-Fi & AV Rig', 'Superb Acoustics', 'On-Site Host Support', 'Seating Comfort', 'Easy Parking', 'Great Natural Light']
