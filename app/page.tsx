import { getPublicEvents, type PublicEvent } from "@/lib/events";
import { SceneApp } from "@/components/scene/SceneApp";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ event?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { event: eventParam } = await searchParams;
  const deepLinkEventId =
    typeof eventParam === "string" && /^\d+$/.test(eventParam) ? Number(eventParam) : null;

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
