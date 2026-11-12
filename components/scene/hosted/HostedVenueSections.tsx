import type { ComponentType } from "react";
import type { GoodToKnowGroup, GoodToKnowIcon } from "@/lib/hostedEvents";
import { venueMapEmbedUrl } from "@/lib/venueMaps";
import { hostedCard, hostedGlassButton } from "@/components/scene/hosted/hostedCard";
import { VenueMap } from "@/components/venues/VenueMap";
import { Check, ChevronDown, Clock, Coffee, MapPin, QrCode, Seating, Sparkle, Users } from "@/components/venues/figma/icons";

/**
 * "Good to know", "Where you will be" and "Before you book" for hosted
 * events, in the venue page's design (components/venues/figma/VenueDetail.tsx
 * — "What this space offers", "Where you will be", "Before you book"). Same
 * markup and tokens, and the venue's own map, map URL helper and icons.
 * VenueDetail itself is left as is: it is a verbatim Figma port.
 */

type IconProps = { className?: string; strokeWidth?: number };

/** Open book, drawn like the venue icon set (24px grid, 1.75 stroke). */
function Book({ className = "size-4", strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

const ICONS: Record<GoodToKnowIcon, ComponentType<IconProps>> = {
  book: Book,
  coffee: Coffee,
  clock: Clock,
  qr: QrCode,
  users: Users,
  seating: Seating,
  sparkle: Sparkle,
  pin: MapPin,
};

export function HostedGoodToKnow({ groups }: { groups: GoodToKnowGroup[] }) {
  return (
    <section aria-labelledby="good-to-know-title" className="border-t border-line pt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="good-to-know-title" className="font-head text-xl">Good to know</h2>
          <p className="mt-1 text-sm text-stone">Everything you need for the morning.</p>
        </div>
      </div>
      <div className="mt-7 space-y-9">
        {groups.map(({ group, note, items }, gi) => (
          <div key={group}>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full border-[1.5px] border-ink bg-flame font-mono-b text-[10px] text-white"
              >
                {gi + 1}
              </span>
              <h3 className="font-head text-[15px]">{group}</h3>
              <span className="hidden text-xs text-stone sm:inline">{note}</span>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
            </div>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {items.map(({ icon, text }) => {
                const Icon = ICONS[icon];
                return (
                  <li
                    key={text}
                    className={`group relative overflow-hidden border-[1.5px] border-ink bg-white p-4 shadow-hard-sm transition-transform duration-200 hover:-translate-y-0.5 ${hostedCard}`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-flame transition-transform duration-300 group-hover:scale-x-100"
                    />
                    <span className="grid size-11 place-items-center rounded-full bg-[#ffe3dd] text-flame transition-[background-color,color,transform] duration-200 group-hover:scale-110 group-hover:bg-flame group-hover:text-white">
                      <Icon className="size-5" />
                    </span>
                    <span className="mt-3 block font-head text-[14px] leading-5 text-ink">{text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HostedWhere({ venueName, address, city }: { venueName: string; address: string | null; city: string }) {
  const place = [venueName, address ?? city].filter(Boolean).join(", ");
  const mapQuery = encodeURIComponent(place);
  return (
    <section aria-labelledby="where-title" className="border-t border-line pt-10">
      <h2 id="where-title" className="font-head text-xl">Where you will be</h2>
      <p className="mt-1 text-sm text-stone">{address ? `${venueName} · ${address}` : `${venueName}, ${city}`}</p>
      <div className={`relative mt-5 overflow-hidden border-[1.5px] border-ink bg-sand ${hostedCard}`}>
        <VenueMap
          title={`Google Map showing ${venueName}`}
          src={venueMapEmbedUrl({ name: venueName, address: place, area: address ?? "", city })}
          className="block h-[260px] w-full border-0 sm:h-[320px]"
        />
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
          target="_blank"
          rel="noreferrer"
          className={`absolute bottom-3 left-3 flex min-h-11 items-center gap-2 px-4 py-2.5 font-mono-b text-[11px] tracking-[0.7px] uppercase ${hostedGlassButton}`}
        >
          <MapPin className="size-4" /> Open in Google Maps<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <p className="mt-4 max-w-[640px] text-sm leading-[22.75px] text-stone">
        Use the map above to plan your visit to {venueName}. Arrive 30 minutes early for a smooth entry.
      </p>
    </section>
  );
}

/**
 * "Before you book" as a collapsible card (native <details>, so keyboard and
 * screen readers work without extra code). Closed by default; the "Terms &
 * conditions" link on the registration card opens it.
 */
export function HostedTerms({ terms, refundPolicy }: { terms: string[]; refundPolicy: string }) {
  return (
    <section aria-labelledby="terms-title" className="border-t border-line pt-10">
      <details id="terms" className={`group scroll-mt-24 border-[1.5px] border-ink bg-white shadow-hard-sm ${hostedCard}`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
          <span>
            <h2 id="terms-title" className="font-head text-xl">Before you book</h2>
            <span className="mt-1 block text-sm text-stone">Terms &amp; conditions · Refunds</span>
          </span>
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center border-[1.5px] border-ink transition-transform duration-200 group-open:rotate-180"
          >
            <ChevronDown className="size-4" />
          </span>
        </summary>
        <div className="grid gap-8 border-t border-line p-4 sm:grid-cols-[1.6fr_1fr] sm:p-5">
        <div>
          <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">Terms &amp; conditions</h3>
          <ul className="mt-3 space-y-2">
            {terms.map((term) => (
              <li key={term} className="flex items-start gap-2 text-sm leading-[22px] text-stone">
                <Check className="mt-0.5 size-4 shrink-0 text-moss" strokeWidth={2.25} /> {term}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-mono-b text-xs tracking-[0.96px] uppercase">Refunds</h3>
          <p className="mt-3 text-sm leading-[22.75px] text-stone">{refundPolicy}</p>
        </div>
        </div>
      </details>
    </section>
  );
}
