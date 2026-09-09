"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, type Category, type EventStatus } from "@/lib/types";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import {
  draftToInstant,
  emptyCuratorDraft,
  instantToDraftParts,
  validateDraftForPublish,
  type CuratorDraft,
} from "@/lib/curatorDraft";
import {
  CuratorApiError,
  updatePublishedEvent,
  type AdminEvent,
} from "@/lib/client/curatorApi";
import { PerksEditor, PosterField, TagsEditor } from "@/components/curator/CandidateReview";
import {
  AdminBtn,
  AdminLabel,
  Divider,
  Field,
  Select,
  TextArea,
  TextInput,
} from "@/components/curator/adminUi";

const STATUS_OPTIONS: { value: EventStatus; label: string }[] = [
  { value: "live", label: "Confirmed / live" },
  { value: "updated", label: "Updated" },
  { value: "postponed", label: "Postponed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Past / expired" },
];

function eventToDraft(event: AdminEvent): CuratorDraft {
  const start = instantToDraftParts(event.startAt);
  const end = instantToDraftParts(event.endAt);
  return {
    ...emptyCuratorDraft(),
    title: event.title,
    summary: event.summary ?? "",
    highlights: event.highlights ?? [],
    tags: event.tags ?? [],
    isPromoted: event.isPromoted,
    category: event.category,
    startDate: start.date,
    startTime: start.time,
    endDate: end.date,
    endTime: end.time,
    isOnline: event.isOnline,
    venueName: event.venueName ?? "",
    venueAddress: event.venueAddress ?? "",
    organizerName: event.organizerName ?? "",
    registrationUrl: event.primarySourceUrl,
    posterImageUrl: event.posterImageUrl ?? "",
    priceType: event.priceType ?? "",
    priceNote: event.priceNote ?? "",
    status: event.status === "postponed" || event.status === "cancelled" || event.status === "expired"
      ? event.status
      : "live",
  };
}

