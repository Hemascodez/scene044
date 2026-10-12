/** Share links open in Google Maps, but cannot be used as iframe sources. */
export function venueMapEmbedUrl(venue: {
  mapEmbedUrl?: string | null;
  address?: string | null;
  name: string;
  area: string;
  city: string;
}): string {
  if (venue.mapEmbedUrl) {
    try {
      const url = new URL(venue.mapEmbedUrl);
      if (url.protocol === 'https:' && ['www.google.com', 'maps.google.com'].includes(url.hostname) &&
          (url.pathname.startsWith('/maps/embed') ||
            (url.pathname === '/maps' && url.searchParams.get('output') === 'embed'))) {
        return url.toString();
      }
    } catch {
      // A pasted share link or malformed value falls back to the venue address.
    }
  }
  const query = venue.address?.trim() || `${venue.name}, ${venue.area}, ${venue.city}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=16&output=embed`;
}
