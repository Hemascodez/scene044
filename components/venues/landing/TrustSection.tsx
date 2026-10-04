"use client";

import { useRef } from "react";
import { useInView } from "motion/react";
import { VenueIcon, VenueKicker, type VenueIconName } from "@/components/venues/VenueUi";

const CARDS: { icon: VenueIconName; title: string; text: string }[] = [
  { icon: "shield", title: "Every space is seen in person", text: "We visit each venue, check the real capacity, and photograph it honestly. What you see is what you book." },
  { icon: "check", title: "Clear pricing, no surprises", text: "Starting prices, inclusions, and house rules are shown before you enquire. Fees are always explained." },
  { icon: "clock", title: "You always know your status", text: "Request sent, approved, or confirmed — plain words tell you exactly where your booking stands." },
];

export interface TrustQuote {
  comment: string;
  author: string;
  rating: number;
}

/**
 * The "why trust us" block. Each card's icon draws itself on as the card
 * scrolls in, performing what the card says: a shield that checks itself, a
 * tick, a clock whose hands sweep once.
 *
 * `quote` is a REAL published review passed in by the page, or null. The
 * prototype this was ported from had a hardcoded testimonial attributed to "A
 * SCENE/044 Organiser"; shipping an invented quote on a platform whose pitch is
 * verified listings would undercut the claim, so with no review there is simply
 * no quote.
 */
export function TrustSection({ quote }: { quote: TrustQuote | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.25 });

  return (
    <section id="why" ref={ref} data-in={inView} className="scroll-mt-20 border-y-[1.5px] border-foreground bg-secondary/50">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:py-24">
        <div>
          <VenueKicker>Why SCENE/044</VenueKicker>
          <h2 className="mt-3 font-display text-3xl font-extrabold leading-tight tracking-[-0.03em] md:text-[40px]">
            Trust earned before we ask you for anything.
          </h2>
          <p className="mt-4 max-w-[480px] text-muted-foreground">
            SCENE/044 helps people in Chennai find well-curated events. Venue booking extends that same care to the spaces those events happen in.
          </p>
          {quote && (
            <figure className="mt-8 max-w-[480px] border-[1.5px] border-foreground bg-venue-card p-6 shadow-hard">
              <div className="trust-stars flex gap-0.5 text-primary" role="img" aria-label={`${quote.rating} out of 5 stars`}>
                {Array.from({ length: quote.rating }).map((_, k) => (
                  <VenueIcon key={k} name="star" className="size-4 fill-current" />
                ))}
              </div>
              <blockquote className="mt-4 leading-7">&ldquo;{quote.comment}&rdquo;</blockquote>
              <figcaption className="mt-4 font-mono text-xs text-muted-foreground">— {quote.author}</figcaption>
            </figure>
          )}
        </div>

        <ul className="space-y-4 self-center">
          {CARDS.map((card, k) => (
            <li
              key={card.title}
              className="flex gap-4 border-[1.5px] border-foreground bg-venue-card p-5 shadow-hard-sm"
              style={{ "--d": `${k * 100}ms` } as React.CSSProperties}
            >
              <span className={`trust-icon t-i-${k} grid size-10 shrink-0 place-items-center border-[1.5px] border-foreground bg-primary text-white`}>
                <VenueIcon name={card.icon} className="size-5" />
              </span>
              <div>
                <h3 className="font-display text-lg font-bold leading-6">{card.title}</h3>
                <p className="mt-1.5 text-sm leading-[22.75px] text-muted-foreground">{card.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
