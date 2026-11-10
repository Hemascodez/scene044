"use client";

import { useEffect, useId, useState } from "react";
import { EVENT_CITY_SUGGESTIONS, cityFromEventLocation, eventCityError, eventFeedDestination, normalizeEventCity } from "@/lib/eventLocations";
import { fetchEventCities } from "@/lib/client/curatorApi";
import { AdminBtn, AdminLabel, TextInput } from "@/components/curator/adminUi";

export function EventCityField({ value, isOnline, venueName, venueAddress, onChange }: {
  value: string; isOnline: boolean; venueName: string; venueAddress: string; onChange: (value: string) => void;
}) {
  const id = useId();
  const [cities, setCities] = useState(EVENT_CITY_SUGGESTIONS);
  useEffect(() => {
    let active = true;
    void fetchEventCities().then(result => {
      if (active) setCities([...new Set([...EVENT_CITY_SUGGESTIONS, ...result.cities])].sort((a, b) => a.localeCompare(b, "en-IN")));
    }).catch(() => { /* City entry remains usable if suggestions cannot load. */ });
    return () => { active = false; };
  }, []);
  const detectedCity = cityFromEventLocation(venueName, venueAddress);
  const error = eventCityError({ city: value, isOnline, venueName, venueAddress });
  const conflict = !!value && !!error;

  return <div className="space-y-3 border border-[#33493c] bg-[#101c16] p-4">
    {!isOnline && <>
      <label htmlFor={id} className="block"><AdminLabel>Event city</AdminLabel> <span className="text-[#39ff9b]" aria-hidden>*</span></label>
      <TextInput id={id} list={`${id}-options`} value={value} onChange={event => onChange(event.target.value)}
        placeholder="Choose or type a city, e.g. Bengaluru" maxLength={80} required autoComplete="off" className="min-h-11"
        aria-invalid={conflict || undefined} aria-describedby={`${id}-hint${conflict ? ` ${id}-error` : ""}`} />
      <datalist id={`${id}-options`}>{cities.map(city => <option key={city} value={city} />)}</datalist>
      <p id={`${id}-hint`} className="text-xs leading-relaxed text-[#a9bcb0]">Choose a suggested city or type a new one. Bangalore and Bengaluru share the same city tag.</p>
      {conflict && <p id={`${id}-error`} role="alert" className="text-sm text-[#ff9a8a]">{error}</p>}
      {detectedCity && detectedCity !== normalizeEventCity(value) && <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-[#a9bcb0]">Venue location: {detectedCity}</p>
        <AdminBtn onClick={() => onChange(detectedCity)}>Use {detectedCity}</AdminBtn>
      </div>}
    </>}
    <p role="status" aria-live="polite" className={`text-sm ${conflict ? "text-[#ff9a8a]" : "text-[#5effb0]"}`}>
      {conflict ? "Correct the city before publishing." : `Appears in: ${eventFeedDestination(value, isOnline)}`}
    </p>
  </div>;
}
