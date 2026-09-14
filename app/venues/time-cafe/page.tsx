import type { Metadata } from "next";
import { VenueDetail } from "@/components/venues/VenueDetail";

export const metadata: Metadata = {
  title: "Time Cafe Event Venue, Nungambakkam — SCENE/044",
  description: "Request Time Cafe's first-floor event space, terrace, or conversation tables for professional events in Chennai.",
};

interface TimeCafePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

export default async function TimeCafePage({ searchParams }: TimeCafePageProps) {
  const params = await searchParams;
  return <VenueDetail initial={{ date: first(params.date) ?? "", time: first(params.time) ?? "18:00", people: Math.max(1, Number(first(params.people) ?? 25) || 25), eventType: first(params.eventType) ?? "Tech meetup" }} />;
}
