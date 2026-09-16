"use client";

import { useEffect, useRef } from "react";

/**
 * `VenueSearchBar` re-searches with `router.push` — a client-side
 * navigation, so the scroll position stays wherever it was and the new
 * results can render entirely below the fold with nothing to show they
 * arrived. This scrolls the results into view whenever `trigger` changes,
 * but not on the page's first render (a fresh visit to /venues/search
 * shouldn't jump away from the hero/search bar before the visitor has
 * searched anything).
 */
export function ScrollToResultsOnSearch({ trigger, targetId }: { trigger: string; targetId: string }) {
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [trigger, targetId]);

  return null;
}
