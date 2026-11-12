'use client'

import { useState } from 'react'
import MyBookings from './MyBookings'
import type { Booking, Review } from './bookingsData'
import type { MyEventTicket } from '@/lib/client/myEventTickets'
import { CHAPTER_LOUNGE_FIXTURE } from '@/lib/hostedEvents'

/** Dev preview only: My bookings for a sample guest holding the Chapter Lounge ticket. */
const PROFILE = { name: 'Asha Raman', phone: '+919876543210', role: 'Organiser' as const, email: 'asha@example.com' }

const TICKETS: MyEventTicket[] = [
  {
    eventId: CHAPTER_LOUNGE_FIXTURE.id,
    slug: 'lets-do-more-reading-9044',
    title: CHAPTER_LOUNGE_FIXTURE.title,
    posterImageUrl: CHAPTER_LOUNGE_FIXTURE.posterImageUrl,
    startAt: CHAPTER_LOUNGE_FIXTURE.startAt!,
    endAt: CHAPTER_LOUNGE_FIXTURE.endAt,
    venueName: CHAPTER_LOUNGE_FIXTURE.venueName,
    ticket: { code: 'SCN-READ-0101', name: 'Asha Raman', phoneMasked: '+91 ••••• 43210', status: 'confirmed', qrValue: 'mock-existing' },
    ticketToken: 'mock-existing',
  },
]

export default function DevMyBookings() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  return (
    <MyBookings
      profile={PROFILE}
      bookings={bookings}
      setBookings={(fn) => setBookings(fn)}
      reviews={reviews}
      setReviews={(fn) => setReviews(fn)}
      onSaveProfile={async () => {}}
      onAuth={() => {}}
      onExplore={() => {}}
      onHome={() => {}}
      onPay={async () => {}}
      onWithdrawBooking={async () => {}}
      onPublishReview={async () => {}}
      eventTickets={TICKETS}
    />
  )
}
