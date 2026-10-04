import { useState } from 'react'

const A = '/assets/reviews'
const imgSortChevron = `${A}/d026a.svg`
const imgStarFull = `${A}/01bfb.svg`
const imgStarEmpty = `${A}/c9b54.svg`
const imgDivider = `${A}/4c388.svg`
const imgCardStar = `${A}/97cdb.svg`
const imgCardStarVector = `${A}/87753.svg`
const imgCheck = `${A}/6c07e.svg`
const imgQuote = `${A}/971d5.svg`
const imgArrowRight = `${A}/623be.svg`

export type ReviewsView = 'forYou' | 'yours'

type OrganiserReview = {
  id: string
  name: string
  role: string
  avatar: string
  avatarClass: string
  event: string
  eventWeight: 'regular' | 'semibold'
  attendees: number
  date: string
  title: string
  body: string
  worked: string[]
  photos: { src: string; alt: string }[]
  morePhotos: number
  helpful: number
}

const REVIEWS_FOR_YOU: OrganiserReview[] = [
  {
    id: 'r1',
    name: 'Priya Sharma',
    role: 'Tech Meetup Lead',
    avatar: `${A}/524d6.png`,
    avatarClass: 'absolute h-full left-[-41.76%] max-w-none top-0 w-[183.51%]',
    event: 'AI Founders Circle Meetup',
    eventWeight: 'regular',
    attendees: 45,
    date: 'Oct 11, 2025',
    title: '“Flawless tech setup & high-speed fiber for live demos”',
    body: 'Amazing experience hosting at the Time Cafe and Spaces. The auditorium acoustics are superb and the seating is genuinely comfortable for a 3-hour session. Solid fiber Wi-Fi over 300 Mbps held up perfectly during live multi-agent demos. Vikram and the venue AV tech were on-site 45 minutes before doors opened for sound checks, and everything ran seamlessly without a single hitch.',
    worked: ['Fast Wi-Fi (300+ Mbps)', 'Superb Acoustics', 'On-site Host Support', 'Seating Comfort'],
    photos: [
      { src: `${A}/6ecdd.png`, alt: 'Hall A auditorium crowd' },
      { src: `${A}/2aef1.png`, alt: 'Networking lounge' },
      { src: `${A}/69f2e.png`, alt: 'Stage presentation AV rig' },
    ],
    morePhotos: 3,
    helpful: 8,
  },
  {
    id: 'r2',
    name: 'Ranjith Kumar',
    role: 'Design Lead',
    avatar: `${A}/d5981.png`,
    avatarClass: 'absolute inset-0 max-w-none object-cover size-full',
    event: 'Figma community workshop',
    eventWeight: 'semibold',
    attendees: 30,
    date: 'Oct 11, 2025',
    title: '“Flawless tech setup & high-speed fiber for live demos”',
    body: 'Amazing experience hosting at the Time Cafe and Spaces. The auditorium acoustics are superb and the seating is genuinely comfortable for a 3-hour session. Solid fiber Wi-Fi over 300 Mbps held up perfectly during live multi-agent demos. Vikram and the venue AV tech were on-site 45 minutes before doors opened for sound checks, and everything ran seamlessly without a single hitch.',
    worked: ['Superb Acoustics', 'On-site Host Support', 'Seating Comfort'],
    photos: [],
    morePhotos: 0,
    helpful: 4,
  },
]

const DISTRIBUTION = [
  { stars: 5, count: 12 },
  { stars: 4, count: 4 },
  { stars: 3, count: 1 },
  { stars: 2, count: 1 },
  { stars: 1, count: 0 },
]

type HostReview = {
  id: string
  organiser: string
  avatar: string
  rating: number
  when: string
  body: string
  helpful: number
}

const YOUR_REVIEWS: HostReview[] = [
  {
    id: 'h1',
    organiser: 'Priya',
    avatar: `${A}/9863b.png`,
    rating: 3,
    when: 'a day ago',
    body: 'Priya was a fantastic organiser. She communicated all requirements clearly in advance, managed the guest list perfectly, and left the space spotless. One of our best bookings this year.',
    helpful: 5,
  },
]

