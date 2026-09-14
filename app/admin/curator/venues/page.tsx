import type { Metadata } from "next";
import { VenueCuratorApp } from "@/components/curator/VenueCuratorApp";

/** Same access model as /admin/curator: proxy.ts gates the whole /admin/*
 *  and /api/admin/* space, so there is no client-side guard here either. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Venue curator — SCENE/044",
  robots: { index: false, follow: false },
};

export default function VenueCuratorPage() {
  return <VenueCuratorApp />;
}
