"use client";

import {
  SOURCE_TYPES,
  SOURCE_TYPE_LABELS,
  CATEGORY_FILTER_LABELS,
} from "@/lib/sourceTypes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventStatus } from "@/lib/types";
import { getFieldCardForCategory } from "@/lib/fieldCards";
import { relativeChecked } from "@/lib/client/istTime";
import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import {
  addCandidate,
  CuratorApiError,
  fetchPublishedEvents,
  fetchQueue,
  type QueueFacets,
  setEventStatus,
  setItemStatus,
  type AdminEvent,
  type QueueItem,
  type QueueKey,
} from "@/lib/client/curatorApi";
import { CandidateReview } from "@/components/curator/CandidateReview";
import {
  AdminBtn,
  AdminLink,
  AdminWordmark,
  Pill,
  Select,
  TextInput,
} from "@/components/curator/adminUi";

const QUEUES: { key: QueueKey; label: string; glyph: string }[] = [
  { key: "pending", label: "Pending", glyph: "◐" },
  { key: "needs_correction", label: "Needs correction", glyph: "✎" },
  { key: "duplicates", label: "Merged duplicates", glyph: "≈" },
  { key: "published", label: "Published", glyph: "✓" },
  { key: "needs_date_review", label: "Needs date review", glyph: "?" },
  { key: "expired", label: "Past / expired", glyph: "◷" },
  { key: "rejected", label: "Rejected", glyph: "⛌" },
  { key: "errors", label: "Errors", glyph: "!" },
];

const EMPTY_COPY: Record<QueueKey, string> = {
  pending: "The pending queue is clear. New search-discovered candidates land here newest-first.",
  needs_correction: "Nothing parked for correction. Drafts you save for later appear here.",
  duplicates: "No merged duplicates. Items merged into an existing event show up here.",
  published: "",
  needs_date_review: "Nothing awaiting a date check. Candidates with no reliable event date land here.",
  expired: "No past events. Candidates whose date has already passed land here.",
  rejected: "No rejected candidates.",
  errors: "No extraction errors.",
};

