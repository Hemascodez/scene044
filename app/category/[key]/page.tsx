import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicEvents, type PublicEvent } from "@/lib/events";
import { FIELD_CARDS, getFieldCardByKey } from "@/lib/fieldCards";
import { stockPosterFor } from "@/lib/stockPosters";
import { categorySeoDescription, categoryStructuredData, serializeJsonLd } from "@/lib/seo";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { SceneFooter, SectionHead } from "@/components/scene/SceneHero";
import { CategoryFeed } from "@/components/scene/CategoryFeed";

export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ key: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { key } = await params;
  const card = getFieldCardByKey(key);
  if (!card) return { title: "Field not found — SCENE/044" };
  const title = `${card.label} Events in Chennai | SCENE/044`;
  const description = categorySeoDescription(card);
  const canonical = `/category/${card.key}`;
  const image = stockPosterFor(card.categories[0], 0);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "en_IN",
      url: canonical,
      siteName: "SCENE/044",
      title,
      description,
      images: [{ url: image, alt: `${card.label} events in Chennai` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { key } = await params;
  const card = getFieldCardByKey(key);
  if (!card) notFound();

  let events: PublicEvent[] = [];
  try {
    events = await getPublicEvents(card.categories);
  } catch (err) {
    console.error(`CategoryPage(${key}): failed to load events`, err);
  }
  const description = categorySeoDescription(card);

  return (
    <div className="min-h-full">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(categoryStructuredData(card, events)) }}
      />
      <SceneHeaderStatic />

      <section className="border-b-2 border-foreground bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
          <span className="font-mono text-3xl" aria-hidden>
            {card.mark}
          </span>
          <h1 className="mt-3 font-display text-4xl font-black leading-[0.98] tracking-tighter sm:text-5xl">
            {card.label}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-background/80">{description}</p>
        </div>
      </section>

      <main id="feed" className="mx-auto max-w-6xl px-4 py-12 lg:px-6">
        <SectionHead
          kicker="Field feed"
          title="Upcoming in Chennai"
          note="Soonest first · past events hidden"
        />
        <CategoryFeed events={events} fieldLabel={card.label} />

        <nav className="mt-16">
          <SectionHead kicker="Other fields" title="Keep looking" />
          <div className="mt-6 grid grid-cols-2 border-l-2 border-t-2 border-foreground sm:grid-cols-3 lg:grid-cols-4">
            {FIELD_CARDS.filter((c) => c.key !== card.key).map((other) => (
              <a
                key={other.key}
                href={`/category/${other.key}`}
                className="group flex flex-col items-start gap-3 border-b-2 border-r-2 border-foreground bg-card p-4 transition-colors hover:bg-foreground hover:text-background"
              >
                <span className="font-mono text-xl" aria-hidden>
                  {other.mark}
                </span>
                <span className="font-display text-sm font-bold leading-tight">{other.label}</span>
              </a>
            ))}
          </div>
        </nav>
      </main>

      <SceneFooter />
    </div>
  );
}
