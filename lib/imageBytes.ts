/**
 * Image type detection from magic bytes, not from the filename or the
 * client-supplied Content-Type — both are attacker-controlled on an upload.
 *
 * This is also what excludes SVG: an SVG is XML and can carry <script>, so
 * serving one back from our own origin would be a stored-XSS vector. It has no
 * binary signature, so it simply never matches here.
 */
export type SupportedImageMime = "image/jpeg" | "image/png" | "image/webp";

export function detectImageMime(bytes: Buffer | Uint8Array): SupportedImageMime | null {
  const b = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (b.length < 12) return null;

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  // PNG: 89 "PNG" CR LF 1A LF
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" <4-byte size> "WEBP"
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }

  return null;
}

export const MAX_POSTER_BYTES = 5_000_000;
