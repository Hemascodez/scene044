import type { Metadata } from "next";
import Link from "next/link";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { SceneFooter } from "@/components/scene/SceneHero";

export const metadata: Metadata = {
  title: "Terms of Use — SCENE",
  description: "The terms for using SCENE to discover events and request venues.",
};

export default function TermsPage() {
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <main className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
        <h1 className="font-display text-4xl font-black leading-tight tracking-tighter">Terms of Use</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Last updated 12 November 2026</p>
        <div className="prose-scene mt-8 space-y-8 text-sm leading-relaxed">
          <section><h2 className="font-display text-xl font-bold">Using SCENE</h2><p className="mt-2">SCENE lists Chennai events and helps organisers request physical venues. Event information comes from third-party sources; check dates, eligibility, and ticket terms on the organiser’s own page. Use accurate information when making a venue request or publishing a review. You must be legally able to enter into a booking.</p></section>
          <section><h2 className="font-display text-xl font-bold">Venue requests and payments</h2><p className="mt-2">Sending a request does not reserve or confirm a space. A venue host must approve the request first. The app shows the amount to pay before checkout; payment is collected through Razorpay after approval. Your booking is confirmed when payment is successfully verified and the app shows a confirmed status. Venue capacity, amenities, hours, food, and setup are subject to the specific listing and host confirmation.</p></section>
          <section><h2 className="font-display text-xl font-bold">SCENE-hosted event tickets</h2><p className="mt-2">Events marked “SCENE hosted” accept registration and payment on SCENE. The event page shows its price, organiser, terms and refund policy before checkout. A pending order or waitlist entry is not a confirmed ticket; a ticket is issued after payment is verified and a seat is available. Your confirmed tickets appear in My bookings. Optional WhatsApp updates require your consent. If payment was taken but no ticket appears, contact SCENE with the payment reference before paying again. Event cancellations and refund requests are handled by SCENE and the organiser under the event’s published terms.</p></section>
          <section><h2 className="font-display text-xl font-bold">Cancellations and venue rules</h2><p className="mt-2">Check the venue’s published house rules and cancellation terms before booking. Any applicable refund depends on those terms and the booking’s payment state. Contact us if a payment is captured but your booking status does not update. Hosts may decline a request, and organisers may withdraw it before payment where the booking flow allows.</p></section>
          <section><h2 className="font-display text-xl font-bold">Accounts and content</h2><p className="mt-2">Keep your WhatsApp verification code and ticket links private. Approved hosts may access only the venues or events assigned to their number. Do not submit misleading reviews, content you do not have permission to use, or photos of others without the necessary permission. We may moderate reviews and venue submissions to keep listings accurate.</p></section>
          <section><h2 className="font-display text-xl font-bold">Questions and data</h2><p className="mt-2">For support, payment questions, or a dispute, contact <a className="underline underline-offset-2" href="mailto:uhema2011@gmail.com">uhema2011@gmail.com</a> and include the booking reference if you have one. Our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link> explains how we handle personal information, and our <Link href="/account/delete" className="underline underline-offset-2">account deletion page</Link> explains how to request removal.</p></section>
        </div>
      </main>
      <SceneFooter />
    </div>
  );
}
