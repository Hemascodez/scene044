import type { Metadata } from "next";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { SceneFooter } from "@/components/scene/SceneHero";

export const metadata: Metadata = {
  title: "Privacy Policy — SCENE/044",
  description: "What SCENE/044 collects, why, and how to have it removed.",
};

const LAST_UPDATED = "8 September 2026";
const CONTACT_EMAIL = "uhema2011@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />

      <main className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
        <h1 className="font-display text-4xl font-black leading-tight tracking-tighter">Privacy Policy</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          Last updated {LAST_UPDATED}
        </p>

        <div className="prose-scene mt-8 space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="font-display text-xl font-bold">What SCENE/044 is</h2>
            <p className="mt-2">
              SCENE/044 is a discovery feed for Chennai&apos;s professional and technology events. It
              automatically finds events from public sources (LinkedIn, Meetup, Luma, Eventbrite, community
              pages, and others) and lists them in one place. We never own registration — every listing links
              to the organizer&apos;s original page, and you register there, not with us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">There is no account</h2>
            <p className="mt-2">
              You can browse the entire feed, filter by category, and open any event without giving us
              anything. There is no sign-up, no password, and no profile.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">What we collect, and only when you opt in</h2>

            <h3 className="mt-4 font-semibold">Saved events (shortlist)</h3>
            <p className="mt-1">
              Tapping the save icon on an event stores its ID in your own browser&apos;s local storage. This
              never reaches our servers — it lives only on your device, and clearing your browser data
              clears it.
            </p>

            <h3 className="mt-4 font-semibold">WhatsApp event alerts</h3>
            <p className="mt-1">
              If you tap &quot;Get Scened&quot; and send us the pre-filled WhatsApp message, we receive your
              phone number and whatever you chose to include in that message (a name, your role, and the
              topics you&apos;re interested in). Sending that message is how you opt in — we never ask for a
              phone number in a form, and we never message a number that hasn&apos;t messaged us first. We use
              this only to send you Chennai tech event updates and to reply to that message. You can stop
              this at any time by blocking the number or messaging us to say so.
            </p>

            <h3 className="mt-4 font-semibold">Email alerts (if offered)</h3>
            <p className="mt-1">
              If you sign up for email alerts, we store the email address and the categories you selected.
              Every email includes an unsubscribe link tied to a unique token — clicking it removes you
              immediately, no login required.
            </p>

            <h3 className="mt-4 font-semibold">Anonymous click counts</h3>
            <p className="mt-1">
              When you tap through to an event&apos;s original source, we log that a click happened for that
              event so we can tell which listings are useful. We do not store your IP address, device
              information, or any other identifier alongside that click — just a count against the event.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Third parties we use</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>
                <strong>Meta / WhatsApp Business Platform</strong> — carries WhatsApp messages between you and
                us. Subject to{" "}
                <a
                  href="https://www.whatsapp.com/legal/privacy-policy"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp&apos;s own privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Google Analytics</strong> — standard, pseudonymous web analytics on page views. It
                does not receive your name, email, or phone number. See{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google&apos;s privacy policy
                </a>
                .
              </li>
              <li>
                <strong>Railway, Supabase</strong> — host the app and its database. Neither is given access to
                your data beyond running the infrastructure.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">How long we keep it</h2>
            <p className="mt-2">
              WhatsApp and email opt-ins are kept until you unsubscribe or ask us to delete them, at which
              point the row is marked inactive rather than immediately erased (so we don&apos;t accidentally
              re-add you later) — email us if you want it fully deleted instead. Anonymous click counts are
              kept indefinitely, since they carry no personal information to begin with.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Your rights</h2>
            <p className="mt-2">
              You can ask us what we hold about your phone number or email, ask us to correct it, or ask us to
              delete it entirely, at any time, by emailing the address below.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl font-bold">Contact</h2>
            <p className="mt-2">
              Questions about this policy, or a request to see/delete your data:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <SceneFooter />
    </div>
  );
}
