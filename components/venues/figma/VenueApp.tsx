"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthModal, { type Profile } from "./AuthModal";

/**
 * App-level state the Figma Make prototype kept in App.tsx, rebuilt for Next's
 * real routes: the signed-in profile comes from the server session, shared
 * sign-up/OTP modal, and the bottom toast.
 *
 * `requireAuth(then)` is the prototype's "pending submit" pattern: open the
 * modal, and once the number is verified run `then` with the fresh profile.
 */
interface VenueAppValue {
  profile: Profile | null;
  authReady: boolean;
  saveProfile: (p: Profile) => Promise<void>;
  openAuth: () => void;
  requireAuth: (then: (p: Profile) => void) => void;
  logout: () => void;
  notify: (msg: string) => void;
}

const Ctx = createContext<VenueAppValue | null>(null);

function migrateLegacyLocalData(profile: Profile) {
  try {
    const legacy = JSON.parse(localStorage.getItem("scene044.profile") ?? "null") as { phone?: unknown } | null;
    const oldPhone = typeof legacy?.phone === "string" ? legacy.phone.replace(/\D/g, "").slice(-10) : "";
    if (!oldPhone || oldPhone !== profile.phone.replace(/\D/g, "").slice(-10)) return;
    for (const [oldKey, newKey] of [
      ["scene044.photo", `scene044.photo.v2:${profile.phone}`],
      ["scene044.myReviews.v1", `scene044.myReviews.v2:${profile.phone}`],
    ]) {
      const value = localStorage.getItem(oldKey);
      if (value !== null && localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
    localStorage.removeItem("scene044.profile");
  } catch { /* stale or unavailable browser storage cannot block sign-in */ }
}

export function useVenueApp(): VenueAppValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useVenueApp must be used inside <VenueAppProvider>");
  return value;
}

export function VenueAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef<((p: Profile) => void) | null>(null);
  const sessionRevision = useRef(0);

  // The server session is authoritative, including after a new device signs in.
  useEffect(() => {
    let active = true;
    // Never use browser-only identity from the old build to authenticate.
    // Keep it briefly only to migrate photo/drafts after the same phone proves
    // ownership through OTP; other people's legacy data stays hidden.
    try {
      localStorage.removeItem("scene044.venueBookingTokens.v1");
    } catch { /* storage may be unavailable in private browsing */ }
    const loadProfile = () => {
      const revision = ++sessionRevision.current;
      fetch("/api/venue-auth/me", { cache: "no-store" })
        .then(async (res) => res.ok ? (await res.json()).profile as Profile : null)
        .then((value) => {
          if (active && revision === sessionRevision.current) {
            if (value) migrateLegacyLocalData(value);
            setProfile(value);
          }
        })
        .catch(() => { if (active && revision === sessionRevision.current) setProfile(null); })
        .finally(() => { if (active) setAuthReady(true); });
    };
    loadProfile();
    window.addEventListener("scene044:venue-auth-changed", loadProfile);
    return () => {
      active = false;
      window.removeEventListener("scene044:venue-auth-changed", loadProfile);
    };
  }, []);

  const saveProfile = useCallback(async (p: Profile) => {
    const response = await fetch("/api/venue-auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: p.name, email: p.email, venue: p.venue }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) throw new Error(data.error ?? "Could not save your profile.");
    sessionRevision.current++;
    setProfile(data.profile);
  }, []);

  const notify = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  const openAuth = useCallback(() => {
    pending.current = null;
    setSubmitting(false);
    setOpen(true);
  }, []);

  const requireAuth = useCallback((then: (p: Profile) => void) => {
    pending.current = then;
    setSubmitting(true);
    setOpen(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      const response = await fetch("/api/venue-auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Could not log out. Try again.");
    } catch {
      notify("Could not log out. Try again.");
      return;
    }
    localStorage.removeItem("scene044.venueBookingTokens.v1");
    sessionRevision.current++;
    setProfile(null);
    setOpen(false);
    router.push("/venues");
    notify("You're logged out. See you at the next one.");
  }, [router, notify]);

  return (
    <Ctx.Provider value={{ profile, authReady, saveProfile, openAuth, requireAuth, logout, notify }}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
        {notice && <p className="anim-pop border-[2.5px] border-ink bg-white px-5 py-3 font-body-sb text-sm text-ink shadow-hard">{notice}</p>}
      </div>
      <AuthModal
        open={open}
        saved={profile}
        submitting={submitting}
        onClose={() => {
          setOpen(false);
          setSubmitting(false);
          pending.current = null;
        }}
        onVerified={(p) => {
          // Verification already saved the profile and set the session cookie.
          // Avoid a second, unawaited PATCH racing the first authenticated read.
          sessionRevision.current++;
          migrateLegacyLocalData(p);
          setProfile(p);
          setOpen(false);
          const then = pending.current;
          pending.current = null;
          setSubmitting(false);
          if (p.role === "Host") router.push("/host");
          else then?.(p);
        }}
      />
    </Ctx.Provider>
  );
}
