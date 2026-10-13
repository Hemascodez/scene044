import type { Metadata } from "next";
import Link from "next/link";
import { SceneHeaderStatic } from "@/components/scene/SceneHeader";
import { SceneFooter } from "@/components/scene/SceneHero";

export const metadata: Metadata = {
  title: "Delete your account — SCENE/044",
  description: "Request deletion of your SCENE/044 account and associated data.",
};

const requestEmail = "mailto:uhema2011@gmail.com?subject=SCENE%2F044%20account%20deletion%20request&body=Please%20delete%20my%20SCENE%2F044%20account%20and%20associated%20data.%20I%20can%20confirm%20the%20phone%20number%20used%20to%20sign%20in.%20Please%20tell%20me%20if%20any%20records%20must%20be%20retained.";

export default function DeleteAccountPage() {
  return (
    <div className="min-h-full">
      <SceneHeaderStatic />
      <main className="mx-auto max-w-2xl px-4 py-12 lg:px-6">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">Account and data</p>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight tracking-tighter">Delete your SCENE/044 account</h1>
        <div className="prose-scene mt-8 space-y-6 text-sm leading-relaxed">
          <p>To request deletion of an organiser or host account, send us an email using the button below. You can do this in a browser even if you have uninstalled the app or cannot sign in. We will reply to verify that the request comes from the account owner.</p>
          <a href={requestEmail} className="inline-flex min-h-11 items-center border-2 border-black bg-[#ff3b28] px-5 py-3 font-bold text-white shadow-[4px_4px_0_#111]">Email an account deletion request</a>
          <p>If the button does not open your email app, write to <a className="underline underline-offset-2" href="mailto:uhema2011@gmail.com">uhema2011@gmail.com</a> with the subject “SCENE/044 account deletion request”. Please do not include a one-time sign-in code or payment card details.</p>
          <section>
            <h2 className="font-display text-xl font-bold">What happens next</h2>
            <p className="mt-2">After verifying ownership, we will remove your account, profile photo, saved booking drafts and sign-in sessions, and delete or de-identify associated data that is no longer needed. Some booking and payment records may need to be kept for accounting, tax, fraud prevention, disputes, or other legal obligations. We will explain any such retention in our reply.</p>
          </section>
          <p>Read our <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link> for more about how SCENE/044 uses your information.</p>
        </div>
      </main>
      <SceneFooter />
    </div>
  );
}
