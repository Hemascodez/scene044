"use client";

import { useEffect, useRef, useState } from "react";
import { CATEGORIES } from "@/lib/types";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import { Btn, Mono } from "@/components/scene/ui";

type Kind = "submit" | "report";

const FIELD =
  "w-full border-2 border-foreground bg-background px-3 py-2 text-sm outline-none transition-colors focus:bg-secondary focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background placeholder:text-muted-foreground/60";

/**
 * The community tip desk.
 *
 * Nothing here publishes directly — a tip becomes a `curator_pending`
 * discovery item and goes through the same review, extraction and dedup as
 * anything the crawler found. The copy says so plainly, because promising
 * instant publication and then not delivering is how a feed loses trust.
 */
export function SubmitEventModal({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Kind>("submit");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [categoryHint, setCategoryHint] = useState("");
  const [note, setNote] = useState("");
  const [submitter, setSubmitter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // Same focus trap as the event detail modal — Tab must not escape into
      // the feed behind an open dialog.
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const canSubmit = title.trim().length > 1 && url.trim().length > 3 && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, title, url, categoryHint: categoryHint || null, note, submitter }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (res.ok) setDone(true);
      else setError(body?.error ?? `Couldn't send that (${res.status}).`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Submit or report an event"
        className="scene-rise relative w-full max-w-lg border-2 border-foreground bg-background shadow-[8px_8px_0_0_var(--color-foreground)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-foreground bg-foreground px-4 py-3 text-background">
          <div className="flex items-baseline gap-1.5">
            <Mono className="text-[11px] text-primary">Community desk</Mono>
            <span className="font-display text-lg font-black tracking-tighter">Tip off the scene</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-lg leading-none text-background/70 hover:text-primary"
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="font-display text-6xl font-black tracking-tighter text-primary" aria-hidden>
              ✓
            </span>
            <h3 className="mt-4 font-display text-2xl font-black tracking-tight">Sent to the curators</h3>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              Your {kind === "report" ? "report" : "event"} landed in the curation queue. If it checks
              out, it&apos;ll appear in the feed — vetted, deduplicated and freshness-checked like
              everything else.
            </p>
            <div className="mt-6">
              <Btn variant="solid" onClick={onClose}>
                Back to the scene →
              </Btn>
            </div>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto px-4 py-4">
            <div className="grid grid-cols-2 border-2 border-foreground" role="group" aria-label="Tip type">
              {(["submit", "report"] as Kind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`border-foreground px-3 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors ${
                    k === "report" ? "border-l-2" : ""
                  } ${kind === k ? "bg-primary-ink text-white" : "bg-background hover:bg-secondary"}`}
                >
                  {k === "submit" ? "Submit an event" : "Report an issue"}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {kind === "submit"
                ? "Spotted a Chennai event we missed? Drop the link — a curator vets every tip before it hits the feed."
                : "Something wrong with a listing — wrong date, dead link, duplicate? Tell us where and what."}
            </p>

            <div className="mt-4 space-y-4">
              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">
                  {kind === "submit" ? "Event name *" : "Event / listing *"}
                </Mono>
                <input
                  className={`mt-1.5 ${FIELD}`}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chennai Rust Meetup #4"
                  maxLength={200}
                />
              </label>

              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">
                  {kind === "submit" ? "Link to details *" : "Link *"}
                </Mono>
                <input
                  className={`mt-1.5 ${FIELD}`}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="lu.ma/… · meetup.com/… · linkedin.com/…"
                  inputMode="url"
                  maxLength={500}
                />
              </label>

              {kind === "submit" && (
                <label className="block">
                  <Mono className="text-[10px] text-muted-foreground">Field</Mono>
                  <select
                    className={`mt-1.5 ${FIELD}`}
                    value={categoryHint}
                    onChange={(e) => setCategoryHint(e.target.value)}
                  >
                    <option value="">Not sure / other</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {getFieldCardForCategory(c)?.label ?? c}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">
                  {kind === "submit" ? "Anything else" : "What's wrong"}
                </Mono>
                <textarea
                  className={`mt-1.5 min-h-20 resize-y ${FIELD}`}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={1000}
                  placeholder={
                    kind === "submit"
                      ? "Date, venue, who's organizing, why it matters…"
                      : "Wrong date? Dead link? Already ended?"
                  }
                />
              </label>

              <label className="block">
                <Mono className="text-[10px] text-muted-foreground">Your name or email (optional)</Mono>
                <input
                  className={`mt-1.5 ${FIELD}`}
                  value={submitter}
                  onChange={(e) => setSubmitter(e.target.value)}
                  placeholder="So curators can follow up"
                  maxLength={200}
                />
              </label>
            </div>

            {error && (
              <p
                className="mt-4 border-2 border-primary-ink bg-primary/10 px-3 py-2 text-xs text-primary-ink"
                role="alert"
              >
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t-2 border-foreground pt-4">
              <Mono className="text-[10px] text-muted-foreground">Reviewed by a human before it appears</Mono>
              <Btn
                variant="solid"
                onClick={submit}
                disabled={!canSubmit}
                className="!border-primary !bg-primary !text-primary-foreground hover:!border-foreground hover:!bg-foreground hover:!text-background"
              >
                {busy ? "Sending…" : "Send tip →"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
