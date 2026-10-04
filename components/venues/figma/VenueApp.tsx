"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import AuthModal, { type Profile } from "./AuthModal";

/**
 * App-level state the Figma Make prototype kept in App.tsx, rebuilt for Next's
 * real routes: the signed-in profile (localStorage, so returning visitors are
 * auto-filled exactly as the prototype did), the one shared sign-up/OTP modal,
 * and the bottom toast.
 *
 * `requireAuth(then)` is the prototype's "pending submit" pattern: open the
 * modal, and once the number is verified run `then` with the fresh profile.
 */
const KEY = "scene044.profile";

interface VenueAppValue {
  profile: Profile | null;
  saveProfile: (p: Profile) => void;
  openAuth: () => void;
  requireAuth: (then: (p: Profile) => void) => void;
  logout: () => void;
  notify: (msg: string) => void;
}

const Ctx = createContext<VenueAppValue | null>(null);

export function useVenueApp(): VenueAppValue {
  const value = useContext(Ctx);
  if (!value) throw new Error("useVenueApp must be used inside <VenueAppProvider>");
  return value;
}

function load(): Profile | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

export function VenueAppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const pending = useRef<((p: Profile) => void) | null>(null);

  // Read after mount: localStorage does not exist during server rendering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads localStorage after mount; it does not exist during server rendering
    setProfile(load());
    const sync = () => setProfile(load());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const saveProfile = useCallback((p: Profile) => {
    localStorage.setItem(KEY, JSON.stringify(p));
    setProfile(p);
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

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    localStorage.removeItem("scene044.photo");
    localStorage.removeItem("scene044.hostLogo");
    setProfile(null);
    setOpen(false);
    router.push("/venues");
    notify("You're logged out. See you at the next one.");
  }, [router, notify]);

  return (
    <Ctx.Provider value={{ profile, saveProfile, openAuth, requireAuth, logout, notify }}>
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
          saveProfile(p);
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
