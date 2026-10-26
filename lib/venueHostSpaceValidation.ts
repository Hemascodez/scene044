import { parseSpacePricing, type SpacePricingConfig } from './venuePricing';
/** Client-safe contract. Rates are whole rupees, never paise. */
export interface HostSpaceDetails {
  name: string;
  eyebrow: string;
  description: string;
  maxGuests: number;
  communityRate: number | null;
  productionRate: number | null;
  photos: string[];
  amenities?: string[];
  packagePricing?: Omit<SpacePricingConfig, 'markupBasisPoints'>;
}

export function parseHostSpaceDetails(body: unknown): HostSpaceDetails | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Enter the space details.';
  const b = body as Record<string, unknown>;
  const keys = ['name','eyebrow','description','maxGuests','communityRate','productionRate','photos','requestId','amenities','packagePricing'];
  if (Object.keys(b).some(key => !keys.includes(key))) return 'Unsupported space field.';
  for (const [key, max] of [['name',120],['eyebrow',80],['description',2000]] as const) {
    if (typeof b[key] !== 'string' || (b[key] as string).trim().length > max) return `Check the ${key}.`;
  }
  if (!(b.name as string).trim()) return 'Enter a space name.';
  if (!Number.isInteger(b.maxGuests) || Number(b.maxGuests) < 1 || Number(b.maxGuests) > 10000) return 'Capacity must be a whole number from 1 to 10,000.';
  for (const key of ['communityRate','productionRate']) {
    if (b[key] !== null && (!Number.isInteger(b[key]) || Number(b[key]) < 1 || Number(b[key]) > 1000000)) return 'Enter an hourly rate from ₹1 to ₹10,00,000, or choose rate on request.';
  }
  if (!Array.isArray(b.photos) || b.photos.length < 1 || b.photos.length > 30 ||
      b.photos.some(photo => typeof photo !== 'string' || !photo.trim() || photo.length > 2048) || new Set(b.photos).size !== b.photos.length) return 'Add 1–30 different space photos.';
  const photos = b.photos.map(photo => photo.trim());
  if (new Set(photos).size !== photos.length) return 'Add different space photos.';
  if (b.amenities !== undefined && (!Array.isArray(b.amenities) || b.amenities.length > 60 || b.amenities.some(item => typeof item !== 'string' || !item.trim() || item.length > 300))) return 'Check the space amenities.';
  let packagePricing: HostSpaceDetails['packagePricing'];
  if (b.packagePricing !== undefined) {
    if (!b.packagePricing || typeof b.packagePricing !== 'object' || Array.isArray(b.packagePricing) || Object.keys(b.packagePricing).some(key => !['minHours','packages'].includes(key))) return 'Unsupported package field.';
    try {
      const parsed = parseSpacePricing({ ...b.packagePricing, markupBasisPoints: 0 });
      if (!parsed) return 'Check the booking packages.';
      packagePricing = { minHours: parsed.minHours, packages: parsed.packages };
    } catch { return 'Packages need unique names, whole hours and valid prices.'; }
  }
  return { name: (b.name as string).trim(), eyebrow: (b.eyebrow as string).trim(), description: (b.description as string).trim(),
    maxGuests: b.maxGuests as number, communityRate: b.communityRate as number | null, productionRate: b.productionRate as number | null,
    photos, ...(b.amenities === undefined ? {} : { amenities: (b.amenities as string[]).map(item => item.trim()) }),
    ...(packagePricing === undefined ? {} : { packagePricing }) };
}
