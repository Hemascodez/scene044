import Link from "next/link";
import { EventHostingSection } from "@/components/curator/EventHostingSection";
import { AdminWordmark } from "@/components/curator/adminUi";

export const dynamic = "force-dynamic";
export default function EventHostingPage() {
  return (
    <div className="min-h-screen bg-[#0a130f] text-[#e9efe7]">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#25382e] px-4 py-4 lg:px-6">
        <AdminWordmark suffix="Event hosting · internal" />
        <Link
          className="min-h-11 py-3 text-sm text-[#5effb0] underline"
          href="/admin/curator"
        >
          ← Events curator
        </Link>
      </header>
      <main className="mx-auto max-w-5xl">
        <EventHostingSection />
      </main>
    </div>
  );
}
