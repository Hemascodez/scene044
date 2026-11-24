import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { getCityHubEvents } from '@/lib/cityEventData';
import { activeCityHubs, cityHubPath, eventsForCityHub, getCityHub } from '@/lib/cityEvents';
import { cityHubMetadata, cityHubStructuredData } from '@/lib/cityEventSeo';
import { serializeJsonLd } from '@/lib/seo';
import { CityEventHub } from '@/components/scene/CityEventHub';

export const dynamic = 'force-dynamic';
interface Props { params: Promise<{ city: string }> }

const getHubPage = cache(async (slug: string) => {
  const events = await getCityHubEvents();
  const hub = getCityHub(slug, events);
  if (!hub) notFound();
  if (slug !== hub.slug) permanentRedirect(cityHubPath(hub));
  const now = new Date();
  return { hub, events: eventsForCityHub(events, hub, now), hubs: activeCityHubs(events, now) };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hub, events } = await getHubPage((await params).city);
  return cityHubMetadata(hub, events);
}

export default async function CityPage({ params }: Props) {
  // Query failures propagate as errors, never as a successful empty city page.
  const data = await getHubPage((await params).city);
  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(cityHubStructuredData(data.hub, data.events)) }} />
    <CityEventHub {...data} />
  </>;
}