function SortSelect({ id }: { id: string }) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        Sort reviews
      </label>
      <select
        id={id}
        defaultValue="recent"
        className="h-[44px] w-[136px] cursor-pointer appearance-none rounded-[4px] border border-[#111] bg-white pl-[13px] pr-[36px] font-['JetBrains_Mono:Bold'] text-[12px] font-bold leading-[16px] text-[#111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
      >
        <option value="recent">Most Recent</option>
        <option value="highest">Highest rated</option>
        <option value="lowest">Lowest rated</option>
      </select>
      <img
        src={imgSortChevron}
        alt=""
        width="17.2"
        height="17.6"
        className="pointer-events-none absolute right-[12px] top-1/2 -translate-y-1/2"
      />
    </div>
  )
}

function PageHeader({ title, sub, sortId }: { title: string; sub: string; sortId: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-[8px]">
      <div className="flex flex-col gap-[4px]">
        <h1 className="font-['Montserrat:Bold'] text-[24px] font-bold leading-[28px] tracking-[-0.5px] text-[#141414]">
          {title}
        </h1>
        <p className="font-['Work_Sans:Regular'] text-[14px] font-normal leading-[16px] text-[#66625d]">{sub}</p>
      </div>
      <SortSelect id={sortId} />
    </div>
  )
}

function EmptyState({ title, lines, onCta }: { title: string; lines: string[]; onCta: () => void }) {
  return (
    <div className="pt-[8px]">
      <section
        aria-labelledby="reviews-empty-title"
        className="flex flex-col items-center justify-center gap-[12px] rounded-[12px] border-2 border-[#141414] bg-white px-6 py-[66px] text-center drop-shadow-[4px_4px_0px_#121212] page-in"
      >
        <div className="flex size-[88px] items-center justify-center rounded-full border-2 border-[#141414] bg-[#faf7f0] drop-shadow-[0px_1px_1px_rgba(0,0,0,0.05)]">
          <img src={imgQuote} alt="" width="38" height="38" />
        </div>
        <div className="flex flex-col items-center gap-[8px]">
          <h2
            id="reviews-empty-title"
            className="font-['Montserrat:ExtraBold'] text-[26px] font-extrabold leading-[36px] tracking-[-0.75px] text-[#141414]"
          >
            {title}
          </h2>
          <p className="max-w-[640px] font-['Work_Sans:Regular'] text-[14px] font-normal leading-[22.75px] text-[#706e6b]">
            {lines.map((l, i) => (
              <span key={i} className="block">
                {l}
              </span>
            ))}
          </p>
        </div>
        <button
          type="button"
          onClick={onCta}
          className="press mt-[12px] flex items-center gap-[4px] rounded-[8px] border-2 border-[#111] bg-[#eb442c] px-[24px] py-[14px] drop-shadow-[4px_4px_0px_#121212] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111]"
        >
          <span className="font-['Space_Mono:Bold'] text-[12px] uppercase leading-[16px] tracking-[0.6px] text-white">
            View your bookings
          </span>
          <img src={imgArrowRight} alt="" width="16" height="16" />
        </button>
      </section>
    </div>
  )
}

