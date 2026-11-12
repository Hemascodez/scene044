import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTER_LOUNGE_FIXTURE } from "@/lib/hostedEvents";
import { HostedEventView } from "@/components/scene/hosted/HostedEventView";
import { SceneFooter } from "@/components/scene/SceneHero";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";

/**
 * Dev-only preview of a hosted event page on the in-memory mock, so the full
 * register → code → pay → ticket flow can be reviewed before the backend
 * exists. Mock code: 123456. Phones ending 0000 = sold out, 1111 = already
 * registered. Never served in production.
 */
export const metadata: Metadata = {
  title: "Hosted event preview — SCENE/044",
  robots: { index: false, follow: false },
};

export default function HostedEventPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <HostedEventView event={CHAPTER_LOUNGE_FIXTURE} api="mock" />
      <SceneFooter />
    </div>
  );
}
