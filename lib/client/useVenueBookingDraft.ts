"use client";

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

type SaveStatus = "idle" | "saving" | "saved" | "local";

interface StoredDraft<T> {
  value: T;
  updatedAt: number;
}

interface DraftOptions<T extends { spaceId: string }> {
  venueSlug: string;
  initial: T;
  profilePhone: string | null;
  authReady: boolean;
  parse: (data: unknown, spaceId: string) => T | null;
  serialize: (value: T) => Record<string, unknown>;
  /** Explicit search criteria override selection fields, not saved prose. */
  selection?: Partial<T>;
}

function storageKey(venueSlug: string, owner: string): string {
  return `scene044.venueBookingDraft.v1:${venueSlug}:${owner}`;
}

function readLocal<T extends { spaceId: string }>(
  key: string,
  parse: DraftOptions<T>["parse"],
): StoredDraft<T> | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { value?: { spaceId?: unknown }; updatedAt?: unknown };
    if (!saved.value || typeof saved.value.spaceId !== "string" || typeof saved.updatedAt !== "number") return null;
    const value = parse(saved.value, saved.value.spaceId);
    return value ? { value, updatedAt: saved.updatedAt } : null;
  } catch {
    return null;
  }
}

/**
 * A visitor's unfinished form survives a refresh on this device. Once their
 * WhatsApp account is verified, the same draft is saved to Postgres and can be
 * resumed on another device. A draft never establishes identity or consent.
 */
