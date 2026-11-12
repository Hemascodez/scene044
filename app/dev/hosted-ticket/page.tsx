import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CHAPTER_LOUNGE_FIXTURE } from "@/lib/hostedEvents";
import { HostedTicketPage } from "@/components/scene/hosted/HostedTicketPage";
export const metadata: Metadata = { title: "Ticket preview — SCENE", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default function TicketPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <HostedTicketPage event={CHAPTER_LOUNGE_FIXTURE} preview />;
}