function RatingSummary() {
  const total = DISTRIBUTION.reduce((s, d) => s + d.count, 0)
  return (
    <section
      aria-label="Rating summary"
      className="flex flex-col items-center gap-[24px] border-2 border-black bg-white p-[24px] drop-shadow-[0px_4px_8px_rgba(0,0,0,0.03)] sm:flex-row sm:gap-[32px]"
    >
      <div className="flex w-[180px] shrink-0 flex-col items-center gap-[8px]">
        <p className="font-['Inter:Extra_Bold'] text-[48px] font-extrabold leading-[normal] text-[#1a1b25]">4.7</p>
        <div className="flex items-center gap-[4px]" role="img" aria-label="Rated 4.7 out of 5">
          {[0, 1, 2, 3].map((i) => (
            <img key={i} src={imgStarFull} alt="" width="16" height="16" />
          ))}
          <img src={imgStarEmpty} alt="" width="16" height="16" />
        </div>
        <p className="font-['Inter:Medium'] text-[13px] font-medium leading-[normal] text-[#6b7280]">({total} reviews)</p>
      </div>
      <div className="hidden h-[80px] w-0 items-center justify-center sm:flex" aria-hidden="true">
        <img src={imgDivider} alt="" width="80" height="1" className="max-w-none rotate-90" />
      </div>
      <ul className="flex w-full flex-1 flex-col gap-[8px]">
        {DISTRIBUTION.map((d, index) => (
          <li key={d.stars} className="flex items-center gap-[12px]">
            <span className="w-[45px] font-['Inter:Semi_Bold'] text-[12px] font-semibold text-[#6b7280]">
              {d.stars} star
            </span>
            <div
              role="meter"
              aria-label={`${d.stars} star reviews`}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={d.count}
              className="h-[8px] flex-1 overflow-hidden rounded-[4px] bg-[#f7f8fa]"
            >
              <div
                className="bar-fill run h-[8px] rounded-[4px] bg-[#e8552e] motion-reduce:animate-none"
                style={{
                  width: `${(d.count / total) * 100}%`,
                  animationDelay: `${150 + index * 140}ms`,
                }}
              />
            </div>
            <span className="w-[24px] text-right font-['Inter:Medium'] text-[12px] font-medium text-[#9ca3af]">
              ({d.count})
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function OrganiserReviewCard({ r, onShare }: { r: OrganiserReview; onShare: (name: string) => void }) {
  return (
    <article
      aria-labelledby={`${r.id}-title`}
      className="flex flex-col gap-[16px] border-2 border-[#111] bg-white p-[20px] drop-shadow-[4px_4px_0px_#111] sm:p-[26px]"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(17,17,17,0.15)] pb-[17px]">
        <div className="flex items-start gap-[16px]">
          <div className="relative size-[56px] shrink-0 overflow-hidden rounded-full border-2 border-[#111] bg-[#fdf9f1] p-[2px]">
            <div className="relative size-full overflow-hidden rounded-full">
              <img src={r.avatar} alt="" className={r.avatarClass} />
            </div>
          </div>
          <div className="flex flex-col gap-[4px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <h3 className="font-['Hanken_Grotesk:Bold'] text-[16px] font-bold leading-[24px] text-[#111]">{r.name}</h3>
              <span className="font-['Montserrat:Medium'] text-[12px] font-medium leading-[16px] text-[#6e6b65]">
                · {r.role}
              </span>
              <span className="rounded-[4px] bg-[#ff3823] px-[8px] py-[2px] font-['Space_Mono:Bold'] text-[10px] leading-[15px] text-white">
                Worked well! 👍
              </span>
            </div>
            <p className="font-['Work_Sans:Medium'] text-[12px] font-medium leading-[16px] text-[#6e6b65]">
              Event:{' '}
              <span
                className={
                  r.eventWeight === 'regular'
                    ? "font-['Work_Sans:Regular'] font-normal text-[#111]"
                    : "font-['Work_Sans:SemiBold'] font-semibold"
                }
              >
                {r.event}
              </span>{' '}
              · {r.attendees} Attendees
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center" role="img" aria-label="Rated 5 out of 5">
            <img src={imgCardStar} alt="" width="16" height="16" />
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="relative ml-[2px] size-[16px]">
                <img
                  src={imgCardStarVector}
                  alt=""
                  width="11.8947"
                  height="11.3924"
                  className="absolute left-[12.83%] top-[11.18%]"
                />
              </span>
            ))}
          </div>
          <time className="pt-[4px] font-['JetBrains_Mono:Regular'] text-[12px] font-normal leading-[16px] text-[#6e6b65]">
            {r.date}
          </time>
        </div>
      </header>

      <div className="flex flex-col gap-[5.25px]">
        <h4 id={`${r.id}-title`} className="font-['Montserrat:Bold'] text-[16px] font-bold leading-[24px] text-[#111]">
          {r.title}
        </h4>
        <p className="max-w-[880px] font-['Hanken_Grotesk:Regular'] text-[14px] font-normal leading-[22.75px] text-[#111]">
          {r.body}
        </p>
      </div>

      <div className="flex flex-col gap-[8px] pt-[4px]">
        <p className="font-['JetBrains_Mono:Bold'] text-[12px] font-bold uppercase leading-[15px] tracking-[0.5px] text-[#ff432a]">
          What worked:
        </p>
        <ul className="flex flex-wrap items-center gap-[8px]">
          {r.worked.map((w) => (
            <li
              key={w}
              className="flex items-center gap-[4px] rounded-full border border-[#111] bg-[#fdf9f1] px-[11px] py-[5px]"
            >
              <img src={imgCheck} alt="" width="7.79883" height="8.07422" />
              <span className="font-['Space_Mono:Regular'] text-[12px] leading-[16.5px] text-[#111]">{w}</span>
            </li>
          ))}
        </ul>
      </div>

      {r.photos.length > 0 && (
        <ul className="flex items-center gap-[12px] overflow-x-auto pb-[4px] pt-[8px]" aria-label="Photos from the event">
          {r.photos.map((p) => (
            <li key={p.src} className="h-[80px] w-[112px] shrink-0 overflow-hidden rounded-[4px] border border-[#111] p-px">
              <div className="relative size-full overflow-hidden">
                <img src={p.src} alt={p.alt} className="absolute left-[-15.06%] top-0 h-full w-[130.13%] max-w-none" />
              </div>
            </li>
          ))}
          {r.morePhotos > 0 && (
            <li className="pl-[4px] font-['Space_Mono:Bold'] text-[12px] leading-[16px] text-[#6e6b65]">
              +{r.morePhotos} Photos
            </li>
          )}
        </ul>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(17,17,17,0.15)] pt-[13px]">
        <p className="font-['Work_Sans:Regular'] text-[12px] font-normal leading-[16px] text-[#494949]">
          Helpful to {r.helpful} potential organisers
        </p>
        <button
          type="button"
          onClick={() => onShare(r.name)}
          className="press min-h-[36px] border border-[#111] bg-white px-[13px] py-[9px] font-['Space_Mono:Bold'] text-[12px] leading-[16px] text-[#111] hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
        >
          Share Testimonial
        </button>
      </footer>
    </article>
  )
}

function HostReviewCard({ r, onToast }: { r: HostReview; onToast: (m: string) => void }) {
  return (
    <article className="flex flex-col gap-[16px] rounded-[12px] border-[1.5px] border-[#1c1c18] bg-white p-[20px] shadow-[4px_4px_0px_0px_#111,0px_4px_16px_0px_rgba(0,0,0,0.03)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-[12px]">
          <img src={r.avatar} alt="" className="size-[44px] rounded-[22px] object-cover" />
          <div className="flex flex-col gap-[2px] leading-[normal]">
            <h3 className="font-['Montserrat:Bold'] text-[16px] font-bold text-[#1a1b25]">Aisha Rao</h3>
            <p className="font-['Work_Sans:Medium'] text-[12px] font-medium text-[#6b7280]">Host at Time Cafe and Spaces</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-[4px]">
          <div className="flex items-center gap-[4px]" role="img" aria-label={`Rated ${r.rating} out of 5`}>
            {[1, 2, 3, 4, 5].map((i) => (
              <img key={i} src={i <= r.rating ? imgStarFull : imgStarEmpty} alt="" width="16" height="16" />
            ))}
          </div>
          <p className="font-['Montserrat:Medium'] text-[12px] font-medium leading-[normal] text-[#66625d]">{r.when}</p>
        </div>
      </div>
      <p className="font-['Montserrat:Medium'] text-[14px] font-medium leading-[1.5] text-[#4b5563]">{r.body}</p>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(20,20,20,0.1)] pt-[15px]">
        <p className="flex items-center gap-[6px] text-[12px] leading-[16px] text-[#706e6b]">
          <span aria-hidden="true" className="font-['Noto_Sans:Regular']">
            👍
          </span>
          <span className="font-['Work_Sans:Medium'] font-medium">Helpful ({r.helpful})</span>
        </p>
        <div className="flex items-center gap-[8px]">
          <button
            type="button"
            onClick={() => onToast('Editing your review')}
            className="press min-h-[28px] rounded-[4px] border border-[#141414] bg-white px-[15px] py-[5px] font-['Work_Sans:SemiBold'] text-[12px] font-semibold leading-[16px] text-[#141414] hover:bg-sand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-flame"
          >
            Edit Review
          </button>
          <button
            type="button"
            onClick={() => onToast(`Opening ${r.organiser}'s profile`)}
            className="press min-h-[28px] rounded-[4px] border border-[#141414] bg-[#ff432a] px-[15px] py-[5px] font-['Work_Sans:SemiBold'] text-[12px] font-semibold leading-[16px] text-white drop-shadow-[0px_2px_1px_#111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111]"
          >
            View Organizer Profile
          </button>
        </div>
      </div>
    </article>
  )
}

export default function HostReviews({
  view,
  onViewBookings,
  onReviewOrganiser,
  onToast,
}: {
  view: ReviewsView
  onViewBookings: () => void
  onReviewOrganiser?: (name: string, event: string) => void
  onToast: (msg: string) => void
}) {
  // Prototype toggle so hosts (and reviewers of this flow) can preview the zero state.
  const [empty, setEmpty] = useState({ forYou: false, yours: false })
  const isEmpty = empty[view]

  const toggle = (
    <label className="flex w-fit cursor-pointer items-center gap-2 font-mono text-[11px] text-muted">
      <input
        type="checkbox"
        checked={isEmpty}
        onChange={(e) => setEmpty((s) => ({ ...s, [view]: e.target.checked }))}
        className="size-4 accent-flame"
      />
      Preview empty state
    </label>
  )

  if (view === 'forYou') {
    return (
      <div className="mx-auto flex max-w-[1088px] flex-col gap-[24px] page-in">
        <PageHeader
          title="How your space worked"
          sub="See what organisers have to say about hosting their events here."
          sortId="sort-for-you"
        />
        {isEmpty ? (
          <EmptyState
            title="No reviews yet"
            lines={[
              'Organisers who host their events here can share their experience with the space, team, and setup.',
              'Their reviews will appear here once they’re shared.',
            ]}
            onCta={onViewBookings}
          />
        ) : (
          <>
            <RatingSummary />
            {REVIEWS_FOR_YOU.map((r) => (
              <OrganiserReviewCard key={r.id} r={r} onShare={(n) => onToast(`Testimonial link for ${n} copied`)} />
            ))}
          </>
        )}
        {toggle}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-[1088px] flex-col gap-[24px] page-in">
      <PageHeader
        title="Reviews for organisers"
        sub={
          isEmpty
            ? 'Reviews you have shared about organisers you have hosted.'
            : 'Your feedback on organisers who’ve hosted events at your space.'
        }
        sortId="sort-yours"
      />
      {onReviewOrganiser && (
        <section aria-label="Review waiting" className="flex flex-col gap-4 border-[1.5px] border-ink bg-white p-5 shadow-hard sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono-b text-[10px] tracking-[0.6px] text-flame uppercase">Event ended · Yesterday</p>
            <p className="mt-1 font-head text-lg text-ink">How was Arjun Mehta at Tech Meetup Chennai?</p>
            <p className="text-sm text-muted">Organisers review your space too. Share how it went while it’s fresh.</p>
          </div>
          <button
            type="button"
            onClick={() => onReviewOrganiser('Arjun Mehta', 'Tech Meetup Chennai')}
            className="press shrink-0 border-[1.5px] border-ink bg-flame px-5 py-3 font-mono-b text-xs tracking-[0.72px] text-white uppercase shadow-hard-sm"
          >
            Review organiser →
          </button>
        </section>
      )}
      <div className="pt-[24px]">
        {isEmpty ? (
          <EmptyState
            title="Your first one is waiting."
            lines={['After hosting an event, tell us how it went with the organiser.']}
            onCta={onViewBookings}
          />
        ) : (
          YOUR_REVIEWS.map((r) => <HostReviewCard key={r.id} r={r} onToast={onToast} />)
        )}
      </div>
      {toggle}
    </div>
  )
}
