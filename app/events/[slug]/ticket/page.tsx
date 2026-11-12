import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getPublicEventById } from "@/lib/events";
import { eventIdFromSlug, eventPath, eventSlug } from "@/lib/seo";
import { eventTicketLocation, validEventTicketToken } from "@/lib/eventTicketLocation";
import { HostedTicketPage } from "@/components/scene/hosted/HostedTicketPage";
import { EventPageAuth } from "@/components/scene/EventPageAuth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your event ticket — SCENE", robots: { index: false, follow: false, noarchive: true }, referrer: "no-referrer" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ticket?: string }> }) {
  const { slug } = await params;
  const id = eventIdFromSlug(slug);
  const event = id === null ? null : await getPublicEventById(id);
  if (!event?.hosted) notFound();
  if (slug !== eventSlug(event)) {
    const token = (await searchParams).ticket;
    redirect(validEventTicketToken(token) ? eventTicketLocation(event, token) : `${eventPath(event)}/ticket`);
  }
  return <EventPageAuth><HostedTicketPage event={{ ...event, hosted: event.hosted }} /></EventPageAuth>;
}
