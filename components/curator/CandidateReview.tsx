"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PublicEvent } from "@/lib/events";
import { CATEGORIES, type Category, type EventStatus } from "@/lib/types";
import { FIELD_CARDS, getFieldCardForCategory } from "@/lib/fieldCards";
import { stockPosterFor } from "@/lib/stockPosters";
import { eventPath } from "@/lib/seo";
import {
  draftToInstant,
  draftWarnings,
  emptyCuratorDraft,
  instantToDraftParts,
  validateDraftForPublish,
  type CuratorDraft,
} from "@/lib/curatorDraft";
import {
  checkDuplicate,
  CuratorApiError,
  publishEvent,
  rejectItem,
  runExtraction,
  saveDraft,
  type DedupResult,
  type PreviewResult,
  type QueueItem,
} from "@/lib/client/curatorApi";
import { relativeChecked } from "@/lib/client/istTime";
import { EventCard } from "@/components/scene/EventCard";
import {
  AdminBtn,
  AdminLabel,
  AdminLink,
  Divider,
  Field,
  Pill,
  Select,
  TextArea,
  TextInput,
} from "@/components/curator/adminUi";

const REJECT_REASONS = [
  "Not an event",
  "Not Chennai-relevant",
  "Already expired",
  "Duplicate",
  "Insufficient information",
  "Suspicious source",
  "Other",
] as const;

