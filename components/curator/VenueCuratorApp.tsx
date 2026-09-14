"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRupees } from "@/lib/venues";
import {
  VenueAdminApiError,
  createVenueDraft,
  deleteVenueBySlug,
  deleteVenueSpaceByRowId,
  fetchPartnerRequests,
  fetchPendingVenueReviews,
  fetchVenueEarnings,
  fetchVenues,
  saveVenueSpace,
  setVenueReviewStatus,
  updatePartnerRequest,
  updateVenueFields,
  uploadVenuePhoto,
  type AdminPartnerRequest,
  type AdminSpace,
  type AdminVenue,
  type AdminVenueReview,
} from "@/lib/client/venueAdminApi";
import type { PartnerRequestStatus } from "@/lib/venueCatalog";
import {
  AdminBtn,
  AdminLabel,
  AdminLink,
  AdminWordmark,
  Divider,
  Field,
  Pill,
  TextArea,
  TextInput,
} from "@/components/curator/adminUi";

type Section = "venues" | "partners" | "reviews" | "earnings";

const SECTIONS: { key: Section; label: string; glyph: string }[] = [
  { key: "venues", label: "Venues", glyph: "◐" },
  { key: "partners", label: "Partner requests", glyph: "✉" },
  { key: "reviews", label: "Reviews", glyph: "★" },
  { key: "earnings", label: "Earnings", glyph: "₹" },
];

const PARTNER_STATUSES: PartnerRequestStatus[] = ["new", "contacted", "onboarding", "listed", "declined"];

