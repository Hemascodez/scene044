"use client";

import "@fontsource-variable/montserrat";
import "@fontsource-variable/work-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import type { ReactNode } from "react";
import {
  VenueAppProvider,
  useVenueApp,
} from "@/components/venues/figma/VenueApp";
import { EventAccountNav } from "@/components/scene/EventAccountNav";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";

const EVENT_AUTH_COPY = {
  title: "Log in or sign up to SCENE",
  body: "Use your WhatsApp number to sign in or create an account. Find your event passes in My bookings.",
};

function EventAccountControls() {
  const { profile, authReady, openAuth } = useVenueApp();
  return (
    <EventAccountNav profile={profile} ready={authReady} onSignIn={openAuth} />
  );
}

/** One session for the header and registration; server-rendered content stays server-rendered. */
export function EventPageAuth({ children }: { children: ReactNode }) {
  return (
    <VenueAppProvider
      authClassName="venue-surface"
      defaultAuthCopy={EVENT_AUTH_COPY}
      attendeeAuth
    >
      <SceneHeaderStatic accountControls={<EventAccountControls />} />
      {children}
    </VenueAppProvider>
  );
}
