/** Public customer prices and private booking calculations share these rules.
 * All amounts here are whole rupees; only the gateway boundary uses paise. */
export interface BookingPackage {
  id: string;
  name: string;
  hours: number;
  price: number;
  listPrice: number;
}
export interface VenuePricing {
  hourlyRate: number;
  minHours: number;
  packages: BookingPackage[];
}
export interface SpacePricingConfig {
  minHours: number;
  markupBasisPoints: number;
  packages: { id: string; name: string; hours: number; basePrice: number }[];
}
export const HOURLY_ID = 'hourly';
export class BookingPricingError extends Error {}

export function parseSpacePricing(value: unknown): SpacePricingConfig | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid space pricing configuration');
  const v = value as SpacePricingConfig;
  if (!Number.isInteger(v.minHours) || v.minHours < 1 || v.minHours > 24 ||
      !Number.isInteger(v.markupBasisPoints) || v.markupBasisPoints < 0 || v.markupBasisPoints > 10000 ||
      !Array.isArray(v.packages) || v.packages.length > 20) throw new Error('Invalid space pricing configuration');
  const ids = new Set<string>();
  for (const p of v.packages) {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9-]{1,80}$/.test(p.id) || p.id === HOURLY_ID || ids.has(p.id) ||
        typeof p.name !== 'string' || !p.name.trim() || p.name.length > 100 ||
        !Number.isInteger(p.hours) || p.hours < v.minHours || p.hours > 24 ||
        !Number.isSafeInteger(p.basePrice) || p.basePrice < 1 || p.basePrice > 10000000) throw new Error('Invalid space package');
    ids.add(p.id);
  }
  return v;
}

export function markedUpPrice(base: number, basisPoints: number): number {
  return Math.round(base * (10000 + basisPoints) / 10000);
}
export function publicSpacePricing(baseHourlyRate: number | null, config: SpacePricingConfig | null): VenuePricing | null {
  if (!config || baseHourlyRate === null) return null;
  const hourlyRate = markedUpPrice(baseHourlyRate, config.markupBasisPoints);
  return {
    hourlyRate, minHours: config.minHours,
    packages: config.packages.map(p => ({ id: p.id, name: p.name, hours: p.hours,
      price: markedUpPrice(p.basePrice, config.markupBasisPoints), listPrice: hourlyRate * p.hours })),
  };
}
export function packageById(pricing: VenuePricing, id: string): BookingPackage | null {
  return pricing.packages.find(p => p.id === id) ?? null;
}
export function packageTotal(pricing: VenuePricing, id: string, hours: number): number {
  return packageById(pricing, id)?.price ?? pricing.hourlyRate * hours;
}

export interface BookingQuote {
  hourlyRate: number | null;
  total: number | null;
  hostAmount: number | null;
  sceneAmount: number | null;
  pricingModel: 'host-commission' | 'host-markup';
  packageId: string;
  packageName: string;
}
/** The server calls this with rates/config read from the owning catalog room. */
export function quoteSpace(baseRate: number | null, config: SpacePricingConfig | null, duration: number, packageId = HOURLY_ID): BookingQuote {
  if (baseRate !== null && (!Number.isSafeInteger(baseRate) || baseRate < 1 || baseRate > 10000000)) throw new BookingPricingError('This space needs a valid hourly rate before booking.');
  if (!Number.isInteger(duration) || duration < (config?.minHours ?? 1) || duration > 24) {
    throw new BookingPricingError(`This space requires at least ${config?.minHours ?? 1} hours.`);
  }
  const chosen = config?.packages.find(p => p.id === packageId);
  if (packageId !== HOURLY_ID && !chosen) throw new BookingPricingError('This booking option is no longer available. Refresh and choose again.');
  if (chosen && chosen.hours !== duration) throw new BookingPricingError(`${chosen.name} must be booked for ${chosen.hours} hours.`);
  const baseTotal = chosen?.basePrice ?? (baseRate === null ? null : baseRate * duration);
  const hourlyRate = baseRate === null ? null : config ? markedUpPrice(baseRate, config.markupBasisPoints) : baseRate;
  // Match the displayed whole-rupee hourly price, including rounding, exactly.
  const total = chosen ? markedUpPrice(chosen.basePrice, config!.markupBasisPoints) : hourlyRate === null ? null : hourlyRate * duration;
  const sceneAmount = total === null ? null : config ? total - baseTotal! : Math.round(total * 0.1);
  return { hourlyRate,
    total, sceneAmount, hostAmount: total === null ? null : total - sceneAmount!,
    pricingModel: config ? 'host-markup' : 'host-commission', packageId, packageName: chosen?.name ?? 'Hourly' };
}

/** Old bookings retain their old 10% agreement. Trials are excluded from earnings. */
export function bookingFinancials(b: { total: number | null; trialAmountPaise?: number | null; hostAmount?: number | null; sceneAmount?: number | null }) {
  if (b.trialAmountPaise) return { total: b.trialAmountPaise / 100, sceneFee: 0, payout: 0 };
  const total = b.total ?? 0;
  const sceneFee = b.sceneAmount ?? Math.round(total * 0.1);
  return { total, sceneFee, payout: b.hostAmount ?? total - sceneFee };
}
