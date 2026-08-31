import type { Metadata } from "next";
import { CuratorLogin } from "@/components/curator/CuratorLogin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Curator sign-in — SCENE/044",
  robots: { index: false, follow: false },
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string }>;
}

export default async function CuratorLoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  // Only ever redirect back into the admin area. Accepting an arbitrary `next`
  // would turn this page into an open redirect.
  const destination = typeof next === "string" && /^\/admin\/[\w/-]*$/.test(next) ? next : "/admin/curator";
  return <CuratorLogin next={destination} />;
}
