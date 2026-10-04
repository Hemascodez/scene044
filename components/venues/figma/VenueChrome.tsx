"use client";

import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

/** The prototype's header and footer around a page that has no design of its own. */
export function VenueChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader wide />
      <main id="main">{children}</main>
      <SiteFooter wide />
    </>
  );
}
