"use client";

import { useRouter } from "next/navigation";
import HostWorkspace from "./HostWorkspace";
import { useVenueApp } from "./VenueApp";

/** Connects the prototype's host workspace to the shared profile and real routes. */
export default function HostWorkspacePage({ venue }: { venue?: { slug: string; name: string; photo: string | null; spaceNames: string[] } }) {
  const router = useRouter();
  const { profile, saveProfile, openAuth, logout } = useVenueApp();
  return (
    <HostWorkspace
      venue={venue}
      hostName={profile?.name?.split(" ")[0] || venue?.name || "Host"}
      profile={profile}
      onSaveProfile={saveProfile}
      onAuth={openAuth}
      onExit={() => router.push("/venues")}
      onLogout={logout}
    />
  );
}