export function VenueCuratorApp() {
  const [section, setSection] = useState<Section>("venues");
  const [venues, setVenues] = useState<AdminVenue[]>([]);
  const [partnerRequests, setPartnerRequests] = useState<AdminPartnerRequest[]>([]);
  const [pendingReviews, setPendingReviews] = useState<AdminVenueReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const router = useRouter();

  const announce = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 5000);
  }, []);

  const reloadVenues = useCallback(async () => {
    try {
      const { venues: list } = await fetchVenues();
      setVenues(list);
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to load venues");
    }
  }, [announce]);

  const reloadPartners = useCallback(async () => {
    try {
      const { requests } = await fetchPartnerRequests();
      setPartnerRequests(requests);
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to load partner requests");
    }
  }, [announce]);

  const reloadReviews = useCallback(async () => {
    try {
      const { reviews } = await fetchPendingVenueReviews();
      setPendingReviews(reviews);
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to load reviews");
    }
  }, [announce]);

  useEffect(() => {
    // Inlined rather than calling reloadVenues()/reloadPartners()/reloadReviews()
    // directly: those are reused from mutation handlers to trigger a refetch, but
    // the lint rule against setState-in-effect can't see past the await inside a
    // separately defined callback, so it flags the call site here even though
    // the actual state updates happen in a later microtask, same as below.
    let cancelled = false;
    (async () => {
      try {
        const [{ venues: venueList }, { requests }, { reviews }] = await Promise.all([
          fetchVenues(),
          fetchPartnerRequests(),
          fetchPendingVenueReviews(),
        ]);
        if (cancelled) return;
        setVenues(venueList);
        setPartnerRequests(requests);
        setPendingReviews(reviews);
      } catch (err) {
        if (!cancelled) announce(err instanceof VenueAdminApiError ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; reloadVenues/reloadPartners/reloadReviews are for post-mutation refetches, called from event handlers below.
  }, []);

  const newPartnerCount = partnerRequests.filter((r) => r.status === "new").length;

  return (
    <div className="min-h-screen bg-[#0a130f] text-[#e9efe7]">
      <div aria-live="polite" className="sr-only">
        {toast}
      </div>

      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#25382e] bg-[#0a130f]/95 px-4 py-3 backdrop-blur lg:px-6">
        <AdminWordmark suffix="Venues · internal" />
        <div className="flex items-center gap-2">
          <AdminLink href="/admin/curator" variant="ghost" newTab={false}>
            ← Events
          </AdminLink>
          <AdminLink href="/venues" variant="ghost">
            Public venues ↗
          </AdminLink>
          <AdminBtn
            variant="ghost"
            title="End this curator session"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.replace("/admin/login");
              router.refresh();
            }}
          >
            Sign out
          </AdminBtn>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 lg:grid-cols-[230px_1fr]">
        <aside className="border-b border-[#25382e] lg:border-b-0 lg:border-r">
          <nav className="flex gap-1 overflow-x-auto p-3 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const active = section === s.key;
              const badge = s.key === "partners" ? newPartnerCount : s.key === "reviews" ? pendingReviews.length : 0;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSection(s.key)}
                  className={`flex shrink-0 items-center justify-between gap-3 border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] transition-colors lg:shrink ${
                    active
                      ? "border-[#39ff9b] bg-[#0f2a1c] text-[#5effb0]"
                      : "border-transparent text-[#8ba295] hover:bg-white/5 hover:text-[#e9efe7]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{s.glyph}</span>
                    {s.label}
                  </span>
                  {badge > 0 && (
                    <span
                      className={`min-w-4 px-1 text-center text-[10px] ${
                        active ? "bg-[#39ff9b] text-[#04160d]" : "bg-[#25382e] text-[#a9bcb0]"
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-w-0">
          {loading ? (
            <div className="p-6 text-sm text-[#8ba295]">Loading…</div>
          ) : section === "venues" ? (
            <VenuesSection
              venues={venues}
              editingSlug={editingSlug}
              onEdit={setEditingSlug}
              onReload={reloadVenues}
              announce={announce}
            />
          ) : section === "partners" ? (
            <PartnersSection requests={partnerRequests} onReload={reloadPartners} announce={announce} />
          ) : section === "reviews" ? (
            <ReviewsSection reviews={pendingReviews} onReload={reloadReviews} announce={announce} />
          ) : (
            <EarningsSection venues={venues} />
          )}
        </main>
      </div>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 border border-[#39ff9b] bg-[#0f2a1c] px-4 py-2.5 shadow-lg">
          <span aria-hidden className="text-[#39ff9b]">
            ✓
          </span>
          <span className="text-sm text-[#e9efe7]">{toast}</span>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ venues

function VenuesSection({
  venues,
  editingSlug,
  onEdit,
  onReload,
  announce,
}: {
  venues: AdminVenue[];
  editingSlug: string | null;
  onEdit: (slug: string | null) => void;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const editing = venues.find((v) => v.slug === editingSlug) ?? null;

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-black">Venues</h1>
          <p className="mt-1 text-sm text-[#8ba295]">
            {venues.filter((v) => v.status === "live").length} live ·{" "}
            {venues.filter((v) => v.status === "coming-soon").length} launching soon ·{" "}
            {venues.filter((v) => v.status === "hidden").length} draft
          </p>
        </div>
        <AdminBtn variant="primary" onClick={() => setShowCreate(true)}>
          + Add venue
        </AdminBtn>
      </div>

      <ul className="flex flex-col gap-3">
        {venues.map((venue) => (
          <li key={venue.slug} className="border border-[#25382e] bg-[#101c16] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={venue.status} />
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f7568]">
                /{venue.slug}
              </span>
              <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f7568]">
                {venue.spaces.length} {venue.spaces.length === 1 ? "room" : "rooms"}
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-bold">{venue.name}</h3>
            <p className="mt-1 text-sm text-[#a9bcb0]">
              {venue.area}
              {venue.area && venue.city ? ", " : ""}
              {venue.city}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <AdminBtn
                variant="primary"
                onClick={() => onEdit(editingSlug === venue.slug ? null : venue.slug)}
              >
                {editingSlug === venue.slug ? "Close" : "Edit"}
              </AdminBtn>
              {venue.status !== "live" && venue.spaces.length > 0 && (
                <AdminBtn
                  variant="outline"
                  onClick={async () => {
                    try {
                      await updateVenueFields(venue.slug, { status: "live" });
                      announce(`${venue.name} is now live`);
                      await onReload();
                    } catch (err) {
                      announce(err instanceof VenueAdminApiError ? err.message : "Failed to publish");
                    }
                  }}
                >
                  Publish
                </AdminBtn>
              )}
              {venue.status !== "hidden" && (
                <AdminBtn
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await updateVenueFields(venue.slug, { status: "hidden" });
                      announce(`${venue.name} hidden from the public site`);
                      await onReload();
                    } catch (err) {
                      announce(err instanceof VenueAdminApiError ? err.message : "Failed to hide");
                    }
                  }}
                >
                  Unpublish
                </AdminBtn>
              )}
              <AdminBtn
                variant="danger"
                onClick={async () => {
                  if (!window.confirm(`Delete ${venue.name}? This also removes its rooms.`)) return;
                  try {
                    await deleteVenueBySlug(venue.slug);
                    announce(`${venue.name} deleted`);
                    if (editingSlug === venue.slug) onEdit(null);
                    await onReload();
                  } catch (err) {
                    announce(err instanceof VenueAdminApiError ? err.message : "Failed to delete");
                  }
                }}
              >
                Delete
              </AdminBtn>
            </div>

            {editing?.slug === venue.slug && (
              <VenueEditor venue={editing} onReload={onReload} announce={announce} />
            )}
          </li>
        ))}
        {venues.length === 0 && (
          <li className="border border-dashed border-[#2c4236] p-8 text-center text-sm text-[#8ba295]">
            No venues yet. Add one to start filling in its page.
          </li>
        )}
      </ul>

      {showCreate && (
        <CreateVenueDialog
          onClose={() => setShowCreate(false)}
          onCreated={async (slug) => {
            setShowCreate(false);
            await onReload();
            onEdit(slug);
          }}
          announce={announce}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: AdminVenue["status"] }) {
  if (status === "live") return <Pill tone="green" glyph="●">Live</Pill>;
  if (status === "coming-soon") return <Pill tone="amber" glyph="◷">Launching soon</Pill>;
  return <Pill tone="muted" glyph="◌">Draft</Pill>;
}

function CreateVenueDialog({
  onClose,
  onCreated,
  announce,
}: {
  onClose: () => void;
  onCreated: (slug: string) => void;
  announce: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const { venue } = await createVenueDraft({ name: name.trim(), area: area.trim() });
      announce(`${venue.name} created as a draft`);
      onCreated(venue.slug);
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to create venue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md border border-[#25382e] bg-[#0f1a15] p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-bold">Add a venue</h2>
        <p className="mt-1 text-xs text-[#8ba295]">
          Starts hidden. Fill in the rest and publish once it&apos;s ready.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <Field label="Name" required>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rain Coffee" />
          </Field>
          <Field label="Area" hint="e.g. Adyar, Nungambakkam">
            <TextInput value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <AdminBtn variant="ghost" onClick={onClose}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={submit} disabled={busy || !name.trim()}>
            {busy ? "Creating…" : "Create"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}

function VenueEditor({
  venue,
  onReload,
  announce,
}: {
  venue: AdminVenue;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [form, setForm] = useState({
    name: venue.name,
    area: venue.area,
    city: venue.city,
    address: venue.address ?? "",
    summary: venue.summary,
    phone: venue.phone ?? "",
    rating: venue.rating?.toString() ?? "",
    ratingCount: venue.ratingCount?.toString() ?? "",
    ratingUrl: venue.ratingUrl ?? "",
    mapUrl: venue.mapUrl ?? "",
    mapEmbedUrl: venue.mapEmbedUrl ?? "",
    amenities: venue.amenities.join(", "),
    policies: venue.policies.join("\n"),
  });
  const [photos, setPhotos] = useState<string[]>(venue.photos);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await updateVenueFields(venue.slug, {
        name: form.name,
        area: form.area,
        city: form.city,
        address: form.address || null,
        summary: form.summary,
        phone: form.phone || null,
        rating: form.rating || null,
        ratingCount: form.ratingCount || null,
        ratingUrl: form.ratingUrl || null,
        mapUrl: form.mapUrl || null,
        mapEmbedUrl: form.mapEmbedUrl || null,
        photos,
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean),
        policies: form.policies.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      announce(`${form.name} saved`);
      await onReload();
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[#25382e] pt-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Area">
          <TextInput value={form.area} onChange={(e) => set("area", e.target.value)} />
        </Field>
        <Field label="City">
          <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} />
        </Field>
        <Field label="Phone">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
      </div>
      <Field label="Address" className="mt-3">
        <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
      </Field>
      <Field label="Summary" hint="One or two sentences shown on the listing card" className="mt-3">
        <TextArea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Rating" hint="The venue's own dining rating, not events">
          <TextInput
            inputMode="decimal"
            value={form.rating}
            onChange={(e) => set("rating", e.target.value)}
          />
        </Field>
        <Field label="Rating count">
          <TextInput
            inputMode="numeric"
            value={form.ratingCount}
            onChange={(e) => set("ratingCount", e.target.value)}
          />
        </Field>
        <Field label="Rating URL" hint="e.g. Zomato / Google listing">
          <TextInput value={form.ratingUrl} onChange={(e) => set("ratingUrl", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Map URL">
          <TextInput value={form.mapUrl} onChange={(e) => set("mapUrl", e.target.value)} />
        </Field>
        <Field label="Map embed URL">
          <TextInput value={form.mapEmbedUrl} onChange={(e) => set("mapEmbedUrl", e.target.value)} />
        </Field>
      </div>
      <div className="mt-3">
        <PhotoPicker photos={photos} onChange={setPhotos} announce={announce} />
      </div>
      <Field label="Amenities" hint="Comma-separated — organizer-facing promises, confirm with the owner first" className="mt-3">
        <TextArea rows={2} value={form.amenities} onChange={(e) => set("amenities", e.target.value)} />
      </Field>
      <Field label="House policies" hint="One per line" className="mt-3">
        <TextArea rows={4} value={form.policies} onChange={(e) => set("policies", e.target.value)} />
      </Field>

      <div className="mt-4 flex justify-end">
        <AdminBtn variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save venue"}
        </AdminBtn>
      </div>

      <Divider />
      <div className="mt-4">
        <SpacesEditor venue={venue} onReload={onReload} announce={announce} />
      </div>
    </div>
  );
}

/**
 * Real photo management, not a path-per-line textarea.
 *
 * Reuses the existing curator poster pipeline (poster_uploads, verified magic
 * bytes, served from /api/poster/{id}) — venue photos are the same kind of
 * asset an event poster is, so this needed no new upload endpoint or storage
 * table. The first photo is the cover shown on the listing card, matching
 * VenueCard.tsx's `venue.coverImage = photos[0]` convention, so reordering to
 * front is the only way to change the cover.
 */
function PhotoPicker({
  photos,
  onChange,
  announce,
}: {
  photos: string[];
  onChange: (next: string[]) => void;
  announce: (msg: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadVenuePhoto(file));
      }
      onChange([...photos, ...uploaded]);
      announce(`${uploaded.length} photo${uploaded.length === 1 ? "" : "s"} uploaded`);
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Photo upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function remove(index: number) {
    onChange(photos.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...photos];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <AdminLabel>Photos</AdminLabel>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f7568]">
        First photo is the cover shown on the listing card
      </p>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((src, index) => (
          <div key={`${src}-${index}`} className="group relative aspect-video overflow-hidden border border-[#2c4236] bg-[#0b1611]">
            {/* eslint-disable-next-line @next/next/no-img-element -- curator-uploaded venue photos, not a Next-optimized public asset path */}
            <img src={src} alt={`Venue photo ${index + 1}`} className="size-full object-cover" />
            {index === 0 && (
              <span className="absolute left-1.5 top-1.5 bg-[#39ff9b] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[0.1em] text-[#04160d]">
                Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/70 p-1 opacity-0 transition-opacity group-hover:opacity-100">
              <div className="flex gap-1">
                <button
                  type="button"
                  title="Move earlier"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  className="px-1.5 py-0.5 font-mono text-[10px] text-[#e9efe7] disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  title="Move later"
                  disabled={index === photos.length - 1}
                  onClick={() => move(index, 1)}
                  className="px-1.5 py-0.5 font-mono text-[10px] text-[#e9efe7] disabled:opacity-30"
                >
                  →
                </button>
              </div>
              <button
                type="button"
                title="Remove photo"
                onClick={() => remove(index)}
                className="px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#ff8a7a]"
              >
                ✕ remove
              </button>
            </div>
          </div>
        ))}

        <label
          className={`flex aspect-video cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-[#33493c] text-[#8ba295] transition-colors hover:border-[#39ff9b] hover:text-[#39ff9b] ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="text-lg" aria-hidden>
            {uploading ? "…" : "+"}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em]">
            {uploading ? "Uploading" : "Add photo"}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>
      </div>
      {photos.length === 0 && (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f7568]">
          No photos yet — this venue can&apos;t go live without at least one.
        </p>
      )}
    </div>
  );
}

function SpacesEditor({
  venue,
  onReload,
  announce,
}: {
  venue: AdminVenue;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between">
        <AdminLabel>Rooms</AdminLabel>
        <AdminBtn variant="outline" onClick={() => setShowNew(true)}>
          + Add room
        </AdminBtn>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {venue.spaces.map((space) => (
          <SpaceRow key={space.rowId} venueSlug={venue.slug} space={space} onReload={onReload} announce={announce} />
        ))}
        {venue.spaces.length === 0 && !showNew && (
          <li className="border border-dashed border-[#2c4236] p-4 text-center text-xs text-[#8ba295]">
            No rooms yet. A venue needs at least one to go live.
          </li>
        )}
      </ul>
      {showNew && (
        <SpaceForm
          venueSlug={venue.slug}
          onDone={async () => {
            setShowNew(false);
            await onReload();
          }}
          onCancel={() => setShowNew(false)}
          announce={announce}
        />
      )}
    </div>
  );
}

function SpaceRow({
  venueSlug,
  space,
  onReload,
  announce,
}: {
  venueSlug: string;
  space: AdminSpace;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li>
        <SpaceForm
          venueSlug={venueSlug}
          existing={space}
          onDone={async () => {
            setEditing(false);
            await onReload();
          }}
          onCancel={() => setEditing(false)}
          announce={announce}
        />
      </li>
    );
  }

  return (
    <li className="border border-[#25382e] bg-[#0d1712] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-bold">{space.name}</p>
          <p className="mt-0.5 text-xs text-[#8ba295]">
            Up to {space.maxGuests} ·{" "}
            {space.communityRate === null ? "quote only" : `${formatRupees(space.communityRate)}/hr`}
          </p>
        </div>
        <div className="flex gap-2">
          <AdminBtn variant="outline" onClick={() => setEditing(true)}>
            Edit
          </AdminBtn>
          <AdminBtn
            variant="danger"
            onClick={async () => {
              if (!window.confirm(`Delete room "${space.name}"?`)) return;
              try {
                await deleteVenueSpaceByRowId(venueSlug, space.rowId);
                announce(`${space.name} deleted`);
                await onReload();
              } catch (err) {
                announce(err instanceof VenueAdminApiError ? err.message : "Failed to delete room");
              }
            }}
          >
            Delete
          </AdminBtn>
        </div>
      </div>
    </li>
  );
}

function SpaceForm({
  venueSlug,
  existing,
  onDone,
  onCancel,
  announce,
}: {
  venueSlug: string;
  existing?: AdminSpace;
  onDone: () => Promise<void>;
  onCancel: () => void;
  announce: (msg: string) => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [eyebrow, setEyebrow] = useState(existing?.eyebrow ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [capacity, setCapacity] = useState(existing?.capacity ?? "");
  const [maxGuests, setMaxGuests] = useState(existing?.maxGuests?.toString() ?? "");
  const [image, setImage] = useState(existing?.image ?? "");
  const [amenities, setAmenities] = useState(existing?.amenities.join(", ") ?? "");
  const [communityRate, setCommunityRate] = useState(existing?.communityRate?.toString() ?? "");
  const [productionRate, setProductionRate] = useState(existing?.productionRate?.toString() ?? "");
  const [minimumFoodSpend, setMinimumFoodSpend] = useState(existing?.minimumFoodSpend?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || !maxGuests) return;
    setBusy(true);
    try {
      await saveVenueSpace(venueSlug, {
        spaceKey: existing?.id,
        name: name.trim(),
        eyebrow,
        description,
        capacity,
        maxGuests: Number(maxGuests),
        image: image || null,
        amenities: amenities.split(",").map((s) => s.trim()).filter(Boolean),
        communityRate: communityRate === "" ? null : Number(communityRate),
        productionRate: productionRate === "" ? null : Number(productionRate),
        minimumFoodSpend: minimumFoodSpend === "" ? null : Number(minimumFoodSpend),
        sortOrder: existing?.sortOrder ?? 0,
      });
      announce(`${name} saved`);
      await onDone();
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to save room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-[#33493c] bg-[#101c16] p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Room name" required>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Eyebrow" hint='e.g. "Best for meetups"'>
          <TextInput value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} />
        </Field>
      </div>
      <Field label="Description" className="mt-3">
        <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Field label="Capacity text" hint='e.g. "25–30 people"'>
          <TextInput value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </Field>
        <Field label="Max guests (number)" required>
          <TextInput inputMode="numeric" value={maxGuests} onChange={(e) => setMaxGuests(e.target.value)} />
        </Field>
      </div>
      <Field label="Image path" className="mt-3">
        <TextInput value={image} onChange={(e) => setImage(e.target.value)} />
      </Field>
      <Field label="Amenities" hint="Comma-separated" className="mt-3">
        <TextInput value={amenities} onChange={(e) => setAmenities(e.target.value)} />
      </Field>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label="Community rate (₹/hr)" hint="Leave blank for quote-only">
          <TextInput inputMode="numeric" value={communityRate} onChange={(e) => setCommunityRate(e.target.value)} />
        </Field>
        <Field label="Production rate (₹/hr)" hint="Shoots/videography">
          <TextInput inputMode="numeric" value={productionRate} onChange={(e) => setProductionRate(e.target.value)} />
        </Field>
        <Field label="Min. food spend (₹)">
          <TextInput inputMode="numeric" value={minimumFoodSpend} onChange={(e) => setMinimumFoodSpend(e.target.value)} />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <AdminBtn variant="ghost" onClick={onCancel}>
          Cancel
        </AdminBtn>
        <AdminBtn variant="primary" onClick={save} disabled={busy || !name.trim() || !maxGuests}>
          {busy ? "Saving…" : "Save room"}
        </AdminBtn>
      </div>
    </div>
  );
}

// --------------------------------------------------------------- partners

function PartnersSection({
  requests,
  onReload,
  announce,
}: {
  requests: AdminPartnerRequest[];
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<PartnerRequestStatus | "all">("new");
  const visible = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="p-4 lg:p-6">
      <h1 className="font-display text-xl font-black">Venue partner requests</h1>
      <p className="mt-1 text-sm text-[#8ba295]">
        Submissions from the &quot;List your venue&quot; form — these used to be discarded on submit.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(["all", ...PARTNER_STATUSES] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] ${
              filter === status
                ? "border-[#39ff9b] bg-[#0f2a1c] text-[#5effb0]"
                : "border-[#25382e] text-[#8ba295] hover:text-[#e9efe7]"
            }`}
          >
            {status}
            {status !== "all" && ` (${requests.filter((r) => r.status === status).length})`}
          </button>
        ))}
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        {visible.map((req) => (
          <PartnerRequestRow key={req.id} request={req} onReload={onReload} announce={announce} />
        ))}
        {visible.length === 0 && (
          <li className="border border-dashed border-[#2c4236] p-8 text-center text-sm text-[#8ba295]">
            Nothing here.
          </li>
        )}
      </ul>
    </div>
  );
}

function PartnerRequestRow({
  request,
  onReload,
  announce,
}: {
  request: AdminPartnerRequest;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [note, setNote] = useState(request.curatorNote ?? "");
  const [busy, setBusy] = useState(false);

  async function move(status: PartnerRequestStatus) {
    setBusy(true);
    try {
      await updatePartnerRequest(request.id, status, note);
      announce(`${request.venueName} marked ${status}`);
      await onReload();
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-[#25382e] bg-[#101c16] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={request.status === "new" ? "amber" : request.status === "declined" ? "red" : "blue"} glyph="✉">
          {request.status}
        </Pill>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f7568]">
          {new Date(request.createdAt).toLocaleDateString("en-IN")}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold">{request.venueName}</h3>
      <p className="text-sm text-[#a9bcb0]">{request.area}</p>
      <p className="mt-2 text-sm leading-relaxed text-[#c8d4cc]">{request.details}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-[#8ba295]">
        <span>{request.contactName}</span>
        <span>{request.phone}</span>
        {request.link && (
          <a href={request.link} target="_blank" rel="noopener noreferrer" className="text-[#7ab8ff] underline">
            {request.link}
          </a>
        )}
      </div>

      <TextInput
        className="mt-3"
        placeholder="Curator note (private)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {request.status !== "contacted" && (
          <AdminBtn variant="outline" disabled={busy} onClick={() => move("contacted")}>
            Mark contacted
          </AdminBtn>
        )}
        {request.status !== "onboarding" && (
          <AdminBtn variant="outline" disabled={busy} onClick={() => move("onboarding")}>
            Onboarding
          </AdminBtn>
        )}
        {request.status !== "listed" && (
          <AdminBtn variant="primary" disabled={busy} onClick={() => move("listed")}>
            Listed
          </AdminBtn>
        )}
        {request.status !== "declined" && (
          <AdminBtn variant="danger" disabled={busy} onClick={() => move("declined")}>
            Decline
          </AdminBtn>
        )}
      </div>
    </li>
  );
}

// ---------------------------------------------------------------- reviews

function ReviewsSection({
  reviews,
  onReload,
  announce,
}: {
  reviews: AdminVenueReview[];
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  return (
    <div className="p-4 lg:p-6">
      <h1 className="font-display text-xl font-black">Self-reported reviews</h1>
      <p className="mt-1 text-sm text-[#8ba295]">
        &quot;Already hosted here?&quot; submissions — not tied to a SCENE booking, so each one gets a quick
        check before it goes on the venue page. Reviews from completed SCENE bookings publish automatically
        and never appear here.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} onReload={onReload} announce={announce} />
        ))}
        {reviews.length === 0 && (
          <li className="border border-dashed border-[#2c4236] p-8 text-center text-sm text-[#8ba295]">
            Nothing pending.
          </li>
        )}
      </ul>
    </div>
  );
}

function ReviewRow({
  review,
  onReload,
  announce,
}: {
  review: AdminVenueReview;
  onReload: () => Promise<void>;
  announce: (msg: string) => void;
}) {
  const [busy, setBusy] = useState(false);

  async function decide(status: "published" | "rejected") {
    setBusy(true);
    try {
      await setVenueReviewStatus(review.id, status);
      announce(`Review by ${review.organizerName ?? "reviewer"} ${status}`);
      await onReload();
    } catch (err) {
      announce(err instanceof VenueAdminApiError ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="border border-[#25382e] bg-[#101c16] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="amber" glyph="★">
          {review.venueSlug}
        </Pill>
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f7568]">
          {new Date(review.createdAt).toLocaleDateString("en-IN")}
        </span>
      </div>
      <h3 className="mt-2 font-display text-lg font-bold">{review.organizerName ?? "Anonymous"}</h3>
      <p className="text-sm text-[#a9bcb0]">
        {review.eventType || "Event type not given"} · {review.rating}/5
      </p>
      {review.comment && <p className="mt-2 text-sm leading-relaxed text-[#c8d4cc]">{review.comment}</p>}
      {review.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <Pill key={tag} tone="muted" glyph="#">
              {tag}
            </Pill>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <AdminBtn variant="primary" disabled={busy} onClick={() => decide("published")}>
          Publish
        </AdminBtn>
        <AdminBtn variant="danger" disabled={busy} onClick={() => decide("rejected")}>
          Reject
        </AdminBtn>
      </div>
    </li>
  );
}

// --------------------------------------------------------------- earnings

function EarningsSection({ venues }: { venues: AdminVenue[] }) {
  const [overall, setOverall] = useState<Awaited<ReturnType<typeof fetchVenueEarnings>>["earnings"] | null>(null);
  const [perVenue, setPerVenue] = useState<Record<string, Awaited<ReturnType<typeof fetchVenueEarnings>>["earnings"]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { earnings } = await fetchVenueEarnings();
      if (cancelled) return;
      setOverall(earnings);
      const entries = await Promise.all(
        venues.map(async (v) => [v.slug, (await fetchVenueEarnings(v.slug)).earnings] as const),
      );
      if (!cancelled) setPerVenue(Object.fromEntries(entries));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [venues]);

  if (loading || !overall) {
    return <div className="p-6 text-sm text-[#8ba295]">Loading earnings…</div>;
  }

  return (
    <div className="p-4 lg:p-6">
      <h1 className="font-display text-xl font-black">Earnings</h1>
      <p className="mt-1 text-sm text-[#8ba295]">
        Counted only from bookings that reached payment — a request or approval alone earns nothing.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <EarningsStat label="Confirmed bookings" value={String(overall.confirmedCount)} />
        <EarningsStat label="Gross booking value" value={formatRupees(overall.grossValue)} />
        <EarningsStat label="SCENE fee (10%)" value={formatRupees(overall.sceneFee)} accent />
        <EarningsStat label="Venue payouts owed" value={formatRupees(overall.venuePayout)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <EarningsStat label="Food & drink orders (venue keeps 100%)" value={formatRupees(overall.orderRevenue)} />
        <EarningsStat label="Completed events" value={String(overall.completedCount)} />
      </div>

      <Divider />

      <h2 className="mt-5 font-display text-lg font-bold">By venue</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {venues.map((venue) => {
          const e = perVenue[venue.slug];
          if (!e) return null;
          return (
            <li key={venue.slug} className="border border-[#25382e] bg-[#101c16] p-4">
              <p className="font-bold">{venue.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <dt className="font-mono text-[9px] uppercase text-[#5f7568]">Gross</dt>
                  <dd className="font-bold">{formatRupees(e.grossValue)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase text-[#5f7568]">SCENE fee</dt>
                  <dd className="font-bold text-[#5effb0]">{formatRupees(e.sceneFee)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase text-[#5f7568]">Payout</dt>
                  <dd className="font-bold">{formatRupees(e.venuePayout)}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[9px] uppercase text-[#5f7568]">Food orders</dt>
                  <dd className="font-bold">{formatRupees(e.orderRevenue)}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EarningsStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-[#25382e] bg-[#101c16] p-4">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#5f7568]">{label}</p>
      <p className={`mt-1 font-display text-2xl font-black ${accent ? "text-[#5effb0]" : ""}`}>{value}</p>
    </div>
  );
}
