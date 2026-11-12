"use client";

import Link from "next/link";
import type { Profile } from "@/components/venues/figma/AuthModal";

/** Existing SCENE header controls, backed by the shared WhatsApp account flow. */
export function EventAccountNav({
  profile,
  ready,
  onSignIn,
}: {
  profile: Profile | null;
  ready: boolean;
  onSignIn: () => void;
}) {
  const control =
    "inline-flex min-h-11 items-center justify-center whitespace-nowrap px-3 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground";
  if (profile)
    return (
      <>
        <Link
          href="/bookings"
          className={`${control} border-2 border-foreground hover:bg-secondary`}
        >
          My bookings
        </Link>
        {profile.role === "Host" && (
          <Link
            href="/host"
            className={`${control} hidden hover:bg-secondary sm:inline-flex`}
          >
            Host dashboard
          </Link>
        )}
      </>
    );
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={!ready}
        onClick={onSignIn}
        className={`${control} hover:bg-secondary disabled:cursor-wait`}
      >
        Log in
      </button>
      <button
        type="button"
        aria-haspopup="dialog"
        disabled={!ready}
        onClick={onSignIn}
        className={`${control} border-2 border-foreground bg-primary-ink text-white shadow-[2px_2px_0_0_var(--color-foreground)] hover:bg-foreground disabled:cursor-wait`}
      >
        Sign up
      </button>
    </>
  );
}
