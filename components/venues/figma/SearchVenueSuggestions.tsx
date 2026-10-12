"use client";

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CatalogVenue } from '@/lib/venueCatalog'
import { venueDetailSearchHref, type VenueSearchValues } from '@/lib/venueSearch'
import { VenueIndex } from './VenueIndex'
import useReveal from './useReveal'

/** Browse alternatives using the same cards as the approved landing page. */
export function SearchVenueSuggestions({ venues, search }: {
  venues: CatalogVenue[]
  search: VenueSearchValues
}) {
  const router = useRouter()
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  useReveal()

  return <VenueIndex
    id="explore-venues"
    venues={venues}
    fallbackSlides={[]}
    saved={saved}
    onToggleSave={(slug) => setSaved(value => ({ ...value, [slug]: !value[slug] }))}
    onOpenVenue={(slug) => router.push(venueDetailSearchHref(slug, search))}
    description="More venues to explore. These don’t match all your filters, so check their location and capacity before sending a request. The host confirms date and time availability."
  />
}
