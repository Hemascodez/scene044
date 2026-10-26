/** Only public listing content is host-editable. Identity, publication state,
 * ratings, access and commission agreements remain curator-managed. */
export interface HostVenueDetails {
  name: string;
  area: string;
  city: string;
  address: string;
  summary: string;
  phone: string;
  mapUrl: string;
  amenities: string[];
  policies: string[];
}

export function parseHostVenueDetails(value: unknown): HostVenueDetails | string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Enter your venue details.';
  const body = value as Record<string, unknown>;
  const lengths = { name: 150, area: 150, city: 100, address: 1000, summary: 2000, phone: 40, mapUrl: 2048 };
  if (Object.keys(body).some(key => ![...Object.keys(lengths), 'amenities', 'policies'].includes(key))) return 'Unsupported venue field.';
  const result: Record<string, unknown> = {};
  for (const [key, max] of Object.entries(lengths)) {
    if (typeof body[key] !== 'string' || body[key].trim().length > max) return `Check the ${key}.`;
    result[key] = body[key].trim();
  }
  if (!result.name || !result.area || !result.city) return 'Name, area and city are required.';
  if (result.phone && !/^\+?[\d\s()-]{10,40}$/.test(String(result.phone))) return 'Enter a valid contact number.';
  if (result.mapUrl) {
    try {
      const url = new URL(String(result.mapUrl));
      if (url.protocol !== 'https:' || !['www.google.com', 'maps.google.com', 'maps.app.goo.gl', 'goo.gl', 'share.google'].includes(url.hostname)) return 'Use a Google Maps HTTPS link.';
    } catch { return 'Use a valid Google Maps link.'; }
  }
  for (const key of ['amenities', 'policies']) {
    const list = body[key];
    if (!Array.isArray(list) || list.length > 60 || list.some(item => typeof item !== 'string' || !item.trim() || item.length > 1000)) return `Check your ${key}.`;
    result[key] = [...new Set(list.map(item => item.trim()))];
  }
  return result as unknown as HostVenueDetails;
}
