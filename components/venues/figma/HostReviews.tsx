"use client";

import { useState } from 'react'
import type { VenueReview } from '@/lib/venueBookings'
import { ArrowRight, Star } from './icons'
import { chandruReviews } from '@/lib/venueTestimonials'
import { ChandruTestimonial } from './ChandruTestimonial'

export type ReviewsView = 'forYou' | 'yours'

/** Received reviews are published records, never prototype testimonials.
 * There is no persisted host-to-organiser review feed yet; do not invent one. */
export default function HostReviews({ view, reviews, loading, error, onRetry, onViewBookings, venueSlug = 'time-cafe' }: {
  view: ReviewsView; reviews: VenueReview[]; loading: boolean; error: string
  onRetry: () => void; onViewBookings: () => void
  venueSlug?: string
}) {
  const [sort, setSort] = useState('recent')
  const received = view === 'forYou'
  const genuine = venueSlug === 'time-cafe' ? chandruReviews(reviews) : reviews.filter(r => r.status === 'published')
  const sorted = [...genuine].sort((a, b) => sort === 'highest' ? b.rating - a.rating
    : sort === 'lowest' ? a.rating - b.rating : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const average = genuine.length ? (genuine.reduce((sum, r) => sum + r.rating, 0) / genuine.length).toFixed(1) : null
  return <div className="page-in mx-auto flex max-w-[1088px] flex-col gap-6 font-body">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="font-head text-2xl">{received ? 'How your space worked' : 'Reviews for organisers'}</h1>
        <p className="mt-1 text-sm text-stone">{received ? 'Feedback from organisers who have hosted at your venue.' : 'Reviews you have shared about organisers you have hosted.'}</p>
      </div>
      {received && genuine.length > 0 && <label className="font-mono-b text-xs">Sort reviews
        <select value={sort} onChange={e => setSort(e.target.value)} className="ml-2 min-h-11 border border-ink bg-white p-2">
          <option value="recent">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
        </select>
      </label>}
    </header>
    {received && loading ? <p role="status">Loading reviews…</p> : received && error ? <div role="alert" className="border border-danger bg-white p-5 text-danger">
      <p>{error}</p><button type="button" className="mt-3 min-h-11 underline" onClick={onRetry}>Retry</button>
    </div> : received && genuine.length > 0 ? <>
      <section aria-label="Rating summary" className="flex flex-wrap items-center gap-6 border-2 border-ink bg-white p-6">
        <div><p className="font-head text-4xl">{average} <span className="text-base">/ 5</span></p><p className="mt-2 text-sm text-stone">{genuine.length} published {genuine.length === 1 ? 'review' : 'reviews'}</p></div>
        <ul className="min-w-0 flex-1 space-y-2">{[5, 4, 3, 2, 1].map(rating => {
          const count = genuine.filter(r => r.rating === rating).length
          return <li key={rating} className="flex items-center gap-3 text-sm"><span className="w-12">{rating} star</span>
            <meter aria-label={`${rating} star reviews`} min={0} max={genuine.length} value={count} className="h-3 min-w-0 flex-1" /> <span>{count}</span></li>
        })}</ul>
      </section>
      {sorted.map(r => <article key={r.id} className="w-full min-w-0 max-w-96 self-start border-2 border-ink bg-white p-5 shadow-hard">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div><h2 className="font-head text-lg break-words">{r.organizerName || 'Organiser'}</h2>
            {r.eventType && <p className="mt-1 text-sm text-stone">Event: {r.eventType}</p>}
            <p className="mt-1 text-xs text-stone">{r.source === 'booking' ? 'Completed SCENE booking' : 'Curator-approved, self-reported experience'}</p>
          </div>
          <div><p aria-label={`Rated ${r.rating} out of 5`} className="flex gap-1">{[1,2,3,4,5].map(n => <Star key={n} className={`size-4 ${n <= r.rating ? 'fill-current text-primary-ink' : 'text-stone'}`} />)}</p>
            <time dateTime={new Date(r.createdAt).toISOString()} className="mt-2 block text-sm text-stone">{new Date(r.createdAt).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}</time>
          </div>
        </header>
        {r.comment && <p className="mt-5 whitespace-pre-wrap break-words text-base leading-relaxed">{r.comment}</p>}
        {r.tags.length > 0 && <ul aria-label="Review highlights" className="mt-5 flex flex-wrap gap-2">{r.tags.map(tag => <li key={tag} className="border border-ink bg-paper px-3 py-2 text-sm">{tag}</li>)}</ul>}
        {r.photoConsent && r.photoIds.length > 0 && <ul aria-label="Event photos" className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{r.photoIds.map(id => <li key={id}><a href={`/api/poster/${id}`} target="_blank" rel="noopener noreferrer"><img src={`/api/poster/${id}`} alt="Organiser-uploaded event photo" className="aspect-[4/3] w-full border border-ink object-cover" loading="lazy" /></a></li>)}</ul>}
      </article>)}
    </> : received && venueSlug === 'time-cafe' ? <ChandruTestimonial /> : <section className="border-2 border-ink bg-white px-6 py-16 text-center shadow-hard">
      <h2 className="font-head text-2xl">{received ? 'No published reviews yet' : 'You haven’t reviewed any organisers yet'}</h2>
      <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-stone">{received ? 'Published organiser reviews will appear here. Draft and unapproved reviews are not shown.' : 'Reviews received by your venue appear in Reviews for you. They are not reviews written by you.'}</p>
      <button type="button" onClick={onViewBookings} className="press mt-6 inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-primary-ink px-5 py-3 font-mono-b text-xs text-white shadow-hard-sm">View your bookings <ArrowRight /></button>
    </section>}
  </div>
}
