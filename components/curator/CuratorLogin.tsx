"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminBtn, AdminWordmark, TextInput } from "@/components/curator/adminUi";

/**
 * The access-code form.
 *
 * The password is posted once and exchanged for an HttpOnly session cookie —
 * it is never stored in localStorage, never put in a URL, and never readable
 * from JavaScript afterwards. The real check is server-side in
 * /api/admin/login and proxy.ts; this form only collects input.
 */
export function CuratorLogin({ next }: { next: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: code }),
      });
      if (res.ok) {
        // A full document load, not a router push: the cookie has to be
        // presented to proxy.ts on a fresh request for the guarded route.
        window.location.assign(next);
        return;
      }
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? `Sign-in failed (${res.status}).`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a130f] p-6">
      <div className="w-full max-w-sm border border-[#25382e] bg-[#101c16] p-6">
        <AdminWordmark suffix="Curator" />
        <p className="mt-4 text-sm text-[#a9bcb0]">Internal tool. Enter the curator access code.</p>

        <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8ba295]">
              Access code
            </span>
            <TextInput
              type="password"
              name="curator-access-code"
              autoComplete="current-password"
              autoFocus
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder="••••••"
            />
          </label>

          {error && (
            <p className="border border-[#8a3630] bg-[#2a1310] px-3 py-2 text-xs text-[#ff9a8a]" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <AdminBtn type="submit" variant="primary" disabled={!code.trim() || busy}>
              {busy ? "Checking…" : "Enter"}
            </AdminBtn>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 border border-transparent px-3.5 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ba295] transition-colors hover:bg-white/5 hover:text-[#e9efe7]"
            >
              ← Public site
            </Link>
          </div>
        </form>

        <p className="mt-5 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-[#5f7568]">
          Enforced server-side on /admin and /api/admin · session expires after 12 hours
        </p>
      </div>
    </div>
  );
}
