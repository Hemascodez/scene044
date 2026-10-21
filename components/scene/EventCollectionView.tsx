import Link from 'next/link';
import type { PublicEvent } from '@/lib/events';
import { EVENT_COLLECTIONS, eventCollectionPath, type EventCollection } from '@/lib/eventDiscovery';
import { FIELD_CARDS } from '@/lib/fieldCards';
import { SceneHeaderStatic } from '@/components/scene/SceneHeader';
import { SceneFooter, SectionHead } from '@/components/scene/SceneHero';
import { CategoryFeed } from '@/components/scene/CategoryFeed';

/** Reuse Claude's category hero, cards, spacing and empty-state treatment. */
export function EventCollectionView({ collection, events, dateNote }: {
  collection: EventCollection; events: PublicEvent[]; dateNote: string;
}) {
  return <div className="min-h-full">
    <SceneHeaderStatic />
    <section className="border-b-2 border-foreground bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
        <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-[0.14em] text-background/60">
          <Link href="/" className="hover:text-primary">Chennai events</Link>
          <span aria-hidden> / </span>{collection.label}
        </nav>
        <h1 className="mt-3 font-display text-4xl font-black leading-[0.98] tracking-tighter sm:text-5xl">{collection.title}</h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/80">{collection.description}</p>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-background/60">{dateNote}</p>
      </div>
    </section>
    <main id="feed" className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
      <SectionHead kicker="Discovery feed" title={collection.label} note={`${events.length} event${events.length === 1 ? '' : 's'} · original sources linked`} />
      <CategoryFeed events={events} prefiltered emptyTitle={`No ${collection.label.toLowerCase()} listed right now`}
        emptyDescription="We haven’t found a matching event yet. Explore the other Chennai listings below or check back as new events are added. We won’t fill this page with past or unrelated events." />
      <nav aria-label="More Chennai events" className="mt-16">
        <SectionHead kicker="Keep exploring" title="Find your next event" />
        <div className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-foreground sm:grid-cols-3 lg:grid-cols-4">
          {EVENT_COLLECTIONS.filter(other => other.key !== collection.key).map(other => <Link key={other.key}
            href={eventCollectionPath(other)} className="group flex flex-col items-start gap-3 border-b-2 border-r-2 border-foreground bg-card p-4 transition-colors hover:bg-foreground hover:text-background">
            <span className="font-display text-sm font-bold leading-tight">{other.label}</span>
          </Link>)}
          {FIELD_CARDS.map(card => <Link key={card.key} href={`/category/${card.key}`}
            className="group flex flex-col items-start gap-3 border-b-2 border-r-2 border-foreground bg-card p-4 transition-colors hover:bg-foreground hover:text-background">
            <span className="font-display text-sm font-bold leading-tight">{card.label} events</span>
          </Link>)}
        </div>
      </nav>
    </main>
    <SceneFooter />
  </div>;
}