const STATUS_OPTIONS: { value: Extract<EventStatus, "live" | "postponed" | "cancelled" | "expired">; label: string }[] = [
  { value: "live", label: "Confirmed / live" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Past / expired" },
];

function isLinkedIn(domain: string): boolean {
  return domain === "linkedin.com" || domain.endsWith(".linkedin.com");
}

/**
 * Builds the exact object the public card renders, so the preview is the real
 * component with real props rather than a lookalike that can drift.
 */
function draftToPublicEvent(draft: CuratorDraft, item: QueueItem): PublicEvent {
  return {
    id: item.id,
    title: draft.title || "Untitled event",
    summary: draft.summary || null,
    // Curator-entered events skip the summarizer pass, so there are no
    // highlights to show — an empty list renders nothing, which is correct.
    highlights: [],
    registrationNote: null,
    category: (draft.category || "tech") as Category,
    startAt: draftToInstant(draft.startDate, draft.startTime),
    endAt: draftToInstant(draft.endDate, draft.endTime),
    isOnline: draft.isOnline,
    venueName: draft.venueName || null,
    city: "Chennai",
    organizerName: draft.organizerName || null,
    posterImageUrl: draft.posterImageUrl || null,
    priceType: draft.priceType || null,
    priceNote: draft.priceNote || null,
    primarySourceDomain: item.source_domain,
    otherSourceDomains: [],
    // The preview renders the PUBLIC card, and an expired event is never
    // public — show it as it would look while still live.
    status: draft.status === "expired" ? "live" : draft.status,
    discoveredAt: item.discovered_at,
    lastVerifiedAt: new Date().toISOString(),
  };
}

export function CandidateReview({
  item,
  onDone,
  onCancel,
  onDirtyChange,
}: {
  item: QueueItem;
  onDone: (message: string, href?: string) => void;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<CuratorDraft>(item.curator_draft ?? emptyCuratorDraft());
  const [started, setStarted] = useState(Boolean(item.curator_draft));
  const [dirty, setDirty] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<PreviewResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [relevance, setRelevance] = useState(0.8);
  const [dedup, setDedup] = useState<DedupResult | null>(null);
  const [dedupBusy, setDedupBusy] = useState(false);
  const [busy, setBusy] = useState<null | "publish" | "save" | "reject">(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState<(typeof REJECT_REASONS)[number]>(
    "Insufficient information",
  );
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const linkedIn = isLinkedIn(item.source_domain);
  const errors = validateDraftForPublish(draft);
  const warnings = draftWarnings(draft);
  const preview = useMemo(() => draftToPublicEvent(draft, item), [draft, item]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  function set<K extends keyof CuratorDraft>(key: K, value: CuratorDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  async function extract() {
    setExtracting(true);
    setExtractError(null);
    try {
      const result = await runExtraction(item.id);
      setExtraction(result);

      if (result.skippedFetch) {
        setStarted(true);
        setExtractError(
          "LinkedIn is never fetched server-side. Open the post yourself and fill the fields in manually.",
        );
        return;
      }
      if (!result.extracted) {
        setStarted(true);
        setExtractError("Nothing could be extracted from that page. Fill the fields in manually.");
        return;
      }

      const e = result.extracted;
      const start = instantToDraftParts(e.startAt);
      const end = instantToDraftParts(e.endAt);
      setDraft((prev) => ({
        ...prev,
        title: e.title ?? prev.title,
        summary: e.summary ?? prev.summary,
        category: result.categorization?.category ?? prev.category,
        startDate: start.date || prev.startDate,
        startTime: start.time || prev.startTime,
        endDate: end.date || prev.endDate,
        endTime: end.time || prev.endTime,
        isOnline: e.isOnline,
        venueName: e.venueName ?? prev.venueName,
        venueAddress: e.venueAddress ?? prev.venueAddress,
        organizerName: e.organizerName ?? prev.organizerName,
        // Keep a curator-entered poster over an auto-found one.
        posterImageUrl: prev.posterImageUrl || e.posterImageUrl || "",
        priceType: prev.priceType || e.priceType || "",
        priceNote: prev.priceNote || e.priceNote || "",
      }));
      if (result.categorization) setRelevance(result.categorization.chennaiRelevanceScore);
      setStarted(true);
      setDirty(true);
    } catch (err) {
      setExtractError(err instanceof CuratorApiError ? err.message : "Extraction request failed.");
      setStarted(true);
    } finally {
      setExtracting(false);
    }
  }

  const dedupInput = useMemo(
    () => ({
      title: draft.title.trim(),
      startAt: draftToInstant(draft.startDate, draft.startTime),
      isOnline: draft.isOnline,
      venueName: draft.venueName || null,
      organizerName: draft.organizerName || null,
      category: draft.category as Category,
      url: draft.registrationUrl.trim() || item.url,
    }),
    [draft, item.url],
  );

  const canDedup = !!draft.title.trim() && !!draft.category;

  const runDedup = useCallback(async () => {
    if (!canDedup) return;
    setDedupBusy(true);
    try {
      setDedup(await checkDuplicate(dedupInput));
    } catch {
      setDedup(null);
    } finally {
      setDedupBusy(false);
    }
  }, [canDedup, dedupInput]);

  // Debounced so typing a title doesn't fire a dedup query per keystroke.
  useEffect(() => {
    if (!started || !canDedup) return;
    const t = setTimeout(runDedup, 600);
    return () => clearTimeout(t);
  }, [started, canDedup, runDedup]);

  async function publish() {
    if (errors.length) return;
    setBusy("publish");
    setActionError(null);
    try {
      const res = await publishEvent({
        discoveryItemId: item.id,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        category: draft.category as Category,
        startAt: draftToInstant(draft.startDate, draft.startTime),
        endAt: draftToInstant(draft.endDate, draft.endTime),
        isOnline: draft.isOnline,
        venueName: draft.venueName.trim() || null,
        venueAddress: draft.venueAddress.trim() || null,
        organizerName: draft.organizerName.trim() || null,
        posterImageUrl: draft.posterImageUrl.trim() || null,
        priceType: draft.priceType || null,
        priceNote: draft.priceNote.trim() || null,
        primarySourceUrl: draft.registrationUrl.trim() || null,
        status: draft.status,
        chennaiRelevanceScore: relevance,
      });
      setDirty(false);
      onDone(
        res.status === "duplicate"
          ? `Merged into existing event #${res.eventId} — source added, no second card created`
          : `Published “${draft.title.trim()}” to the public feed`,
        eventPath({ id: res.eventId, title: draft.title.trim() }),
      );
    } catch (err) {
      setActionError(err instanceof CuratorApiError ? err.message : "Publish failed.");
    } finally {
      setBusy(null);
    }
  }

  async function park() {
    setBusy("save");
    setActionError(null);
    try {
      await saveDraft(item.id, draft);
      setDirty(false);
      onDone("Saved — parked under “Needs correction”");
    } catch (err) {
      setActionError(err instanceof CuratorApiError ? err.message : "Save failed.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmReject() {
    setBusy("reject");
    setActionError(null);
    try {
      await rejectItem(item.id, rejectNote.trim() ? `${rejectReason}: ${rejectNote.trim()}` : rejectReason);
      setDirty(false);
      onDone(`Rejected — ${rejectReason}`);
    } catch (err) {
      setActionError(err instanceof CuratorApiError ? err.message : "Reject failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-0 lg:grid-cols-2 lg:divide-x lg:divide-[#25382e]">
      {/* LEFT — source context and extraction */}
      <div className="flex flex-col gap-5 p-5 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          {linkedIn ? (
            <Pill tone="blue" glyph="↗">
              LinkedIn source
            </Pill>
          ) : (
            <Pill tone="muted" glyph="◈">
              {item.source_domain}
            </Pill>
          )}
          {item.origin === "curator" && (
            <Pill tone="muted" glyph="+">
              Curator-added
            </Pill>
          )}
          <Pill tone="amber" glyph="⚠">
            External · verify manually
          </Pill>
        </div>

        <div>
          <AdminLabel>Original search result</AdminLabel>
          <h3 className="mt-1.5 font-display text-lg font-bold leading-tight text-[#e9efe7]">
            {item.title ?? "Untitled candidate"}
          </h3>
          {item.snippet && <p className="mt-2 text-sm leading-relaxed text-[#a9bcb0]">{item.snippet}</p>}
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 font-mono text-[11px]">
          <dt className="uppercase tracking-[0.12em] text-[#5f7568]">Source</dt>
          <dd className="break-all text-[#a9bcb0]">{item.url}</dd>
          <dt className="uppercase tracking-[0.12em] text-[#5f7568]">Query</dt>
          <dd className="text-[#a9bcb0]">{item.query_text ?? "— curator-added —"}</dd>
          <dt className="uppercase tracking-[0.12em] text-[#5f7568]">Found</dt>
          <dd className="text-[#a9bcb0]">{relativeChecked(item.discovered_at)}</dd>
          {item.rejection_reason && (
            <>
              <dt className="uppercase tracking-[0.12em] text-[#5f7568]">Note</dt>
              <dd className="text-[#ffcf7a]">{item.rejection_reason}</dd>
            </>
          )}
        </dl>

        <AdminLink href={item.url} variant="outline" className="self-start">
          {linkedIn ? "Open LinkedIn ↗" : "Open source ↗"}
        </AdminLink>

        <Divider />

        <div className="flex flex-col gap-3">
          <AdminLabel>Extraction</AdminLabel>
          <p className="text-sm leading-relaxed text-[#a9bcb0]">
            {linkedIn
              ? "LinkedIn is never fetched by the server. Open the post yourself and enter the details by hand."
              : "The server fetches this page (SSRF-guarded), reads JSON-LD if present, and falls back to the model only when it isn't. Page text is treated as data, never as instructions."}
          </p>

          <div className="flex flex-wrap gap-2">
            <AdminBtn variant="primary" onClick={extract} disabled={extracting || linkedIn}>
              {extracting ? "Extracting…" : extraction ? "Re-run extraction" : "Run extraction"}
            </AdminBtn>
            {!started && (
              <AdminBtn variant="ghost" onClick={() => setStarted(true)}>
                Enter manually →
              </AdminBtn>
            )}
          </div>

          {extractError && (
            <p className="border border-[#8a6a1e] bg-[#2a2110] px-3 py-2 text-xs text-[#ffcf7a]" role="alert">
              {extractError}
            </p>
          )}

          {extraction?.extracted && (
            <div className="flex flex-col gap-2 border border-[#25382e] bg-[#0d1813] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill
                  tone={extraction.extracted.sourceMethod === "json_ld" ? "green" : "amber"}
                  glyph={extraction.extracted.sourceMethod === "json_ld" ? "◆" : "◐"}
                >
                  {extraction.extracted.sourceMethod === "json_ld" ? "Structured JSON-LD" : "Model-inferred"}
                </Pill>
                <span className="font-mono text-[10px] text-[#8ba295]">
                  confidence {Math.round(extraction.extracted.confidence * 100)}%
                </span>
                {extraction.validation && !extraction.validation.valid && (
                  <Pill tone="red" glyph="!">
                    {extraction.validation.reason?.replace(/_/g, " ")}
                  </Pill>
                )}
              </div>
              {extraction.extracted.dateEvidence && (
                <p className="font-mono text-[10px] leading-relaxed text-[#8ba295]">
                  <span className="text-[#5f7568]">DATE EVIDENCE:</span> “{extraction.extracted.dateEvidence}”
                </p>
              )}
              {extraction.extracted.venueEvidence && (
                <p className="font-mono text-[10px] leading-relaxed text-[#8ba295]">
                  <span className="text-[#5f7568]">VENUE EVIDENCE:</span> “{extraction.extracted.venueEvidence}”
                </p>
              )}
            </div>
          )}

          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f7568]">
            Human verification, machine formatting · never auto-published
          </p>
        </div>
      </div>

      {/* RIGHT — structured form, dedup, preview, actions */}
      <div className="flex flex-col gap-6 bg-[#0d1813] p-5 lg:p-6">
        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 border border-dashed border-[#2c4236] py-16 text-center">
            <span className="font-display text-5xl font-black text-[#25382e]" aria-hidden>
              044
            </span>
            <p className="max-w-xs text-sm text-[#8ba295]">
              Run extraction to prefill the fields, or enter them manually.
            </p>
          </div>
        ) : (
          <>
            {warnings.length > 0 && (
              <div className="border border-[#8a6a1e] bg-[#221b0e] p-3">
                <AdminLabel>Worth a look before publishing</AdminLabel>
                <ul className="mt-2 flex flex-col gap-1">
                  {warnings.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-xs text-[#ffcf7a]">
                      <span aria-hidden>⚠</span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <AdminLabel>Structured event</AdminLabel>

              <Field label="Event title" required>
                <TextInput ref={titleRef} value={draft.title} onChange={(e) => set("title", e.target.value)} />
              </Field>

              <Field label="Summary" hint="Shown in the event detail view">
                <TextArea rows={3} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Category" required>
                  <Select
                    value={draft.category}
                    onChange={(e) => set("category", e.target.value as CuratorDraft["category"])}
                  >
                    <option value="">— select —</option>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {getFieldCardForCategory(c)?.label ?? c} ({c})
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Format">
                  <div className="flex h-full items-center">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-[#e9efe7]">
                      <input
                        type="checkbox"
                        checked={draft.isOnline}
                        onChange={(e) => set("isOnline", e.target.checked)}
                        className="size-4 accent-[#39ff9b]"
                      />
                      Online event
                    </label>
                  </div>
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Start date (IST)" required>
                  <TextInput type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </Field>
                <Field label="Start time (IST)">
                  <TextInput type="time" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="End date" hint="Optional">
                  <TextInput type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} />
                </Field>
                <Field label="End time" hint="Optional">
                  <TextInput type="time" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} />
                </Field>
              </div>

              {!draft.isOnline && (
                <>
                  <Field label="Venue name">
                    <TextInput
                      value={draft.venueName}
                      onChange={(e) => set("venueName", e.target.value)}
                      placeholder="e.g. TIDEL Park Auditorium"
                    />
                  </Field>
                  <Field label="Venue address" hint="Free text — used for Chennai-area matching">
                    <TextInput value={draft.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} />
                  </Field>
                </>
              )}

              <Field label="Organizer name">
                <TextInput value={draft.organizerName} onChange={(e) => set("organizerName", e.target.value)} />
              </Field>

              <Field
                label="Registration URL"
                hint="Becomes the public “View event” destination. Blank = the discovery URL above."
              >
                <TextInput
                  value={draft.registrationUrl}
                  onChange={(e) => set("registrationUrl", e.target.value)}
                  placeholder={item.url}
                />
              </Field>

              <PosterField
                value={draft.posterImageUrl}
                category={draft.category}
                onChange={(next) => set("posterImageUrl", next)}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Price"
                  hint="Only set this if the page actually says so — “Not stated” is the honest default"
                >
                  <Select
                    value={draft.priceType}
                    onChange={(e) => set("priceType", e.target.value as CuratorDraft["priceType"])}
                  >
                    <option value="">Not stated</option>
                    <option value="free">Free to attend</option>
                    <option value="paid">Paid</option>
                  </Select>
                </Field>
                {draft.priceType === "paid" ? (
                  <Field label="Price note" hint="As written on the page, e.g. ₹499">
                    <TextInput
                      value={draft.priceNote}
                      onChange={(e) => set("priceNote", e.target.value)}
                      placeholder="₹499"
                    />
                  </Field>
                ) : (
                  <div />
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Publish as">
                  <Select
                    value={draft.status}
                    onChange={(e) => set("status", e.target.value as CuratorDraft["status"])}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Chennai relevance" hint={`${Math.round(relevance * 100)}% — from categorization`}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={relevance}
                    onChange={(e) => setRelevance(Number(e.target.value))}
                    className="mt-2 w-full accent-[#39ff9b]"
                  />
                </Field>
              </div>
            </div>

            <Divider />

            <DedupPanel result={dedup} busy={dedupBusy} canRun={canDedup} onRun={runDedup} />

            <Divider />

            <div className="flex flex-col gap-3">
              <AdminLabel>Public card preview — the real component</AdminLabel>
              <div className="bg-[#f4f2ea] p-5 text-[#14130d]">
                <EventCard event={preview} saved={false} onToggleSave={() => {}} />
              </div>
            </div>

            <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-[#25382e] bg-[#0d1813]/95 px-5 py-4 backdrop-blur lg:-mx-6 lg:-mb-6 lg:px-6">
              {errors.length > 0 && (
                <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Blocking problems">
                  {errors.map((e) => (
                    <li
                      key={e}
                      className="border border-[#5a3230] bg-[#221011] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#ff9a8a]"
                    >
                      {e}
                    </li>
                  ))}
                </ul>
              )}
              {actionError && (
                <p className="mb-3 border border-[#8a3630] bg-[#2a1310] px-3 py-2 text-xs text-[#ff9a8a]" role="alert">
                  {actionError}
                </p>
              )}

              {rejecting ? (
                <div className="flex flex-col gap-3">
                  <Field label="Rejection reason" required>
                    <Select
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value as (typeof REJECT_REASONS)[number])}
                    >
                      {REJECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <TextInput
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Optional note (kept in the audit trail)"
                  />
                  <div className="flex gap-2">
                    <AdminBtn variant="danger" onClick={confirmReject} disabled={busy === "reject"}>
                      {busy === "reject" ? "Rejecting…" : "Confirm reject"}
                    </AdminBtn>
                    <AdminBtn variant="ghost" onClick={() => setRejecting(false)}>
                      Back
                    </AdminBtn>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <AdminBtn
                    variant="primary"
                    onClick={publish}
                    disabled={errors.length > 0 || busy !== null}
                    title={errors.length > 0 ? "Fix the blocking problems first" : undefined}
                  >
                    {busy === "publish" ? "Publishing…" : "Publish event"}
                  </AdminBtn>
                  <AdminBtn variant="outline" onClick={park} disabled={busy !== null}>
                    {busy === "save" ? "Saving…" : "Save · needs correction"}
                  </AdminBtn>
                  <AdminBtn variant="danger" onClick={() => setRejecting(true)} disabled={busy !== null}>
                    Reject
                  </AdminBtn>
                  <AdminBtn variant="ghost" onClick={onCancel} className="ml-auto">
                    Cancel
                  </AdminBtn>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Poster controls.
 *
 * Three ways in, in the order the pipeline tries them:
 *   1. auto — extraction already found and re-hosted one (field arrives filled)
 *   2. upload — the curator picks a file off disk
 *   3. import — the curator pastes an image URL, which the server re-hosts
 *
 * Uploaded and imported images are both stored on our own origin, so a card
 * never depends on someone else's CDN staying up. Leaving it blank is a valid
 * choice: the card falls back to the category Scene image.
 */
function PosterField({
  value,
  category,
  onChange,
}: {
  value: string;
  category: CuratorDraft["category"];
  onChange: (next: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function send(init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/curator/poster", { method: "POST", ...init });
      const body = (await res.json().catch(() => null)) as
        | { url?: string; error?: string }
        | null;
      if (res.ok && body?.url) {
        onChange(body.url);
        setShowImport(false);
        setImportUrl("");
      } else {
        setError(body?.error ?? `Upload failed (${res.status}).`);
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function upload(file: File | null) {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    // No Content-Type header — the browser must set the multipart boundary.
    void send({ body: form });
  }

  const sceneFallback = category ? stockPosterFor(category as Category, 0) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <AdminLabel>Event poster — optional</AdminLabel>
        {busy && <span className="font-mono text-[10px] text-[#39ff9b]">Processing…</span>}
      </div>

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- poster may be
              on our own origin or a remote host the curator chose */}
          <img
            src={value}
            alt="Poster preview"
            className="h-20 w-32 border border-[#2c4236] object-cover"
          />
          <div className="flex flex-col gap-2">
            <AdminBtn variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              Replace
            </AdminBtn>
            <AdminBtn variant="ghost" onClick={() => onChange("")} disabled={busy}>
              Remove
            </AdminBtn>
          </div>
          <p className="w-full break-all font-mono text-[9px] uppercase tracking-[0.1em] text-[#5f7568]">
            {value}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <AdminBtn variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              Upload image
            </AdminBtn>
            <AdminBtn variant="outline" onClick={() => setShowImport((v) => !v)} disabled={busy}>
              Import URL
            </AdminBtn>
            {sceneFallback && (
              <AdminBtn variant="ghost" onClick={() => onChange(sceneFallback)} disabled={busy}>
                Use SCENE/044 image
              </AdminBtn>
            )}
          </div>
          {showImport && (
            <div className="flex gap-2">
              <TextInput
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                aria-label="Poster image URL"
                placeholder="https://…/poster.jpg"
              />
              <AdminBtn
                variant="primary"
                disabled={!importUrl.trim() || busy}
                onClick={() =>
                  void send({
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ url: importUrl.trim() }),
                  })
                }
              >
                Fetch
              </AdminBtn>
            </div>
          )}
        </>
      )}

      {error && (
        <p className="border border-[#8a3630] bg-[#2a1310] px-3 py-2 text-xs text-[#ff9a8a]" role="alert">
          {error}
        </p>
      )}

      <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-[#5f7568]">
        JPG · PNG · WebP · max 5 MB · SVG rejected · re-hosted on our own origin · blank = category
        Scene image
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => upload(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function DedupPanel({
  result,
  busy,
  canRun,
  onRun,
}: {
  result: DedupResult | null;
  busy: boolean;
  canRun: boolean;
  onRun: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <AdminLabel>Deduplication</AdminLabel>
        <AdminBtn variant="ghost" onClick={onRun} disabled={!canRun || busy}>
          {busy ? "Checking…" : "Re-check"}
        </AdminBtn>
      </div>

      {!canRun ? (
        <p className="text-xs text-[#8ba295]">Add a title and category to run the duplicate check.</p>
      ) : !result || result.outcome === "none" || !result.match ? (
        <div className="flex items-center gap-2 border border-[#2f7a52] bg-[#0f2a1c] px-3 py-2 text-sm text-[#5effb0]">
          <span aria-hidden>✓</span> No duplicate found — safe to publish as a new event.
        </div>
      ) : (
        <div
          className={`border p-3 ${
            result.outcome === "high"
              ? "border-[#8a3630] bg-[#221011]"
              : result.outcome === "medium"
                ? "border-[#8a6a1e] bg-[#221b0e]"
                : "border-[#39493f] bg-[#141f19]"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Pill
              tone={result.outcome === "high" ? "red" : result.outcome === "medium" ? "amber" : "muted"}
              glyph={result.outcome === "high" ? "⛔" : result.outcome === "medium" ? "⚠" : "≈"}
            >
              {result.outcome === "high"
                ? "Likely duplicate"
                : result.outcome === "medium"
                  ? "Possible match — decide"
                  : "Low-confidence match"}
            </Pill>
            <span className="font-mono text-[10px] text-[#8ba295]">
              {Math.round(result.score * 100)}% · matched on {result.matchedOn ?? "fields"}
            </span>
          </div>
          <p className="mt-2 text-sm font-semibold text-[#e9efe7]">{result.match.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[#8ba295]">
            #{result.match.id} ·{" "}
            {result.match.start_at ? new Date(result.match.start_at).toISOString().slice(0, 16).replace("T", " ") : "no date"}{" "}
            UTC · {result.match.venue_name ?? (result.match.is_online ? "Online" : "no venue")}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AdminLink href={eventPath({ id: result.match.id, title: result.match.title })} variant="ghost">
              Review existing ↗
            </AdminLink>
            {result.outcome === "high" ? (
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#ff9a8a]">
                Publishing will merge this source into #{result.match.id} instead of creating a card
              </span>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[#5f7568]">
                Below the merge threshold — publishing creates a separate event
              </span>
            )}
          </div>
        </div>
      )}
      <p className="font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-[#5f7568]">
        Thresholds are provisional and tunable · {FIELD_CARDS.length} fields indexed
      </p>
    </div>
  );
}
