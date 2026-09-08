"use client";

import { useLayoutEffect } from "react";

/** Next preserves scroll during some client transitions from the long feed.
 * Event details must always begin at their own header, never at the footer. */
export function EventPageScrollReset() {
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return null;
}
