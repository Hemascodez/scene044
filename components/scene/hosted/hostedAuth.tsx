"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useVenueApp } from "@/components/venues/figma/VenueApp";
import type { Profile } from "@/components/venues/figma/AuthModal";

/**
 * Who is registering. On the real page this is the shared SCENE account
 * (VenueAppProvider + its WhatsApp sign-in popup); on the dev preview it's a
 * stand-in so the flow can be tried without WhatsApp.
 */

export interface HostedProfile {
  name: string;
  /** +91 number from the account; read-only on the registration card. */
  phone: string;
  email?: string;
}

interface HostedAuthValue {
  profile: HostedProfile | null;
  acceptVerifiedProfile: (profile: Profile) => void;
  /** Runs `then` now if signed in, else after the guest signs in. */
  requireAuth: (then: (profile: HostedProfile) => void,force?:boolean) => void;
}

const Ctx = createContext<HostedAuthValue | null>(null);

export function useHostedAuth(): HostedAuthValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useHostedAuth must be used inside VenueAuthBridge or MockHostedAuth");
  return value;
}

const SIGN_IN_COPY = {
  title: "Sign in to get your pass",
  body: "We'll send a one-time code to your WhatsApp. Your ticket will be in My bookings; WhatsApp ticket updates are optional.",
};

function toHosted(profile: Profile): HostedProfile {
  return { name: profile.name, phone: profile.phone, email: profile.email };
}

/** Real page: the shared SCENE account. Must sit inside VenueAppProvider. */
export function VenueAuthBridge({ children }: { children: ReactNode }) {
  const { profile, requireAuth, acceptVerifiedProfile } = useVenueApp();
  const value = useMemo<HostedAuthValue>(
    () => ({
      profile: profile ? toHosted(profile) : null,
      acceptVerifiedProfile,
      requireAuth: (then,force=false) => {
        if (profile && !force) then(toHosted(profile));
        else requireAuth((p) => then(toHosted(p)), SIGN_IN_COPY);
      },
    }),
    [profile, requireAuth, acceptVerifiedProfile],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const MOCK_PROFILE: HostedProfile = { name: "Asha Raman", phone: "+919876543210", email: "asha@example.com" };

/** Dev preview only: signs in as a sample guest the first time it's asked. */
export function MockHostedAuth({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<HostedProfile | null>(null);
  const requireAuth = useCallback((then: (p: HostedProfile) => void) => {
    setProfile(MOCK_PROFILE);
    then(MOCK_PROFILE);
  }, []);
  const acceptVerifiedProfile = useCallback((p: Profile) => setProfile(toHosted(p)), []);
  const value = useMemo(() => ({ profile, requireAuth, acceptVerifiedProfile }), [profile, requireAuth, acceptVerifiedProfile]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
