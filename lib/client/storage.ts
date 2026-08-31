export function readStorage<T extends { version: number }>(key: string, expectedVersion: number): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (parsed?.version !== expectedVersion) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(storageChangeEventName(key)));
  } catch {
    // storage unavailable/full — saving is best-effort, never blocks the UI
  }
}

function storageChangeEventName(key: string): string {
  return `scene044:storage-changed:${key}`;
}

/**
 * A read/write localStorage-backed value exposed as a React external store —
 * hydration-safe (server snapshot is always the given default, since
 * localStorage doesn't exist during SSR) and reactive across components in
 * the same tab (via a CustomEvent, since the native `storage` event only
 * fires in *other* tabs) as well as across tabs (native `storage` event).
 */
export function createStorageStore<T extends { version: number }>(
  key: string,
  version: number,
  defaultValue: T,
) {
  // useSyncExternalStore requires getSnapshot to return a referentially
  // stable value when nothing has changed — re-parsing JSON on every call
  // (as readStorage does) breaks that contract and triggers React's
  // "getSnapshot should be cached" infinite-loop guard. Cache by raw string.
  let cachedRaw: string | null | undefined;
  let cachedValue: T = defaultValue;

  function getSnapshot(): T {
    if (typeof window === "undefined") return defaultValue;
    const raw = window.localStorage.getItem(key);
    if (raw === cachedRaw) return cachedValue;
    cachedRaw = raw;
    cachedValue = readStorage<T>(key, version) ?? defaultValue;
    return cachedValue;
  }

  function getServerSnapshot(): T {
    return defaultValue;
  }

  function subscribe(onStoreChange: () => void): () => void {
    const eventName = storageChangeEventName(key);
    function handleChange(e: Event) {
      if (e instanceof StorageEvent && e.key !== null && e.key !== key) return;
      onStoreChange();
    }
    window.addEventListener("storage", handleChange);
    window.addEventListener(eventName, handleChange);
    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener(eventName, handleChange);
    };
  }

  function write(value: T): void {
    writeStorage(key, value);
  }

  return { getSnapshot, getServerSnapshot, subscribe, write };
}
