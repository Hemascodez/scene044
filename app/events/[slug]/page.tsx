import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cache } from "react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getPublicEventById } from "@/lib/events";
import { formatSceneDateLong, formatSceneTime, relativeChecked } from "@/lib/client/istTime";
import {
  audienceTagsFor,
  deriveSceneStatus,
  eventSummaryBullets,
  posterFor,
  toStoryParagraphs,
  usableEventSummary,
} from "@/lib/client/sceneEvent";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import {
  eventBreadcrumbStructuredData,
  eventIdFromSlug,
  eventImageUrl,
  eventPath,
  eventSeoDescription,
  eventSlug,
  eventStructuredData,
  serializeJsonLd,
} from "@/lib/seo";
import { AlertsBanner } from "@/components/scene/AlertsBanner";
import { EventGlance } from "@/components/scene/EventGlance";
import { EventPageScrollReset } from "@/components/scene/EventPageScrollReset";
import { EventPageActions } from "@/components/scene/EventPageActions";
import { SceneFooter } from "@/components/scene/SceneHero";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { Mono, StatusBadge } from "@/components/scene/ui";

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

// Metadata and page rendering ask for the same row. React's request cache keeps
// that to one database query per render.
const getEvent = cache(getPublicEventById);

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { slug } = await params;
  const id = eventIdFromSlug(slug);
  const event = id === null ? null : await getEvent(id);
  if (!event) {
    return {
      title: "Event not found — SCENE/044",
      robots: { index: false, follow: false },
    };
  }

  const title = `${event.title} — Chennai event | SCENE/044`;
  const description = eventSeoDescription(event);
  const canonical = eventPath(event);
  const image = eventImageUrl(event);
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
      images: [{ url: image, alt: `Poster for ${event.title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { slug } = await params;
  const id = eventIdFromSlug(slug);
  if (id === null) notFound();

  const event = await getEvent(id);
  if (!event) notFound();
  if (slug !== eventSlug(event)) permanentRedirect(eventPath(event));

  const field = getFieldCardForCategory(event.category);
  const fieldName = field?.label ?? event.category;
  const fieldHref = field ? `/category/${field.key}` : "/";
  const poster = posterFor(event);
  const status = deriveSceneStatus(event);
  const audienceTags = audienceTagsFor(event);
  const storyParagraphs = toStoryParagraphs(usableEventSummary(event));
  const hasStory = storyParagraphs.length > 0;
  const bullets = eventSummaryBullets(event);
  const heroByline = event.organizerName ?? (event.isOnline ? "Online event" : (event.venueName ?? event.city));
  const jsonLd = [eventBreadcrumbStructuredData(event), eventStructuredData(event)].filter(Boolean);

  return (
    <div className="min-h-full">
      <EventPageScrollReset />
      {jsonLd.map((data, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
        />
      ))}

      <SceneHeaderStatic />

      <main>
        <section className="border-b-2 border-foreground bg-foreground text-background">
          <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
            <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-[0.14em] text-background/60">
              <Link href="/" className="hover:text-primary">Events</Link>
              <span aria-hidden> / </span>
              <Link href={fieldHref} className="hover:text-primary">{fieldName}</Link>
            </nav>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">
                {fieldName}
              </span>
                <StatusBadge status={status} />
                {event.isPromoted && (
                  <span className="bg-primary-ink px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                    Promoted
                  </span>
                )}
              {event.priceType === "free" && (
                <span
                  className="bg-signal-ink px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white"
                >
                  Free
                </span>
              )}
              {event.priceType === "paid" && (
                <span className="border border-background/50 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
                  {event.priceNote ?? "Paid"}
                </span>
              )}
            </div>
            <h1 className="mt-3 max-w-4xl font-display text-3xl font-black leading-[0.98] tracking-tighter sm:text-4xl lg:text-5xl">
              {event.title}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-background/75">
              {event.startAt ? (
                <time dateTime={new Date(event.startAt).toISOString()}>
                  {formatSceneDateLong(event.startAt)} · {formatSceneTime(event.startAt)} IST
                </time>
              ) : (
                "Date not announced"
              )}
              <span aria-hidden> · </span>
              {heroByline}
            </p>
            {audienceTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2" aria-label="Who this event is for">
                {audienceTags.map((tag) => (
                  <span
                    key={tag.label}
                    className="border border-background/35 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-background/85"
                  >
                    #{tag.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 pt-8 lg:px-6 lg:pt-10">
          <div className="relative aspect-[21/9] max-h-[440px] overflow-hidden border-2 border-foreground bg-muted shadow-[6px_6px_0_0_var(--color-foreground)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- curated posters can come from arbitrary origins */}
            <img
              src={poster.src}
              alt={poster.isStock ? "" : `Poster for ${event.title}`}
              aria-hidden={poster.isStock || undefined}
              className="size-full object-cover"
            />
            {poster.isStock && (
              <span className="absolute bottom-0 right-0 m-2 bg-foreground/85 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-background">
                Scene image · not the official poster
              </span>
            )}
          </div>
        </div>

        <article className="mx-auto grid max-w-5xl gap-8 px-4 py-9 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-6 lg:py-12">
          <div className="min-w-0">
            {status === "cancelled" && (
              <Notice tone="bad" flush>This event has been cancelled by the organizer.</Notice>
            )}
            {status === "postponed" && (
              <Notice flush>This event was postponed. Confirm the latest date on the original source.</Notice>
            )}
            {status === "expired" && (
              <Notice flush>This event has ended. Browse the related field for upcoming events.</Notice>
            )}

            {(hasStory || bullets.length > 0 || event.registrationNote) && (
              <section className={status === "confirmed" ? "" : "mt-7"} aria-label="Event guide">
                {hasStory && (
                  <div>
                    <Mono className="text-[10px] text-primary-ink">About this event</Mono>
                    <h2 className="sr-only">About {event.title}</h2>
                    <div className="mt-2 max-w-2xl space-y-3 text-base leading-relaxed text-foreground/75">
                      {storyParagraphs.map((paragraph, paragraphIndex) => (
                        <p key={paragraphIndex}>
                          {paragraph.map((segment, segmentIndex) => (
                            segment.bold
                              ? <strong key={segmentIndex} className="font-semibold text-foreground">{segment.text}</strong>
                              : <span key={segmentIndex}>{segment.text}</span>
                          ))}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                <EventGlance bullets={bullets} className={hasStory ? "mt-8" : ""} />

                {event.registrationNote && (
                  <p className={`${hasStory || bullets.length > 0 ? "mt-6" : ""} border-l-4 border-warn-ink bg-secondary px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-warn-ink`}>
                    Registration: {event.registrationNote}
                  </p>
                )}
              </section>
            )}
          </div>

          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="border-2 border-foreground bg-card shadow-[5px_5px_0_0_var(--color-foreground)]">
              <div className="border-b-2 border-foreground bg-secondary px-4 py-3">
                <Mono className="text-[10px]">Event details</Mono>
              </div>
              <dl className="px-4">
                <Detail label="Date & time">
                  {event.startAt ? (
                    <time dateTime={new Date(event.startAt).toISOString()}>
                      {formatSceneDateLong(event.startAt)} · {formatSceneTime(event.startAt)} IST
                      {event.endAt ? ` – ${formatSceneTime(event.endAt)}` : ""}
                    </time>
                  ) : "Not announced"}
                </Detail>
                <Detail label={event.isOnline ? "Format" : "Venue"}>
                  {event.isOnline ? "Online event" : (
                    <>
                      {event.venueName ?? "Venue not announced"}
                      {event.venueAddress && <span className="mt-1 block text-muted-foreground">{event.venueAddress}</span>}
                      <span className="mt-1 block text-muted-foreground">{event.city}</span>
                    </>
                  )}
                </Detail>
                <Detail label="Organizer">{event.organizerName ?? "Not available"}</Detail>
                <Detail label="Price">
                  {event.priceType === "free"
                    ? "Free to attend"
                    : event.priceType === "paid"
                      ? (event.priceNote ?? "Paid — amount not published")
                      : "Not stated by the source"}
                </Detail>
                <Detail label="Source">
                  {event.primarySourceDomain}
                  {event.otherSourceDomains.length > 0 && (
                    <span className="mt-1 block text-muted-foreground">Also seen on {event.otherSourceDomains.join(", ")}</span>
                  )}
                </Detail>
                <Detail label="Last checked">
                  {event.lastVerifiedAt ? `${relativeChecked(event.lastVerifiedAt)} by SCENE/044` : "Not re-checked since discovery"}
                </Detail>
              </dl>
              <div className="border-t-2 border-foreground bg-secondary p-4">
                <EventPageActions id={event.id} title={event.title} startAt={event.startAt} />
              </div>
            </div>

            <Link
              href={fieldHref}
              className="mt-6 flex items-center justify-between border-2 border-foreground bg-card px-4 py-3 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors hover:bg-foreground hover:text-background"
            >
              More {fieldName} <span aria-hidden>→</span>
            </Link>
          </aside>
        </article>

        <div className="mx-auto max-w-5xl px-4 pb-12 lg:px-6">
          <AlertsBanner categoryHint={fieldName} />
        </div>
      </main>

      <SceneFooter />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b-2 border-dashed border-foreground/20 py-3 last:border-b-0">
      <dt><Mono className="text-[9px] text-muted-foreground">{label}</Mono></dt>
      <dd className="mt-1 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}

function Notice({
  children,
  tone = "warn",
  flush = false,
}: {
  children: ReactNode;
  tone?: "warn" | "bad";
  flush?: boolean;
}) {
  return (
    <div className={`${flush ? "" : "mt-7"} border-l-4 px-4 py-3 text-sm ${tone === "bad" ? "border-primary-ink bg-primary/10" : "border-warn-ink bg-warn/10"}`}>
      {children}
    </div>
  );
}
