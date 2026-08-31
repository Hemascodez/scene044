import type { Metadata } from "next";
import { CuratorApp } from "@/components/curator/CuratorApp";

/**
 * The curator surface.
 *
 * Access control lives in proxy.ts (HTTP Basic over `/admin/*` and
 * `/api/admin/*`), not in this component — by the time this renders the browser
 * has already authenticated, and it attaches the same header to the API calls
 * the UI makes. There is deliberately no client-side gate: a gate in React only
 * hides UI, it doesn't protect data.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curator — SCENE/044",
  robots: { index: false, follow: false },
};

export default function CuratorPage() {
  return <CuratorApp />;
}
