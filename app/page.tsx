import type { Metadata } from "next";
import { getPublicEventById, getPublicEvents, type PublicEvent } from "@/lib/events";
import { posterFor } from "@/lib/client/sceneEvent";
import { SceneApp } from "@/components/scene/SceneApp";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ event?: string }>;
}

function parseDeepLinkEventId(eventParam: string | undefined): number | null {
  return typeof eventParam === "string" && /^\d+$/.test(eventParam) ? Number(eventParam) : null;
}

/**
 * Per-event OpenGraph tags for `/?event={id}` links — otherwise a link shared
 * to WhatsApp/Twitter/LinkedIn falls back to the root layout's static site
 * description with no image, which is what motivated this (a shared event
 * link showed no poster). Falls back to that same static metadata (returns
 * {}) for the plain homepage and for an unknown/invalid id.
 */
export async function generateMetadata({ searchParams }: HomeProps): Promise<Metadata> {
  const id = parseDeepLinkEventId((await searchParams).event);
  if (id === null) return {};

  const event = await getPublicEventById(id);
  if (!event) return {};

  const title = `${event.title} — SCENE/044`;
  const description =
    event.summary ?? `${event.title}. Found on SCENE/044, Chennai's tech events, discovered.`;
  const poster = posterFor(event);

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `/?event=${id}`,
      siteName: "SCENE/044",
      images: [{ url: poster.src }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [poster.src],
    },
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const deepLinkEventId = parseDeepLinkEventId((await searchParams).event);

  // One in-process query, not a self-fetch of /api/events: a single DB round
  // trip, and the feed can never disagree with itself because everything on
  // the page reads the same array.
  let events: PublicEvent[] = [];
  let fetchFailed = false;
  try {
    events = await getPublicEvents(null);
  } catch (err) {
    console.error("Home: failed to load public events", err);
    fetchFailed = true;
  }

  return <SceneApp events={events} deepLinkEventId={deepLinkEventId} fetchFailed={fetchFailed} />;
}
