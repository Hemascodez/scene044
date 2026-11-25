import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTER_LOUNGE_EDITIONS, isChapterLoungeEdition, LATEST_CHAPTER_LOUNGE_EDITION } from "@/lib/hostedEvents";
import { HostedEventView } from "@/components/scene/hosted/HostedEventView";
import { MockHostedAuth } from "@/components/scene/hosted/hostedAuth";
import { SceneFooter } from "@/components/scene/SceneHero";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { HostedPreviewReset } from "@/components/scene/hosted/HostedPreviewReset";

/**
 * Dev-only preview of a hosted event page on the in-memory mock, so the full
 * register → code → pay → ticket flow can be reviewed before the backend
 * exists. Sign-in is simulated (signs in as a sample guest). Emails starting
 * soldout@ = sold out, existing@ = already registered. Never served in production.
 */
export const metadata: Metadata = {
  title: "Hosted event preview — SCENE",
  robots: { index: false, follow: false },
};

/**
 * `?seats=0` (first visitor) or `?seats=15` (full house) previews the other card
 * states. `?date=2026-11-22` previews an earlier Chapter Lounge date; the
 * upcoming one shows by default.
 */
export default async function HostedEventPreviewPage({ searchParams }: { searchParams: Promise<{ seats?: string; date?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const fixture = CHAPTER_LOUNGE_EDITIONS[isChapterLoungeEdition(params.date) ? params.date : LATEST_CHAPTER_LOUNGE_EDITION];
  const requested = Number(params.seats);
  const hosted = fixture.hosted;
  const registeredCount = Number.isFinite(requested) ? Math.max(0, Math.min(hosted.capacity, Math.round(requested))) : hosted.registeredCount;
  const event = { ...fixture, hosted: { ...hosted, registeredCount } };
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <HostedPreviewReset eventId={event.id} />
      <div className="venue-surface hosted-root">
        <MockHostedAuth>
          <HostedEventView event={event} api="mock" />
        </MockHostedAuth>
      </div>
      <SceneFooter />
    </div>
  );
}
