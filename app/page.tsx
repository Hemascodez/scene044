import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { getPublicEventById, getPublicEvents, type PublicEvent } from "@/lib/events";
import { eventPath, serializeJsonLd, websiteStructuredData } from "@/lib/seo";
import { SceneApp } from "@/components/scene/SceneApp";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ event?: string }>;
}

function parseDeepLinkEventId(eventParam: string | undefined): number | null {
  if (typeof eventParam !== "string" || !/^\d+$/.test(eventParam)) return null;
  const id = Number(eventParam);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

const HOME_TITLE = "Tech Events in Chennai | Meetups, Conferences & Workshops — SCENE/044";
const HOME_DESCRIPTION =
  "Discover upcoming tech events in Chennai, including AI meetups, startup networking, developer conferences, workshops and hackathons. Updated by SCENE/044.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "SCENE/044",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [{ url: "/stock/tech-1.jpg", alt: "Chennai's technology event scene" }],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: ["/stock/tech-1.jpg"],
  },
};

export default async function Home({ searchParams }: HomeProps) {
  const deepLinkEventId = parseDeepLinkEventId((await searchParams).event);

  // Preserve every previously shared `/?event=123` link while consolidating
  // it into the event's permanent, descriptive canonical URL.
  if (deepLinkEventId !== null) {
    let linkedEvent = null;
    try {
      linkedEvent = await getPublicEventById(deepLinkEventId);
    } catch (err) {
      console.error(`Home: failed to resolve legacy event link ${deepLinkEventId}`, err);
    }
    if (linkedEvent) permanentRedirect(eventPath(linkedEvent));
  }

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteStructuredData()) }}
      />
      <SceneApp events={events} fetchFailed={fetchFailed} />
    </>
  );
}
