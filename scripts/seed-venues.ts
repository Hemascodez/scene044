/**
 * Seeds the venue catalog from the constant that used to be the only source of
 * truth (TIME_CAFE in lib/venues.ts).
 *
 * Idempotent: re-running updates the row rather than creating a second Times
 * Cafe, so it is safe on every deploy. After this, the curator owns the data —
 * so by default the seed will NOT overwrite fields a curator has since edited.
 * Pass --force to push the constant's values over the top anyway.
 *
 *   npx tsx --env-file=.env.local scripts/seed-venues.ts
 *   npx tsx --env-file=.env.local scripts/seed-venues.ts --force
 */
import { pool } from "../lib/db";
import { TIME_CAFE } from "../lib/venues";
import {
  createVenue,
  getCatalogVenue,
  updateVenue,
  upsertVenueSpace,
} from "../lib/venueCatalog";

const FORCE = process.argv.includes("--force");

async function main() {
  const existing = await getCatalogVenue(TIME_CAFE.slug);

  if (existing && !FORCE) {
    console.log(`• ${TIME_CAFE.name} is already in the catalog (status: ${existing.status}).`);
    console.log("  Leaving curator-edited content alone. Re-run with --force to overwrite.");
    console.log(`  Spaces present: ${existing.spaces.length}`);
    await pool.end();
    return;
  }

  if (!existing) {
    await createVenue({ slug: TIME_CAFE.slug, name: TIME_CAFE.name, area: TIME_CAFE.area });
    console.log(`+ created ${TIME_CAFE.name}`);
  }

  const venue = await updateVenue(TIME_CAFE.slug, {
    name: TIME_CAFE.name,
    area: TIME_CAFE.area,
    city: TIME_CAFE.city,
    address: TIME_CAFE.address,
    summary: TIME_CAFE.summary,
    // Times Cafe is the one venue actually bookable today.
    status: "live",
    rating: TIME_CAFE.caféRating,
    ratingCount: TIME_CAFE.caféRatingCount,
    ratingUrl: TIME_CAFE.caféRatingUrl,
    phone: TIME_CAFE.phone,
    mapUrl: TIME_CAFE.mapUrl,
    mapEmbedUrl: TIME_CAFE.mapEmbedUrl,
    photos: [...TIME_CAFE.photos],
    amenities: [...TIME_CAFE.amenities],
    policies: [...TIME_CAFE.policies],
  });
  if (!venue) throw new Error("venue vanished between create and update");

  for (const [index, space] of TIME_CAFE.spaces.entries()) {
    await upsertVenueSpace(venue.id, {
      spaceKey: space.id,
      name: space.name,
      eyebrow: space.eyebrow,
      description: space.description,
      capacity: space.capacity,
      maxGuests: space.maxGuests,
      image: space.image,
      amenities: [...space.amenities],
      communityRate: space.communityRate,
      productionRate: space.productionRate,
      minimumFoodSpend: space.minimumFoodSpend,
      sortOrder: index,
    });
  }

  const seeded = await getCatalogVenue(TIME_CAFE.slug);
  console.log(`✓ ${seeded?.name} — status ${seeded?.status}, ${seeded?.spaces.length} spaces, ${seeded?.amenities.length} amenities`);
  for (const space of seeded?.spaces ?? []) {
    const rate = space.communityRate === null ? "quote only" : `₹${space.communityRate}/hr`;
    console.log(`   · ${space.name} — up to ${space.maxGuests} — ${rate}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
