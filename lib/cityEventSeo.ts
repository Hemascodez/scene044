import type { Metadata, MetadataRoute } from 'next';
import { absoluteUrl, eventPath, SITE_URL, truncateSeoText } from './seo';
import { activeCityHubs, cityHubLastModified, cityHubPath, eventsForCityHub, type CityHub, type CityHubEvent } from './cityEvents';

export function cityHubDescription(hub: CityHub, events: readonly CityHubEvent[]): string {
  if (!events.length) return `No upcoming in-person events in ${hub.city} are listed on SCENE right now. Explore other cities while new listings are added.`;
  const venues = [...new Set(events.map(event => event.venueName?.trim()).filter((value): value is string => !!value))];
  return truncateSeoText(`${events.length} upcoming in-person event${events.length === 1 ? '' : 's'} in ${hub.city}${venues.length ? `, including ${venues.slice(0, 2).join(' and ')}` : ''}. See dates, venues and registration details on SCENE.`);
}

export function cityHubMetadata(hub: CityHub, events: readonly CityHubEvent[]): Metadata {
  const title = `Upcoming Events in ${hub.city} | SCENE`;
  const description = cityHubDescription(hub, events);
  const canonical = cityHubPath(hub);
  return {
    title, description, alternates: { canonical }, robots: { index: events.length > 0, follow: true },
    openGraph: { type: 'website', locale: 'en_IN', siteName: 'SCENE', url: canonical, title, description, images: [] },
    twitter: { card: 'summary', title, description, images: [] },
  };
}

/** Collection markup describes exactly the visible list. Event rich-result
 * markup belongs on individual detail pages, not the city collection. */
export function cityHubStructuredData(hub: CityHub, events: readonly CityHubEvent[]) {
  const url = absoluteUrl(cityHubPath(hub));
  return {
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': `${url}#collection`,
    url, name: `Upcoming Events in ${hub.city}`, description: cityHubDescription(hub, events), inLanguage: 'en-IN',
    isPartOf: { '@id': `${SITE_URL}/#website` },
    breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'SCENE', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: `${hub.city} events`, item: url },
    ] },
    mainEntity: { '@type': 'ItemList', numberOfItems: events.length, itemListElement: events.map((event, index) => ({
      '@type': 'ListItem', position: index + 1, name: event.title, url: absoluteUrl(eventPath(event)),
    })) },
  };
}

export function cityHubSitemapEntries(events: readonly CityHubEvent[], now = new Date()): MetadataRoute.Sitemap {
  return activeCityHubs(events, now).map(hub => {
    const lastModified = cityHubLastModified(eventsForCityHub(events, hub, now), now);
    return { url: absoluteUrl(cityHubPath(hub)), ...(lastModified ? { lastModified } : {}), changeFrequency: 'daily', priority: 0.8 };
  });
}