export function PublishedEventEditor({
  event,
  onCancel,
  onDone,
  onDirtyChange,
}: {
  event: AdminEvent;
  onCancel: () => void;
  onDone: (message: string) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<CuratorDraft>(() => eventToDraft(event));
  const [status, setStatus] = useState<EventStatus>(event.status === "pending_review" ? "live" : event.status);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errors = useMemo(() => validateDraftForPublish(draft), [draft]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function set<K extends keyof CuratorDraft>(key: K, value: CuratorDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function changeStatus(next: EventStatus) {
    setStatus(next);
    setDirty(true);
  }

  async function save() {
    if (errors.length) return;
    setBusy(true);
    setError(null);
    try {
      await updatePublishedEvent({
        eventId: event.id,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        highlights: draft.highlights.map((perk) => perk.trim()).filter(Boolean),
        tags: draft.tags.map((tag) => tag.trim().replace(/^#+/, "")).filter(Boolean),
        isPromoted: draft.isPromoted,
        category: draft.category as Category,
        startAt: draftToInstant(draft.startDate, draft.startTime),
        endAt: draftToInstant(draft.endDate, draft.endTime),
        isOnline: draft.isOnline,
        venueName: draft.isOnline ? null : draft.venueName.trim() || null,
        venueAddress: draft.isOnline ? null : draft.venueAddress.trim() || null,
        organizerName: draft.organizerName.trim() || null,
        posterImageUrl: draft.posterImageUrl.trim() || null,
        priceType: draft.priceType || null,
        priceNote: draft.priceType === "paid" ? draft.priceNote.trim() || null : null,
        primarySourceUrl: draft.registrationUrl.trim(),
        status,
      });
      setDirty(false);
      onDone(`Updated “${draft.title.trim()}”`);
    } catch (cause) {
      setError(cause instanceof CuratorApiError ? cause.message : "Could not save this event.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="sticky top-[61px] z-20 flex items-center justify-between border-b border-[#25382e] bg-[#0a130f]/95 px-4 py-2.5 backdrop-blur lg:px-6">
        <AdminBtn variant="ghost" onClick={onCancel}>← Back to published</AdminBtn>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f7568]">
          {dirty ? "● Unsaved changes" : `Editing event #${event.id}`}
        </span>
      </div>

      <div className="mx-auto grid max-w-5xl gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-6">
        <div className="flex flex-col gap-5 border border-[#25382e] bg-[#0d1813] p-5 lg:p-6">
          <div>
            <AdminLabel>Published event</AdminLabel>
            <h2 className="mt-1 font-display text-xl font-black">Edit every public field</h2>
            <p className="mt-1 text-sm text-[#8ba295]">Changes go live together only after validation succeeds.</p>
          </div>

          <Field label="Event title" required>
            <TextInput value={draft.title} onChange={(e) => set("title", e.target.value)} />
          </Field>
          <Field label="Description" hint="Shown on the event detail page">
            <TextArea rows={6} value={draft.summary} onChange={(e) => set("summary", e.target.value)} />
          </Field>
          <PerksEditor value={draft.highlights} onChange={(next) => set("highlights", next)} />
          <TagsEditor value={draft.tags} onChange={(next) => set("tags", next)} />
          <Field label="Placement" hint="Promoted events appear first, then sort by date">
            <label className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.isPromoted} onChange={(e) => set("isPromoted", e.target.checked)} className="size-4 accent-[#39ff9b]" />
              Mark as promoted
            </label>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" required>
              <Select value={draft.category} onChange={(e) => set("category", e.target.value as CuratorDraft["category"])}>
                <option value="">— select —</option>
                {CATEGORIES.map((category) => <option key={category} value={category}>{getFieldCardForCategory(category)?.label ?? category}</option>)}
              </Select>
            </Field>
            <Field label="Format">
              <label className="flex min-h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.isOnline} onChange={(e) => set("isOnline", e.target.checked)} className="size-4 accent-[#39ff9b]" />
                Online event
              </label>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Start date (IST)" required><TextInput type="date" value={draft.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
            <Field label="Start time (IST)"><TextInput type="time" value={draft.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
            <Field label="End date"><TextInput type="date" value={draft.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
            <Field label="End time"><TextInput type="time" value={draft.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
          </div>

          {!draft.isOnline && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Venue name"><TextInput value={draft.venueName} onChange={(e) => set("venueName", e.target.value)} /></Field>
              <Field label="Venue address"><TextInput value={draft.venueAddress} onChange={(e) => set("venueAddress", e.target.value)} /></Field>
            </div>
          )}

          <Field label="Organizer name"><TextInput value={draft.organizerName} onChange={(e) => set("organizerName", e.target.value)} /></Field>
          <Field label="Registration URL" required hint="Public “View event” destination">
            <TextInput type="url" value={draft.registrationUrl} onChange={(e) => set("registrationUrl", e.target.value)} />
          </Field>
          <PosterField value={draft.posterImageUrl} category={draft.category} onChange={(next) => set("posterImageUrl", next)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" hint="Use “Not stated” when the source is unclear">
              <Select value={draft.priceType} onChange={(e) => set("priceType", e.target.value as CuratorDraft["priceType"])}>
                <option value="">Not stated</option><option value="free">Free to attend</option><option value="paid">Paid</option>
              </Select>
            </Field>
            {draft.priceType === "paid" && <Field label="Price note"><TextInput value={draft.priceNote} onChange={(e) => set("priceNote", e.target.value)} placeholder="₹499" /></Field>}
          </div>

          <Field label="Status">
            <Select value={status} onChange={(e) => changeStatus(e.target.value as EventStatus)}>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </Field>
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="border border-[#25382e] bg-[#101c16] p-4">
            <AdminLabel>Review before saving</AdminLabel>
            {errors.length ? (
              <ul className="mt-3 flex flex-col gap-2" aria-label="Blocking problems">
                {errors.map((message) => <li key={message} className="text-xs text-[#ff9a8a]">• {message}</li>)}
              </ul>
            ) : <p className="mt-3 text-xs text-[#8ba295]">All required fields are valid.</p>}
            {error && <p className="mt-3 border border-[#8a3630] bg-[#2a1310] p-2 text-xs text-[#ff9a8a]" role="alert">{error}</p>}
            <Divider />
            <div className="mt-4 flex flex-col gap-2">
              <AdminBtn variant="primary" onClick={() => void save()} disabled={busy || !dirty || errors.length > 0}>{busy ? "Saving…" : "Save changes"}</AdminBtn>
              <AdminBtn variant="ghost" onClick={onCancel}>Cancel</AdminBtn>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
