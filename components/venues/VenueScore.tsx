"use client";

import { useState } from "react";
import { EVENT_PROFILES, SUITABILITY_BAND_COPY, scoreVenueForProfile } from "@/lib/venueScore";
import { VenueIcon, VenueKicker } from "@/components/venues/VenueUi";

const TONE_CLASS: Record<"good" | "mid" | "low", string> = {
  good: "border-signal-ink bg-signal/10 text-signal-ink",
  mid: "border-primary bg-primary/10 text-primary-ink",
  low: "border-foreground/25 bg-secondary text-muted-foreground",
};

interface ScorableVenue {
  amenities: readonly string[];
  spaces: readonly { amenities: readonly string[] }[];
}

/** "Will this venue work for your event?" — pick a brief, see what's confirmed. */
export function VenueScore({ venue }: { venue: ScorableVenue }) {
  const [profileKey, setProfileKey] = useState(EVENT_PROFILES[0].key);
  const score = scoreVenueForProfile(venue, profileKey);
  if (!score) return null;
  const bandCopy = SUITABILITY_BAND_COPY[score.band];

  return (
    <div className="rounded-2xl border border-foreground/15 bg-card p-5 sm:p-6">
      <VenueKicker>Will this work for your event?</VenueKicker>
      <div className="mt-3 flex flex-wrap gap-2">
        {EVENT_PROFILES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setProfileKey(p.key)}
            aria-pressed={profileKey === p.key}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition-colors ${
              profileKey === p.key
                ? "border-foreground bg-foreground text-background"
                : "border-foreground/20 text-muted-foreground hover:border-foreground/40"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${TONE_CLASS[bandCopy.tone]}`}>
        <span className="size-1.5 rounded-full bg-current" aria-hidden />
        {bandCopy.label}
        <span className="font-mono text-[10px] font-semibold opacity-70">
          {score.mustConfirmedCount}/{score.mustTotalCount} confirmed
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {[...score.must, ...score.nice].map((req) => (
          <div key={req.key} className="flex items-center gap-2 text-sm">
            {req.state === "confirmed" ? (
              <VenueIcon name="check" className="size-4 shrink-0 text-signal-ink" />
            ) : (
              <span className="grid size-4 shrink-0 place-items-center font-mono text-xs text-muted-foreground/60" aria-hidden>
                ?
              </span>
            )}
            <span className={req.state === "confirmed" ? "font-semibold" : "text-muted-foreground"}>{req.label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-muted-foreground">
        {"?"} means it hasn&apos;t been confirmed yet — not that the venue lacks it. Ask the host directly if it&apos;s a dealbreaker.
      </p>
    </div>
  );
}