export function useVenueBookingDraft<T extends { spaceId: string }>({
  venueSlug, initial, profilePhone, authReady, parse, serialize, selection,
}: DraftOptions<T>) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const initialRef = useRef(initial);
  const selectionRef = useRef(selection);
  const editRevision = useRef(0);
  const dirtyRef = useRef(false);
  const ownerRef = useRef<string | null>(null);
  const updatedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const finishedRef = useRef(false);

  const owner = !authReady ? null : profilePhone ? `user:${profilePhone.replace(/\D/g, "").slice(-10)}` : "anon";

  const update = useCallback((next: SetStateAction<T>) => {
    editRevision.current += 1;
    updatedAtRef.current = Math.max(Date.now(), updatedAtRef.current + 1);
    dirtyRef.current = true;
    setDirty(true);
    setValue(next);
  }, []);

  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    const priorOwner = ownerRef.current;
    ownerRef.current = owner;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- account changes require loading that account's saved draft
    setReady(false);
    const startRevision = editRevision.current;

    // OTP completed while the visitor was editing: keep the current form,
    // then let the save effect attach it to the freshly verified account.
    if (owner !== "anon" && (priorOwner === "anon" || priorOwner === null) && dirtyRef.current) {
      setReady(true);
      return;
    }
    if (priorOwner && priorOwner !== owner && priorOwner !== "anon") {
      setValue(initialRef.current);
      dirtyRef.current = false;
      setDirty(false);
    }

    const local = readLocal(storageKey(venueSlug, owner), parse);
    const restore = (saved: StoredDraft<T> | null, needsSync: boolean) => {
      if (cancelled) return;
      if (editRevision.current === startRevision && saved) {
        const selection = selectionRef.current ?? {};
        const changed = Object.entries(selection).some(([key, value]) => saved.value[key as keyof T] !== value);
        const sync = needsSync || changed;
        updatedAtRef.current = changed ? Math.max(Date.now(), saved.updatedAt + 1) : saved.updatedAt;
        setValue({ ...saved.value, ...selection });
        dirtyRef.current = sync;
        setDirty(sync);
        setSaveStatus(sync || owner === "anon" ? "local" : "saved");
      } else if (editRevision.current === startRevision && !saved && Object.keys(selectionRef.current ?? {}).length) {
        // Search-to-form handoff is progress too; persist it even before the
        // organiser types their next field, without dropping restored prose.
        updatedAtRef.current = Math.max(Date.now(), updatedAtRef.current + 1);
        dirtyRef.current = true;
        setDirty(true);
      }
      setReady(true);
    };

    if (owner === "anon") {
      restore(local, Boolean(local));
      return () => { cancelled = true; };
    }

    fetch(`/api/venue-booking-drafts?venueSlug=${encodeURIComponent(venueSlug)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load account draft");
        const result = await response.json() as {
          draft?: { spaceId: string; formData: unknown; editedAtMs: number } | null;
          clearedAtMs?: number;
        };
        updatedAtRef.current = Math.max(updatedAtRef.current, result.clearedAtMs ?? 0);
        const remoteValue = result.draft && parse(result.draft.formData, result.draft.spaceId);
        const remoteTime = result.draft?.editedAtMs ?? 0;
        const currentLocal = local && local.updatedAt > (result.clearedAtMs ?? 0) ? local : null;
        if (local && !currentLocal) {
          try { window.localStorage.removeItem(storageKey(venueSlug, owner)); } catch { /* storage may be unavailable */ }
        }
        if (currentLocal && (!remoteValue || currentLocal.updatedAt > remoteTime)) restore(currentLocal, true);
        else if (remoteValue) {
          restore({ value: remoteValue, updatedAt: remoteTime }, false);
          if (!cancelled && editRevision.current === startRevision) {
            try {
              window.localStorage.setItem(storageKey(venueSlug, owner), JSON.stringify({
                value: { ...serialize(remoteValue), spaceId: remoteValue.spaceId }, updatedAt: remoteTime,
              }));
            } catch { /* private browsing may disable storage */ }
          }
        } else restore(null, false);
      })
      .catch(() => restore(local, Boolean(local)));
    return () => { cancelled = true; };
  }, [owner, venueSlug, parse, serialize]);

  // The account lookup may still be loading while the visitor starts typing.
  // Keep those first edits even if the lookup or the network never finishes.
  useEffect(() => {
    if (authReady || !dirty || finishedRef.current) return;
    try {
      window.localStorage.setItem(storageKey(venueSlug, "anon"), JSON.stringify({
        value: { ...serialize(value), spaceId: value.spaceId }, updatedAt: updatedAtRef.current,
      }));
    } catch { /* private browsing may disable storage */ }
  }, [authReady, dirty, venueSlug, value, serialize]);

  useEffect(() => {
    if (!ready || !owner || !dirty || finishedRef.current) return;
    try {
      window.localStorage.setItem(storageKey(venueSlug, owner), JSON.stringify({
        value: { ...serialize(value), spaceId: value.spaceId }, updatedAt: updatedAtRef.current,
      }));
      if (owner !== "anon") window.localStorage.removeItem(storageKey(venueSlug, "anon"));
    } catch { /* keep the form usable if local storage is disabled */ }
    if (owner === "anon") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects a successful browser-storage write
      setSaveStatus("local");
      return;
    }

    setSaveStatus("saving");
    const revision = editRevision.current;
    const payload = JSON.stringify({ venueSlug, spaceId: value.spaceId, formData: serialize(value), editedAtMs: updatedAtRef.current });
    timerRef.current = setTimeout(() => {
      const save = async () => {
        if (ownerRef.current !== owner || finishedRef.current) return;
        const response = await fetch("/api/venue-booking-drafts", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!response.ok) throw new Error("Could not sync booking draft");
        if (editRevision.current === revision && !finishedRef.current) setSaveStatus("saved");
      };
      queueRef.current = queueRef.current.catch(() => undefined).then(save).catch(() => {
        if (editRevision.current === revision && !finishedRef.current) setSaveStatus("local");
      });
    }, 700);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [value, ready, dirty, owner, venueSlug, serialize]);

  // Navigating away inside the debounce window must still reach the account.
  // keepalive lets the browser finish this small request during page unload;
  // the timestamp guard in Postgres prevents an older in-flight save winning.
  useEffect(() => {
    if (!ready || !dirty || !owner || owner === "anon") return;
    const flush = () => {
      if (finishedRef.current) return;
      void fetch("/api/venue-booking-drafts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueSlug, spaceId: value.spaceId, formData: serialize(value), editedAtMs: updatedAtRef.current }),
        keepalive: true,
      }).catch(() => undefined);
    };
    const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [ready, dirty, owner, venueSlug, value, serialize]);

  const clear = useCallback(async () => {
    finishedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      window.localStorage.removeItem(storageKey(venueSlug, "anon"));
      if (owner) window.localStorage.removeItem(storageKey(venueSlug, owner));
    } catch { /* storage may be unavailable */ }
    await queueRef.current.catch(() => undefined);
    if (owner && owner !== "anon") {
      await fetch("/api/venue-booking-drafts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueSlug, spaceId: value.spaceId }),
      });
    }
    setSaveStatus("idle");
  }, [owner, venueSlug, value.spaceId]);

  return { value, update, ready, saveStatus, clear };
}
