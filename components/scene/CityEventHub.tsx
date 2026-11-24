import Link from 'next/link';
import type { CityHub, CityHubEvent } from '@/lib/cityEvents';
import { formatSceneDateLong, formatSceneTime } from '@/lib/client/istTime';
import { eventPath } from '@/lib/seo';
import { EventPageAuth } from './EventPageAuth';
import { SceneFooter, SectionHead } from './SceneHero';
import { CityHubLinks } from './CityHubLinks';

/** Plain server-rendered list so chronology, link order and schema agree. */
export function CityEventHub({ hub, events, hubs }: {
  hub: CityHub; events: CityHubEvent[]; hubs: (CityHub & { count: number })[];
}) {
  return <EventPageAuth><div className="min-h-full">
    <section className="border-b-2 border-foreground bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
        <nav aria-label="Breadcrumb" className="font-mono text-xs uppercase tracking-[0.14em] text-background/70">
          <Link href="/" className="inline-flex min-h-11 items-center hover:text-primary">SCENE</Link><span aria-hidden> / </span>{hub.city} events
        </nav>
        <h1 className="mt-3 font-display text-4xl font-black leading-[0.98] tracking-tighter sm:text-5xl">Upcoming events in <span className="text-primary">{hub.city}</span></h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/80">Find an in-person gathering in {hub.city}. Compare the published dates, venues and entry details, then open a listing for registration.</p>
        {hub.city === 'Delhi' && <p className="mt-3 max-w-2xl text-sm text-background/80">Includes listings located in Delhi and New Delhi. Events in Gurugram have their own city page.</p>}
        <p className="mt-4 font-mono text-xs uppercase tracking-[0.1em] text-background/70">In person · Dates and times in IST</p>
      </div>
    </section>
    <main id="feed" className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <SectionHead kicker="City guide" title={`What’s coming up in ${hub.city}`} note={`${events.length} event${events.length === 1 ? '' : 's'}`} />
      {events.length ? <ol className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-2">
        {events.map(event => <li key={event.id} className="flex min-w-0 flex-col border-2 border-foreground bg-card p-5 sm:p-6">
          <p className="font-mono text-xs uppercase leading-relaxed tracking-[0.08em] text-primary-ink"><time dateTime={event.startAt!}>{formatSceneDateLong(event.startAt!)} · {formatSceneTime(event.startAt!)} IST</time></p>
          <h2 className="mt-3 break-words font-display text-2xl font-bold leading-tight"><Link href={eventPath(event)} className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">{event.title}</Link></h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{[event.venueName, event.city].filter(Boolean).join(' · ')}</p>
          {event.summary && <p className="mt-3 line-clamp-3 text-sm leading-relaxed">{event.summary}</p>}
          <p className="mt-4 font-mono text-xs">{event.priceType === 'free' ? 'Free entry' : event.priceType === 'paid' ? event.priceNote ?? 'Paid entry · see listing' : 'Entry details on the event listing'}</p>
          <Link href={eventPath(event)} className="mt-4 inline-flex min-h-11 items-center self-start font-mono text-xs font-semibold uppercase tracking-[0.1em] text-primary-ink underline underline-offset-4">Event details &amp; registration →</Link>
        </li>)}
      </ol> : <div className="mt-8 border-2 border-dashed border-foreground bg-card p-6 sm:p-12">
        <h2 className="font-display text-2xl font-bold">No upcoming in-person events listed in {hub.city} right now</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">New listings will appear here when dates and a location in {hub.city} are available. Explore the other city pages below or check back later.</p>
      </div>}
      <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">Plans can change. Check the event listing and original organiser’s registration page before you travel.</p>
      <CityHubLinks hubs={hubs.filter(other => other.slug !== hub.slug)} label="Explore another city" />
      <Link href="/?tab=intercity#feed" className="mt-6 inline-flex min-h-11 items-center font-mono text-xs uppercase underline underline-offset-4 hover:text-primary-ink">Browse Intercity events →</Link>
    </main>
    <SceneFooter cityHubs={hubs} />
  </div></EventPageAuth>;
}
