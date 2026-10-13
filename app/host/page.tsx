import type { Metadata } from "next";
import { VenueShell } from "@/components/venues/VenueShell";
import HostWorkspacePage from "@/components/venues/figma/HostWorkspacePage";
import { requireHostPageAccess } from '@/lib/venueHostPageAuth';
import { getHostVenueSlug } from '@/lib/venueHostAccess';
import { getCatalogVenue } from '@/lib/venueCatalog';

export const metadata: Metadata = {
  title: "Host view — SCENE/044",
  robots: { index: false, follow: false },
};

/* Recheck membership per request, not only in the proxy. */
export const dynamic = "force-dynamic";

/** The host workspace — the approved Figma Make design, on real bookings. */
export default async function HostPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const ref = (await searchParams).ref?.trim().toUpperCase();
  const returnTo = ref && /^SCN-[A-Z0-9]{6,8}$/.test(ref) ? `/host?ref=${ref}` : undefined;
  const request = await requireHostPageAccess(returnTo);
  const slug = await getHostVenueSlug(request);
  const venue = slug ? await getCatalogVenue(slug) : null;
  return (
    <VenueShell bare>
      <HostWorkspacePage venue={venue ? { slug: venue.slug, name: venue.name, photo: venue.photos[0] ?? null, spaceNames: venue.spaces.map(space => space.name) } : undefined} />
    </VenueShell>
  );
}
