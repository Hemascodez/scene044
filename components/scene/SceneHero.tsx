import Link from "next/link";
import { FIELD_CARDS } from "@/lib/fieldCards";
import { Btn, Mono } from "@/components/scene/ui";
import { Wordmark } from "@/components/scene/SceneHeader";

export function SceneHero({ onExplore }: { onExplore: () => void }) {
  return (
    <section className="border-b-2 border-foreground bg-foreground text-background">
      {/* Marquee of the fields we index. Duplicated once because the keyframe
          translates -50%, so the second copy is what makes the loop seamless. */}
      <div className="overflow-hidden border-b-2 border-background/20 py-2" aria-hidden>
        <div className="scene-ticker flex w-max gap-8 whitespace-nowrap">
          {[...FIELD_CARDS, ...FIELD_CARDS].map((card, i) => (
            <span key={i} className="font-mono text-[11px] uppercase tracking-[0.2em] text-background/70">
              {card.label} <span className="text-primary">✦</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-16 lg:px-6 lg:py-24">
        <Mono className="text-[11px] text-background/60">Chennai · Professional &amp; tech events</Mono>
        <h1 className="mt-4 max-w-4xl font-display text-5xl font-black leading-[0.95] tracking-tighter sm:text-6xl lg:text-7xl">
          Discover Chennai&apos;s tech scene, <span className="text-primary">before you miss it.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-background/80">
          From AI meetups and developer talks to design workshops, marketing circles, and founder sessions,
          discover the city&apos;s scattered events in one fresh, trustworthy feed.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Btn
            variant="solid"
            onClick={onExplore}
            className="!border-primary !bg-primary !text-primary-foreground hover:!border-background hover:!bg-background hover:!text-foreground"
          >
            Explore the scene ↓
          </Btn>
          <Mono className="text-[10px] text-background/50">No account needed · Save locally</Mono>
        </div>
      </div>
    </section>
  );
}

export function SectionHead({
  kicker,
  title,
  note,
}: {
  kicker: string;
  title: string;
  note?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b-2 border-foreground pb-3">
      <div>
        <Mono className="text-[11px] text-primary-ink">{kicker}</Mono>
        <h2 className="mt-1 font-display text-3xl font-black tracking-tight">{title}</h2>
      </div>
      {note && (
        <div className="pb-1 text-right font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          {note}
        </div>
      )}
    </div>
  );
}

/**
 * Entry points by field. These are real links to `/category/[key]`, not
 * in-page filters — a field is a place you can bookmark and share.
 */
export function FieldsGrid({ counts }: { counts: Record<string, number> }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 lg:px-6">
      <SectionHead kicker="Explore by field" title="Enter through what you care about" />
      <div className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-foreground sm:grid-cols-3 lg:grid-cols-4">
        {FIELD_CARDS.map((card) => (
          <Link
            key={card.key}
            href={`/category/${card.key}`}
            className="group flex flex-col items-start gap-3 border-b-2 border-r-2 border-foreground bg-card p-4 text-left transition-colors hover:bg-foreground hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="font-mono text-2xl" aria-hidden>
              {card.mark}
            </span>
            <span className="font-display text-sm font-bold leading-tight">{card.label}</span>
            <span className="mt-auto font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground group-hover:text-background/60">
              {counts[card.key] ?? 0} upcoming →
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function SceneFooter() {
  return (
    <footer className="border-t-2 border-foreground bg-foreground text-background">
      <div className="mx-auto max-w-6xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <Wordmark size="text-lg" />
            <p className="mt-3 max-w-xs text-sm text-background/70">
              A discovery layer for Chennai&apos;s professional scene. We link you to the original source —
              we never own registration.
            </p>
          </div>
          <div>
            <Mono className="text-[10px] text-background/50">How we stay honest</Mono>
            <ul className="mt-3 space-y-1.5 text-sm text-background/80">
              <li>Deduplicated across sources</li>
              <li>Freshness-checked continuously</li>
              <li>Original source always shown</li>
            </ul>
          </div>
          <div>
            <Mono className="text-[10px] text-background/50">Sources indexed</Mono>
            <ul className="mt-3 space-y-1.5 text-sm text-background/80">
              <li>LinkedIn · Luma · Meetup</li>
              <li>Eventbrite · Community pages</li>
              <li>University &amp; company sites</li>
            </ul>
            {/* Internal tool. Not secret — the gate is HTTP Basic in proxy.ts,
                so this link only saves typing the URL; it grants nothing. */}
            <a
              href="/admin/curator"
              className="mt-4 inline-flex items-center gap-1.5 border border-background/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-background/60 transition-colors hover:border-primary hover:text-primary"
            >
              <span aria-hidden>◐</span> Curator
            </a>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t-2 border-background/20 pt-5">
          <Mono className="text-[10px] text-background/50">© 2026 SCENE/044 · Made in Chennai</Mono>
          <Mono className="text-[10px] text-background/50">
            Curiosity → discovery → confidence → action
          </Mono>
        </div>
      </div>
    </footer>
  );
}
