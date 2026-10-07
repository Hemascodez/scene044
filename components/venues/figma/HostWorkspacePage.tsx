"use client";

import { useRouter } from "next/navigation";
import HostWorkspace from "./HostWorkspace";
import { useVenueApp } from "./VenueApp";

/** Connects the prototype's host workspace to the shared profile and real routes. */
export default function HostWorkspacePage() {
  const router = useRouter();
  const { profile, saveProfile, openAuth, logout } = useVenueApp();
  return (
    <HostWorkspace
      hostName={profile?.name?.split(" ")[0] || "Time Cafe"}
      profile={profile}
      onSaveProfile={saveProfile}
      onAuth={openAuth}
      onExit={() => router.push("/venues")}
      onLogout={logout}
    />
  );
}
