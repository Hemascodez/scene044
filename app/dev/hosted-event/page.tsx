import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTER_LOUNGE_FIXTURE } from "@/lib/hostedEvents";
import { HostedEventView } from "@/components/scene/hosted/HostedEventView";
import { MockHostedAuth } from "@/components/scene/hosted/hostedAuth";
import { SceneFooter } from "@/components/scene/SceneHero";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";

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

/** `?seats=0` (first visitor) or `?seats=20` (full house) previews the other card states. */
export default async function HostedEventPreviewPage({ searchParams }: { searchParams: Promise<{ seats?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const requested = Number((await searchParams).seats);
  const hosted = CHAPTER_LOUNGE_FIXTURE.hosted;
  const registeredCount = Number.isFinite(requested) ? Math.max(0, Math.min(hosted.capacity, Math.round(requested))) : hosted.registeredCount;
  const event = { ...CHAPTER_LOUNGE_FIXTURE, hosted: { ...hosted, registeredCount } };
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <div className="venue-surface hosted-root">
        <MockHostedAuth>
          <HostedEventView event={event} api="mock" />
        </MockHostedAuth>
      </div>
      <SceneFooter />
    </div>
  );
}
