import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicEvents } from '@/lib/events';
import { eventCollectionPath, getEventCollection, eventsForCollection, eventCollectionDateNote } from '@/lib/eventDiscovery';
import { eventCollectionStructuredData, serializeJsonLd, truncateSeoText } from '@/lib/seo';
import { EventCollectionView } from '@/components/scene/EventCollectionView';

export const dynamic = 'force-dynamic';

interface Props { params: Promise<{ collection: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const collection = getEventCollection((await params).collection);
  if (!collection) return { title: 'Page not found — SCENE/044', robots: { index: false, follow: false } };
  const title = `${collection.title} | SCENE/044`;
  const description = truncateSeoText(collection.description);
  const canonical = eventCollectionPath(collection);
  return {
    title, description, alternates: { canonical },
    openGraph: {
      type: 'website', locale: 'en_IN', siteName: 'SCENE/044', url: canonical, title, description,
      images: [{ url: '/stock/tech-1.jpg', alt: 'Chennai event discovery on SCENE/044' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/stock/tech-1.jpg'] },
  };
}

export default async function EventCollectionPage({ params }: Props) {
  const collection = getEventCollection((await params).collection);
  if (!collection) notFound();
  const now = new Date();
  // Do not disguise a failed database query as a successful empty listing.
  const events = eventsForCollection(await getPublicEvents(collection.categories ? [...collection.categories] : null), collection, now);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(eventCollectionStructuredData(collection, events)) }} />
    <EventCollectionView collection={collection} events={events} dateNote={eventCollectionDateNote(collection, now)} />
  </>;
}
