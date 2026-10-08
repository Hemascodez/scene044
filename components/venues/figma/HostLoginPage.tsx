'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AuthModal from './AuthModal';
import { useVenueApp } from './VenueApp';

export default function HostLoginPage() {
  const router = useRouter();
  const { profile } = useVenueApp();
  const [open, setOpen] = useState(false);
  return <main className="mx-auto max-w-xl px-5 py-16 text-ink">
    <h1 className="font-display text-3xl font-bold">Host sign-in</h1>
    <p className="mt-4 leading-7">Use your approved mobile number. We’ll verify it with a code on WhatsApp.</p>
    <p className="mt-3 leading-7 text-stone">Contact your venue admin to add your number to sign in.</p>
    <button className="mt-6 border-2 border-ink bg-primary px-5 py-3 font-bold text-ink shadow-hard focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink" onClick={() => setOpen(true)}>Sign in with WhatsApp</button>
    <Link className="mt-6 block underline" href="/venues">Back to venues</Link>
    <AuthModal open={open} saved={profile} initialRole="Host" onClose={() => setOpen(false)} onVerified={(p) => {
      setOpen(false);
      window.dispatchEvent(new Event('scene044:venue-auth-changed'));
      router.replace(p.role === 'Host' ? '/host' : '/venues');
      router.refresh();
    }} />
  </main>;
}
