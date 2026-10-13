import type { Metadata } from "next";
import Link from "next/link";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { SceneFooter } from "@/components/scene/SceneHero";

export const metadata: Metadata = {
  title: "Privacy Policy — SCENE/044",
  description: "How SCENE/044 handles event, venue, booking and account information.",
};

const CONTACT_EMAIL = "uhema2011@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <main className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
        <h1 className="font-display text-4xl font-black leading-tight tracking-tighter">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Last updated 13 October 2026</p>
        <div className="prose-scene mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold">Who we are</h2>
            <p className="mt-2">SCENE/044 helps people discover Chennai events and request physical event spaces. You can browse listings without signing in. You need a verified account to request and manage a venue booking. Contact us about privacy at <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Information we handle</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li><strong>Account and verification:</strong> name, Indian mobile number, optional email, account role, verified sign-in sessions and, if you add one, a profile photo.</li>
              <li><strong>Venue requests and bookings:</strong> selected space and time, guest count, event type, message, optional social or website link, booking status, check-in and order history. We keep a booking reference and records of payments and refunds where applicable.</li>
              <li><strong>Host and partner details:</strong> approved host numbers, venue listing information, photos, pricing, and venue submissions you choose to send us.</li>
              <li><strong>Reviews:</strong> your rating, written feedback, optional photos and the name shown with your review, subject to review moderation.</li>
              <li><strong>Alerts:</strong> your phone number and chosen interests if you opt in to WhatsApp updates, or your email and preferences if you subscribe to email alerts.</li>
              <li><strong>Usage:</strong> browser storage for saved events and unfinished booking forms, aggregate event click counts, and website analytics. Our own event click counter does not store your IP address with the click.</li>
            </ul>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">How we use it</h2>
            <p className="mt-2">We verify sign-ins, deliver booking requests to the selected venue, manage approvals, payments and check-in, display approved reviews, answer support requests, operate venue listings, send service messages about your booking, and send optional event alerts when you choose them. Hosts see the booking details needed to handle requests for their own venue. Curators see information needed to run the service.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Services involved</h2>
            <p className="mt-2">Railway hosts our application and database. Meta/WhatsApp delivers verification codes and booking or alert messages. Razorpay processes venue payments; we receive payment references and status, not your full card details. Google Analytics measures use of the website, and Google Maps loads only when you open a venue map. A host who chooses to scan a check-in QR grants the browser camera access for that scan; the video feed is not stored by SCENE/044. External event registration pages and payment providers have their own privacy practices.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Security and retention</h2>
            <p className="mt-2">We use encrypted connections, restricted staff and host access, and protected sign-in sessions. We keep account and booking information while it is needed to provide the service. You can clear saved events and local drafts in your browser. On a verified deletion request, we remove account data that is no longer needed; we may retain payment and booking records where necessary for tax, accounting, fraud prevention, disputes, or other legal obligations. We do not sell your personal information.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Your choices and deletion</h2>
            <p className="mt-2">You can edit your account information in your profile. You can stop optional WhatsApp alerts by replying to opt out, and email alerts through their unsubscribe link. To ask for access, correction or deletion of your account and associated data, visit <Link href="/account/delete" className="underline underline-offset-2">Delete your SCENE/044 account</Link> or email <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We will verify account ownership and explain any records we must retain.</p>
          </section>
          <section>
            <h2 className="font-display text-xl font-bold">Contact</h2>
            <p className="mt-2">For any privacy question or request, write to <a className="underline underline-offset-2" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </section>
        </div>
      </main>
      <SceneFooter />
    </div>
  );
}
