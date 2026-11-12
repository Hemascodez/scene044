// Venue typography, self-hosted (see app/globals.css `.hosted-surface`).
import "@fontsource-variable/montserrat";
import "@fontsource-variable/work-sans";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import Link from "next/link";
import { formatSceneDateLong, formatSceneTime } from "@/lib/client/istTime";
import { hostedGlanceFacts } from "@/lib/client/sceneEvent";
import { formatRupees, seatSummary, type HostedEventDetail } from "@/lib/hostedEvents";
import { AlertsBanner } from "@/components/scene/AlertsBanner";
import { EventGlance } from "@/components/scene/EventGlance";
import { Flipbook } from "@/components/scene/hosted/Flipbook";
import { HandwrittenNote } from "@/components/scene/hosted/HandwrittenNote";
import { HostedPageActions } from "@/components/scene/hosted/HostedPageActions";
import { HostedRegistration } from "@/components/scene/hosted/HostedRegistration";
import { ReadersEnrolled } from "@/components/scene/hosted/ReadersEnrolled";
import { hostedCard } from "@/components/scene/hosted/hostedCard";
import { HostedGoodToKnow, HostedTerms, HostedWhere } from "@/components/scene/hosted/HostedVenueSections";
import { Mono } from "@/components/scene/ui";
import { ChevronDown } from "@/components/venues/figma/icons";

/**
 * The event page for events SCENE hosts itself. Same grammar as the regular
 * event page (ink hero, bordered poster, At a glance, actions slot), but the
 * actions slot takes the registration instead of linking out, and the page
 * adds the things only a host can say: the full About, last time's photos,
 * and practical details.
 */
export function HostedEventView({ event, api }: { event: HostedEventDetail; api: "http" | "mock" }) {
  const { hosted } = event;
  const seat = seatSummary(hosted, event.endAt, undefined, event.status);
  const price = formatRupees(hosted.pricePaise);
  const paragraphs = hosted.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <main className="hosted-surface hosted-dark pb-28 sm:pb-0">
      <section className="border-b border-white/10 text-[#f4f2ea]">
        <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6 lg:py-8">
          <nav aria-label="Breadcrumb" className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#b5aeaa]">
            <Link href="/" className="hover:text-primary">Events</Link>
            <span aria-hidden> / </span>
            <span>Hosted by SCENE</span>
          </nav>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground">
              Hosted by SCENE
            </span>
            <span className="border border-background/50 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-background">
              {price}
            </span>
            <span
              className={`px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-white ${
                seat.state === "open" ? "bg-warn-ink" : seat.state === "sold_out" ? "bg-primary-ink" : "bg-background/20"
              }`}
            >
              {seat.state === "open" ? `${seat.spotsLeft} spots left` : seat.label}
            </span>
          </div>
          <h1 className="mt-3 max-w-4xl font-display text-3xl font-black leading-[0.98] tracking-tighter sm:text-4xl lg:text-5xl">
            {event.title}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#d8d2ce]">
            {event.startAt ? (
              <time dateTime={new Date(event.startAt).toISOString()}>
                {formatSceneDateLong(event.startAt)} · {formatSceneTime(event.startAt)}
                {event.endAt ? ` – ${formatSceneTime(event.endAt)}` : ""} IST
              </time>
            ) : (
              "Date to be announced"
            )}
            <span aria-hidden> · </span>
            {event.venueName ?? event.city}
            <span aria-hidden> · </span>
            {hosted.hostPerson ? `Hosted by ${hosted.hostPerson} · ${hosted.hostName}` : `by ${hosted.hostName}`}
          </p>
        </div>
      </section>

      {event.posterImageUrl && (
        <div className="mx-auto max-w-5xl px-4 pt-8 lg:px-6 lg:pt-10">
          <div className={`overflow-hidden border-2 border-foreground bg-secondary shadow-[6px_6px_0_0_var(--color-foreground)] sm:aspect-[21/9] sm:max-h-[440px] ${hostedCard}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- poster keeps its own shape; never cropped */}
            <img
              src={event.posterImageUrl}
              alt={`Poster for ${event.title}`}
              className="block h-auto w-full sm:h-full sm:object-contain"
            />
          </div>
        </div>
      )}

      <article className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-9 lg:px-6 lg:py-12">
        {event.status === "cancelled" && (
          <div className="border-l-4 border-primary-ink bg-primary/10 px-4 py-3 text-sm">
            This event has been cancelled. Contact SCENE with your payment reference for cancellation and refund updates.
          </div>
        )}

        <EventGlance gist={event.gist} facts={hostedGlanceFacts(event)} bullets={[]} boxClassName={hostedCard} />

        <ReadersEnrolled event={event} api={api} registerAnchorId="register" />

        <HostedRegistration event={event} api={api} anchorId="register" />

        <section aria-labelledby="hosted-about" className={`border-2 border-foreground bg-card p-4 sm:p-6 ${hostedCard}`}>
          <Mono className="text-[10px] text-primary-ink">About</Mono>
          <h2 id="hosted-about" className="mt-1.5 font-display text-xl font-black leading-tight tracking-tight sm:text-2xl">
            What the morning is like
          </h2>
          {paragraphs[0] && <p className="mt-3 text-base leading-relaxed">{paragraphs[0]}</p>}
          {paragraphs.length > 1 && (
            // Long description folds away (native <details>: keyboard and screen readers work as is).
            <details className="group mt-3">
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-ink [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Read the full description</span>
                <span className="hidden group-open:inline">Show less</span>
                <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180" />
              </summary>
              <div className="mt-2 space-y-4 text-base leading-relaxed">
                {paragraphs.slice(1).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </details>
          )}
        </section>

        {hosted.gallery.length > 0 && (
          <section
            aria-labelledby="hosted-last-time"
            className={`relative overflow-hidden border-2 border-foreground p-4 sm:p-6 ${hostedCard}`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse at 100% 0%, rgba(255,45,22,.26), rgba(255,45,22,0) 55%)" }}
            />
            <div className="relative">
            <Mono className="text-[10px] text-primary-ink">Last time</Mono>
            <h2 id="hosted-last-time" className="mt-1.5 font-display text-xl font-black leading-tight tracking-tight sm:text-2xl">
              Last time at {hosted.hostName}
            </h2>
            <div className="mt-4">
              <Flipbook photos={hosted.gallery} />
            </div>
            {hosted.quote && (
              <div className="mt-5">
                <HandwrittenNote text={hosted.quote.text} by={hosted.quote.by} highlight={hosted.quote.highlight} />
              </div>
            )}
            </div>
          </section>
        )}

        <HostedGoodToKnow groups={hosted.goodToKnow} />

        {!event.isOnline && event.venueName && (
          <HostedWhere venueName={event.venueName} address={event.venueAddress} city={event.city} />
        )}

        <HostedTerms terms={hosted.terms} refundPolicy={hosted.refundPolicy} />

        <HostedPageActions id={event.id} title={event.title} startAt={event.startAt} />
      </article>

      <div className="mx-auto max-w-5xl px-4 pb-12 lg:px-6">
        <AlertsBanner categoryHint="hosted events" />
      </div>
    </main>
  );
}
