"use client";

import { useState } from "react";
import { EVENT_PROFILES, SUITABILITY_BAND_COPY, scoreVenueForProfile } from "@/lib/venueScore";
import { VenueIcon, VenueKicker } from "@/components/venues/VenueUi";

/* Tone is carried by a left-edge colour bar AND the label text, so the band
   never relies on colour alone. On the dark panel the bright tokens are the
   right ones: they clear 4.5:1 against near-black. */
const TONE: Record<"good" | "mid" | "low", { bar: string; text: string }> = {
  good: { bar: "bg-signal", text: "text-[#5fd99a]" },
  mid: { bar: "bg-primary", text: "text-[#ff8a7a]" },
  low: { bar: "bg-background/40", text: "text-background/70" },
};

interface ScorableVenue {
  amenities: readonly string[];
  spaces: readonly { amenities: readonly string[] }[];
}

/**
 * "Will this venue work for your event?" — pick a brief, see what's confirmed.
 *
 * Deliberately NOT a numeric score. It reports how many of an event type's
 * must-haves the venue has actually confirmed, and a "?" means "not confirmed
 * yet", never "the venue lacks it". A made-up "8.2 / 10" would look more
 * authoritative and be less true.
 */
export function VenueScore({ venue }: { venue: ScorableVenue }) {
  const [profileKey, setProfileKey] = useState(EVENT_PROFILES[0].key);
  const score = scoreVenueForProfile(venue, profileKey);
  if (!score) return null;
  const bandCopy = SUITABILITY_BAND_COPY[score.band];
  const tone = TONE[bandCopy.tone];

  return (
    <div className="relative overflow-hidden border-[1.5px] border-foreground bg-foreground p-5 text-background shadow-hard sm:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_0%,rgba(255,45,22,.22),transparent_55%)]" />
      <div className="relative">
        <VenueKicker className="text-primary">How well it fits your event</VenueKicker>
        <h3 className="mt-2 font-display text-2xl font-extrabold leading-tight tracking-[-0.02em] sm:text-3xl">Will this work for your event?</h3>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Choose your kind of event">
          {EVENT_PROFILES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setProfileKey(p.key)}
              aria-pressed={profileKey === p.key}
              className={`min-h-9 border-[1.5px] px-3.5 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                profileKey === p.key ? "border-background bg-background text-foreground" : "border-background/35 text-background/75 hover:border-background"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-5 flex items-stretch border-[1.5px] border-background/25 bg-background/5">
          <span aria-hidden className={`w-1.5 shrink-0 ${tone.bar}`} />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
            <span className={`font-display text-lg font-bold ${tone.text}`}>{bandCopy.label}</span>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-background/70">
              {score.mustConfirmedCount}/{score.mustTotalCount} confirmed
            </span>
          </div>
        </div>

        <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {[...score.must, ...score.nice].map((req) => (
            <li key={req.key} className="flex items-center gap-2.5 text-sm">
              {req.state === "confirmed" ? (
                <span className="grid size-5 shrink-0 place-items-center bg-signal text-white">
                  <VenueIcon name="check" className="size-3.5" />
                </span>
              ) : (
                <span className="grid size-5 shrink-0 place-items-center border border-dashed border-background/45 font-mono text-[11px] text-background/70" aria-hidden>
                  ?
                </span>
              )}
              <span className={req.state === "confirmed" ? "font-semibold" : "text-background/70"}>
                {req.label}
                {req.state !== "confirmed" && <span className="sr-only"> (not confirmed yet)</span>}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 text-xs leading-5 text-background/65">
          {"?"} means it hasn&apos;t been confirmed yet — not that the venue lacks it. Ask the host directly if it&apos;s a dealbreaker.
        </p>
      </div>
    </div>
  );
}