export function CuratorApp() {
  const [queue, setQueue] = useState<QueueKey>("pending");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [facets, setFacets] = useState<QueueFacets>({ source: {}, category: {} });
  const [items, setItems] = useState<QueueItem[]>([]);
  const [published, setPublished] = useState<AdminEvent[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped to force a refetch after a mutation. Combined with `queue` it forms
  // the key below, so "same queue, reloaded" still counts as new data.
  const [reloadToken, setReloadToken] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [dirty, setDirty] = useState(false);
  const [toast, setToast] = useState<{ msg: string; href?: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const announce = useCallback((msg: string, href?: string) => {
    setToast({ msg, href });
    window.setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), 6000);
  }, []);

  const requestKey = `${queue}:${sourceFilter}:${categoryFilter}:${reloadToken}`;
  // Derived rather than a `loading` state set inside the effect: setting state
  // synchronously in an effect body causes a cascading re-render, and React's
  // lint rule flags it. Everything below updates state from a promise callback.
  const loading = loadedKey !== requestKey && loadError === null;

  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;

    const pending =
      queue === "published"
        ? Promise.all([fetchPublishedEvents(), fetchQueue("pending")]).then(([p, q]) => {
            setPublished(p.events);
            setCounts(q.counts);
          })
        : fetchQueue(queue, { source: sourceFilter || null, category: categoryFilter || null }).then(
            ({ items: rows, counts: c, facets: f }) => {
              setItems(rows);
              setCounts(c);
              setFacets(f ?? { source: {}, category: {} });
            },
          );

    pending
      .then(() => {
        if (cancelled) return;
        setLoadError(null);
        setLoadedKey(requestKey);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(
          err instanceof CuratorApiError
            ? `${err.message} (${err.status})`
            : "Could not reach the curator API.",
        );
        setLoadedKey(requestKey);
      });

    return () => {
      cancelled = true;
    };
  }, [queue, sourceFilter, categoryFilter, requestKey]);

  const guard = useCallback(
    (fn: () => void) => {
      if (dirty && !window.confirm("You have unsaved changes. Discard them?")) return;
      setDirty(false);
      fn();
    },
    [dirty],
  );

  const domains = useMemo(() => Array.from(new Set(items.map((i) => i.source_domain))).sort(), [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => domainFilter === "all" || i.source_domain === domainFilter)
      .filter(
        (i) => !q || `${i.title ?? ""} ${i.snippet ?? ""} ${i.url}`.toLowerCase().includes(q),
      );
  }, [items, search, domainFilter]);

  const openItem = openId === null ? null : (items.find((i) => i.id === openId) ?? null);

  // Keyboard shortcuts, ignored while typing in a field.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
      if (typing) {
        if (e.key === "Escape") t!.blur();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "?") {
        setShowHelp((s) => !s);
      } else if (e.key === "Escape" && openId !== null) {
        guard(() => setOpenId(null));
      } else if ((e.key === "j" || e.key === "k") && filtered.length > 0) {
        const idx = filtered.findIndex((i) => i.id === openId);
        const next = e.key === "j" ? filtered[idx + 1] ?? filtered[0] : filtered[idx - 1] ?? filtered[filtered.length - 1];
        if (next) guard(() => setOpenId(next.id));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, openId, guard]);

  async function quickAction(item: QueueItem, action: "irrelevant" | "expired" | "rejected" | "reopen") {
    try {
      await setItemStatus(item.id, action);
      announce(`#${item.id} marked ${action}`);
      reload();
    } catch (err) {
      announce(err instanceof CuratorApiError ? err.message : "Action failed");
    }
  }

  async function handleAdd(url: string) {
    try {
      const res = await addCandidate(url);
      setShowAdd(false);
      announce(res.reused ? "That URL was already in the queue — opened it" : "Created curator candidate");
      setQueue("pending");
      reload();
      setOpenId(res.discoveryItemId);
    } catch (err) {
      announce(err instanceof CuratorApiError ? err.message : "Could not add that URL");
    }
  }

  async function changeEventStatus(event: AdminEvent, status: EventStatus) {
    try {
      await setEventStatus(event.id, status);
      announce(`“${event.title}” set to ${status}`);
      reload();
    } catch (err) {
      announce(err instanceof CuratorApiError ? err.message : "Status change failed");
    }
  }

  return (
    <div className="min-h-screen bg-[#0a130f] text-[#e9efe7]">
      <div aria-live="polite" className="sr-only">
        {toast?.msg}
      </div>

      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-[#25382e] bg-[#0a130f]/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex items-center gap-3">
          <AdminWordmark suffix="Curator · internal" />
        </div>
        <div className="flex items-center gap-2">
          <AdminBtn variant="primary" onClick={() => setShowAdd(true)}>
            + Add event
          </AdminBtn>
          <AdminBtn variant="ghost" onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)">
            ⌨
          </AdminBtn>
          <AdminLink href="/" variant="ghost" newTab={false}>
            Public site ↗
          </AdminLink>
          <AdminBtn
            variant="ghost"
            title="End this curator session"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              // refresh() as well as replace(): the cookie is gone, but the
              // router may still hold a cached payload for the guarded route.
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
            {QUEUES.map((q) => {
              const active = queue === q.key;
              const n = counts[q.key] ?? 0;
              return (
                <button
                  key={q.key}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => guard(() => { setQueue(q.key); setOpenId(null); })}
                  className={`flex shrink-0 items-center justify-between gap-3 border px-3 py-2 text-left font-mono text-[11px] uppercase tracking-[0.1em] transition-colors lg:shrink ${
                    active
                      ? "border-[#39ff9b] bg-[#0f2a1c] text-[#5effb0]"
                      : "border-transparent text-[#8ba295] hover:bg-white/5 hover:text-[#e9efe7]"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden>{q.glyph}</span>
                    {q.label}
                  </span>
                  {n > 0 && (
                    <span
                      className={`min-w-4 px-1 text-center text-[10px] ${
                        active ? "bg-[#39ff9b] text-[#04160d]" : "bg-[#25382e] text-[#a9bcb0]"
                      }`}
                    >
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="min-h-[70vh]">
          {loadError ? (
            <div className="m-4 border border-[#8a3630] bg-[#2a1310] p-4 lg:m-6">
              <p className="text-sm text-[#ff9a8a]">{loadError}</p>
              <div className="mt-3">
                <AdminBtn variant="outline" onClick={reload}>
                  Retry
                </AdminBtn>
              </div>
            </div>
          ) : openItem ? (
            <div>
              <div className="flex items-center justify-between border-b border-[#25382e] px-4 py-2.5 lg:px-6">
                <AdminBtn variant="ghost" onClick={() => guard(() => setOpenId(null))}>
                  ← Back to queue
                </AdminBtn>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f7568]">
                  {dirty ? "● Unsaved changes" : `Reviewing #${openItem.id}`}
                </span>
              </div>
              <CandidateReview
                key={openItem.id}
                item={openItem}
                onDirtyChange={setDirty}
                onCancel={() => guard(() => setOpenId(null))}
                onDone={(msg, href) => {
                  announce(msg, href);
                  setOpenId(null);
                  reload();
                }}
              />
            </div>
          ) : queue === "published" ? (
            <PublishedList
              events={published}
              loading={loading}
              onStatus={changeEventStatus}
              onRefresh={reload}
            />
          ) : (
            <div className="p-4 lg:p-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="min-w-[200px] flex-1">
                  <TextInput
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    aria-label="Search candidates"
                    placeholder="Search title, snippet, URL…  ( / )"
                  />
                </div>
                <Select
                  value={domainFilter}
                  onChange={(e) => setDomainFilter(e.target.value)}
                  aria-label="Filter by domain"
                  className="max-w-[190px]"
                >
                  <option value="all">All domains</option>
                  {domains.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </Select>
                {/* Source and category are server-side: they are derived from
                    the domain and the linked event, so filtering them in the
                    browser would only ever see the current 200-row page. */}
                <Select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  aria-label="Filter by source"
                  className="max-w-[190px]"
                >
                  <option value="">All sources</option>
                  {SOURCE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {SOURCE_TYPE_LABELS[type]}
                      {facets.source[type] ? ` (${facets.source[type]})` : ""}
                    </option>
                  ))}
                </Select>
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filter by category"
                  className="max-w-[190px]"
                >
                  <option value="">All categories</option>
                  {Object.entries(CATEGORY_FILTER_LABELS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                      {facets.category[key] ? ` (${facets.category[key]})` : ""}
                    </option>
                  ))}
                </Select>
                {(sourceFilter || categoryFilter) && (
                  <AdminBtn
                    variant="ghost"
                    onClick={() => {
                      setSourceFilter("");
                      setCategoryFilter("");
                    }}
                  >
                    Clear filters
                  </AdminBtn>
                )}
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f7568]">
                  {loading ? "Loading…" : `${filtered.length} item${filtered.length === 1 ? "" : "s"} · newest first`}
                </span>
              </div>

              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 border border-dashed border-[#2c4236] py-16 text-center">
                  <span className="font-display text-5xl font-black text-[#25382e]" aria-hidden>
                    ◐
                  </span>
                  <p className="max-w-sm text-sm text-[#8ba295]">
                    {items.length === 0 ? EMPTY_COPY[queue] : "Nothing matches those filters."}
                  </p>
                  {queue === "pending" && items.length === 0 && (
                    <AdminBtn variant="primary" onClick={() => setShowAdd(true)}>
                      + Add event manually
                    </AdminBtn>
                  )}
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  {filtered.map((item) => (
                    <QueueRow
                      key={item.id}
                      item={item}
                      onReview={() => setOpenId(item.id)}
                      onQuick={quickAction}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </main>
      </div>

      {showAdd && <AddDialog onAdd={handleAdd} onClose={() => setShowAdd(false)} />}
      {showHelp && <HelpDialog onClose={() => setShowHelp(false)} />}

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 border border-[#39ff9b] bg-[#0f2a1c] px-4 py-2.5 shadow-lg">
          <span aria-hidden className="text-[#39ff9b]">
            ✓
          </span>
          <span className="text-sm text-[#e9efe7]">{toast.msg}</span>
          {toast.href && (
            <a
              href={toast.href}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#39ff9b] underline underline-offset-2"
            >
              View →
            </a>
          )}
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            className="ml-1 font-mono text-sm text-[#8ba295] hover:text-[#e9efe7]"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function QueueRow({
  item,
  onReview,
  onQuick,
}: {
  item: QueueItem;
  onReview: () => void;
  onQuick: (item: QueueItem, action: "irrelevant" | "expired" | "rejected" | "reopen") => void;
}) {
  const linkedIn = item.source_domain === "linkedin.com" || item.source_domain.endsWith(".linkedin.com");
  const resolved = item.status === "curator_rejected" || item.status === "rejected" || item.status === "expired";

  return (
    <li className="border border-[#25382e] bg-[#101c16] p-4 transition-colors hover:border-[#33493c]">
      <div className="flex flex-wrap items-center gap-2">
        {linkedIn ? (
          <Pill tone="blue" glyph="↗">
            LinkedIn · never auto-fetched
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
        {item.origin === "community" && (
          <Pill tone="blue" glyph="✉">
            Community tip
          </Pill>
        )}
        {item.curator_draft && (
          <Pill tone="amber" glyph="✎">
            Draft saved
          </Pill>
        )}
        {item.extraction_meta?.sourceMethod && (
          <Pill tone="muted" glyph="◆">
            {item.extraction_meta.sourceMethod === "json_ld" ? "JSON-LD" : "model"}
          </Pill>
        )}
        {item.event_id && (
          <Pill tone="green" glyph="✓">
            event #{item.event_id}
          </Pill>
        )}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f7568]">
          #{item.id} · {relativeChecked(item.discovered_at)}
        </span>
      </div>

      <h3 className="mt-2.5 font-display text-base font-bold leading-tight">
        {item.title ?? "Untitled candidate"}
      </h3>
      {item.snippet && <p className="mt-1 line-clamp-2 text-sm text-[#a9bcb0]">{item.snippet}</p>}
      {item.query_text && (
        <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.1em] text-[#5f7568]">
          query: {item.query_text}
        </p>
      )}
      {item.rejection_reason && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#ffcf7a]">
          {item.rejection_reason}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {resolved ? (
          <AdminBtn variant="outline" onClick={() => onQuick(item, "reopen")}>
            Reopen
          </AdminBtn>
        ) : (
          <AdminBtn variant="primary" onClick={onReview}>
            Review
          </AdminBtn>
        )}
        <AdminLink href={item.url} variant="outline">
          {linkedIn ? "Open LinkedIn ↗" : "Open source ↗"}
        </AdminLink>
        {!resolved && (
          <>
            <AdminBtn variant="ghost" onClick={() => onQuick(item, "irrelevant")}>
              Irrelevant
            </AdminBtn>
            <AdminBtn variant="ghost" onClick={() => onQuick(item, "expired")}>
              Stale
            </AdminBtn>
            <AdminBtn variant="danger" onClick={() => onQuick(item, "rejected")}>
              Reject
            </AdminBtn>
          </>
        )}
      </div>
    </li>
  );
}

const EVENT_STATUS_OPTIONS: EventStatus[] = ["live", "updated", "postponed", "cancelled", "expired"];

function PublishedList({
  events,
  loading,
  onStatus,
  onRefresh,
}: {
  events: AdminEvent[];
  loading: boolean;
  onStatus: (event: AdminEvent, status: EventStatus) => void;
  onRefresh: () => void;
}) {
  const [q, setQ] = useState("");
  const list = events.filter(
    (e) =>
      !q ||
      `${e.title} ${e.organizerName ?? ""} ${e.venueName ?? ""} ${e.primarySourceUrl}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );

  return (
    <div className="p-4 lg:p-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <TextInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search published events"
            placeholder="Search published events…"
          />
        </div>
        <AdminBtn variant="ghost" onClick={onRefresh}>
          ↻ Refresh
        </AdminBtn>
        <span className="whitespace-nowrap font-mono text-[10px] uppercase tracking-[0.12em] text-[#5f7568]">
          {loading ? "Loading…" : `${list.length} published`}
        </span>
      </div>

      {loading ? (
        <SkeletonRows />
      ) : list.length === 0 ? (
        <div className="border border-dashed border-[#2c4236] p-12 text-center">
          <span className="font-display text-4xl font-black text-[#25382e]" aria-hidden>
            044
          </span>
          <p className="mt-3 text-sm text-[#8ba295]">
            Nothing published yet. Review a pending candidate and publish it — it appears in the public feed
            immediately.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((event) => (
            <li
              key={event.id}
              className="flex flex-wrap items-center gap-3 border border-[#25382e] bg-[#101c16] p-3"
            >
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone="muted" glyph="#">
                    {getFieldCardForCategory(event.category)?.label ?? event.category}
                  </Pill>
                  {event.sourceType === "curator" && (
                    <Pill tone="muted" glyph="+">
                      Curator
                    </Pill>
                  )}
                  {event.openReports > 0 && (
                    <Pill tone="red" glyph="!">
                      {event.openReports} report{event.openReports === 1 ? "" : "s"}
                    </Pill>
                  )}
                  {event.sourceCount > 1 && (
                    <Pill tone="muted" glyph="≈">
                      {event.sourceCount} sources
                    </Pill>
                  )}
                </div>
                <p className="mt-1.5 font-display text-sm font-bold leading-tight">{event.title}</p>
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-[#8ba295]">
                  #{event.id} ·{" "}
                  {event.startAt
                    ? `${formatSceneDate(event.startAt)} ${formatSceneTime(event.startAt)}`
                    : "no date"}{" "}
                  · {event.isOnline ? "Online" : (event.venueName ?? "no venue")}
                </p>
                <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-[#5f7568]">
                  {event.lastVerifiedAt ? `Verified ${relativeChecked(event.lastVerifiedAt)}` : "Never re-verified"}
                </p>
              </div>

              <Select
                value={event.status}
                aria-label={`Status for ${event.title}`}
                onChange={(e) => onStatus(event, e.target.value as EventStatus)}
                className="max-w-[160px]"
              >
                {EVENT_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>

              <div className="flex gap-2">
                <AdminLink href={`/?event=${event.id}`} variant="outline">
                  View ↗
                </AdminLink>
                <AdminLink href={event.primarySourceUrl} variant="ghost">
                  Source ↗
                </AdminLink>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkeletonRows() {
  return (
    <ul className="flex flex-col gap-3" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="border border-[#25382e] bg-[#101c16] p-4">
          <div className="h-3 w-32 animate-pulse bg-[#1c2c24]" />
          <div className="mt-3 h-4 w-2/3 animate-pulse bg-[#1c2c24]" />
          <div className="mt-2 h-3 w-1/2 animate-pulse bg-[#1c2c24]" />
        </li>
      ))}
    </ul>
  );
}

function AddDialog({ onAdd, onClose }: { onAdd: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState("");
  return (
    <Overlay label="Add event" onClose={onClose}>
      <h2 className="font-display text-xl font-bold">Add event manually</h2>
      <p className="mt-2 text-sm text-[#a9bcb0]">
        Paste a LinkedIn or registration URL. It&apos;s normalized, matched against the existing queue, and routed
        through the same review, dedup and audit path as a search-discovered candidate. Nothing is fetched yet.
      </p>
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (url.trim()) onAdd(url.trim());
        }}
      >
        <TextInput
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Event URL"
          placeholder="https://lu.ma/… or https://linkedin.com/events/…"
        />
        <div className="flex gap-2">
          <AdminBtn type="submit" variant="primary" disabled={!url.trim()}>
            Add &amp; review
          </AdminBtn>
          <AdminBtn variant="ghost" onClick={onClose}>
            Cancel
          </AdminBtn>
        </div>
      </form>
    </Overlay>
  );
}

function HelpDialog({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ["/", "Focus search"],
    ["j / k", "Next / previous candidate"],
    ["?", "Toggle this panel"],
    ["Esc", "Close review / blur field"],
  ];
  return (
    <Overlay label="Keyboard shortcuts" onClose={onClose}>
      <h2 className="font-display text-xl font-bold">Keyboard shortcuts</h2>
      <dl className="mt-4 flex flex-col gap-2">
        {rows.map(([key, description]) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <dt className="text-sm text-[#a9bcb0]">{description}</dt>
            <dd>
              <kbd className="border border-[#33493c] bg-[#0b1611] px-2 py-0.5 font-mono text-[11px] text-[#39ff9b]">
                {key}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-5">
        <AdminBtn variant="ghost" onClick={onClose}>
          Close
        </AdminBtn>
      </div>
    </Overlay>
  );
}

function Overlay({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div
        className="w-full max-w-md border border-[#25382e] bg-[#101c16] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
