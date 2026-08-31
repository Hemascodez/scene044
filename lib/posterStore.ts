import { query } from "@/lib/db";
import { detectImageMime, MAX_POSTER_BYTES } from "@/lib/imageBytes";
import { safeFetchBinary } from "@/lib/safeFetch";

export type StoreResult =
  | { ok: true; id: number; url: string; mime: string; byteSize: number }
  | { ok: false; error: string };

/** The public path a stored poster is served from. Written into
 *  events.poster_image_url, so it must stay stable. */
export function posterUrl(id: number): string {
  return `/api/poster/${id}`;
}

/**
 * Persists image bytes after verifying them.
 *
 * The MIME stored is always the one detected from the file's own magic bytes —
 * a filename or a client-sent Content-Type is attacker-controlled, and this
 * value is later echoed back as a response header.
 */
export async function storePosterBytes(
  bytes: Buffer,
  origin: "upload" | "import" | "auto",
  originUrl: string | null,
): Promise<StoreResult> {
  if (bytes.byteLength === 0) return { ok: false, error: "That file is empty." };
  if (bytes.byteLength > MAX_POSTER_BYTES) {
    return {
      ok: false,
      error: `Too large (${(bytes.byteLength / 1_000_000).toFixed(1)} MB). Maximum is ${MAX_POSTER_BYTES / 1_000_000} MB.`,
    };
  }

  const mime = detectImageMime(bytes);
  if (!mime) {
    return {
      ok: false,
      error: "Not a JPG, PNG or WebP image. SVG is not accepted.",
    };
  }

  const {
    rows: [row],
  } = await query<{ id: number }>(
    `INSERT INTO poster_uploads (mime, bytes, byte_size, origin, origin_url)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [mime, bytes, bytes.byteLength, origin, originUrl],
  );

  return { ok: true, id: row.id, url: posterUrl(row.id), mime, byteSize: bytes.byteLength };
}

/**
 * Downloads a remote poster through the SSRF-guarded fetcher and re-hosts it.
 * Returns null on any failure — callers treat a missing poster as normal, so
 * this must never be the reason an event fails to be created.
 */
export async function importPosterFromUrl(
  url: string,
  origin: "import" | "auto",
): Promise<StoreResult> {
  const fetched = await safeFetchBinary(url, { maxBytes: MAX_POSTER_BYTES });
  if (!fetched.ok) {
    return { ok: false, error: `Could not fetch that image (${fetched.reason}).` };
  }
  return storePosterBytes(fetched.bytes, origin, fetched.finalUrl);
}
