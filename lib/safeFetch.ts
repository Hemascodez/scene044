import { promises as dns } from "node:dns";
import { BlockList } from "node:net";
import { normalizeDomain } from "@/lib/domain";

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const ALLOWED_CONTENT_TYPE_RE =
  /^(text\/html|application\/json|application\/ld\+json)\s*(;.*)?$/i;

const PRIVATE_BLOCKLIST = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  PRIVATE_BLOCKLIST.addSubnet(address, prefix, "ipv4");
}
PRIVATE_BLOCKLIST.addAddress("::1", "ipv6");
PRIVATE_BLOCKLIST.addSubnet("fc00::", 7, "ipv6"); // unique local
PRIVATE_BLOCKLIST.addSubnet("fe80::", 10, "ipv6"); // link-local

const IPV4_MAPPED_RE = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

function isDisallowedIp(address: string, family: number): boolean {
  if (PRIVATE_BLOCKLIST.check(address, family === 4 ? "ipv4" : "ipv6")) {
    return true;
  }
  if (family === 6) {
    const mapped = address.match(IPV4_MAPPED_RE);
    if (mapped && PRIVATE_BLOCKLIST.check(mapped[1], "ipv4")) return true;
  }
  return false;
}

async function resolveHostIps(
  hostname: string,
): Promise<{ address: string; family: number }[] | null> {
  try {
    const result = await dns.lookup(hostname, { all: true, verbatim: true });
    return result;
  } catch {
    return null;
  }
}

type HostCheck = { ok: true } | { ok: false; reason: string };

async function validateHost(
  url: URL,
  allowedDomains: Set<string> | null,
): Promise<HostCheck> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: `disallowed_protocol:${url.protocol}` };
  }
  // `null` = no domain allowlist (see safeFetchBinary). Every other guard —
  // protocol, private-IP resolution on each hop, size cap, content type —
  // still applies.
  if (allowedDomains) {
    const domain = normalizeDomain(url.toString());
    if (!allowedDomains.has(domain)) {
      return { ok: false, reason: `domain_not_allowlisted:${domain}` };
    }
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const ips = await resolveHostIps(hostname);
  if (!ips || ips.length === 0) {
    return { ok: false, reason: "dns_resolution_failed" };
  }
  if (ips.some((r) => isDisallowedIp(r.address, r.family))) {
    return { ok: false, reason: "resolves_to_private_ip" };
  }
  return { ok: true };
}

export type SafeFetchResult =
  | { ok: true; text: string; finalUrl: string }
  | { ok: false; reason: string };

/**
 * Fetches text content while defending against SSRF: rejects non-http(s)
 * protocols, domains outside the caller's allowlist, hosts resolving to
 * private/loopback/link-local IPs (checked on every redirect hop, not just
 * the initial URL), oversized responses (enforced by counting bytes as they
 * stream in, since Content-Length can lie), and unexpected content types.
 *
 * Known residual gap: DNS is re-resolved by the underlying fetch
 * implementation when it actually connects, after this function's own
 * lookup — a narrow TOCTOU/DNS-rebinding window against an already-allowlisted
 * domain. Closing it fully requires pinning the validated IP via a custom
 * connect/lookup on the HTTP agent, deferred until this fetcher is ever
 * pointed at untrusted (non-allowlisted) URLs.
 */
export async function safeFetchText(
  url: string,
  opts: { allowedDomains: string[]; timeoutMs?: number; maxBytes?: number },
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const allowed = new Set(opts.allowedDomains.map((d) => d.toLowerCase()));

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const check = await validateHost(current, allowed);
      if (!check.ok) return check;

      let res: Response;
      try {
        res = await fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ChennaiEventsBot/1.0)",
          },
        });
      } catch (err) {
        return {
          ok: false,
          reason: controller.signal.aborted
            ? "timeout"
            : `fetch_failed:${String(err).slice(0, 200)}`,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, reason: "redirect_without_location" };
        if (hop === MAX_REDIRECTS) return { ok: false, reason: "too_many_redirects" };
        current = new URL(location, current);
        continue;
      }

      if (!res.ok) return { ok: false, reason: `http_${res.status}` };

      const contentType = (res.headers.get("content-type") ?? "").trim();
      if (!ALLOWED_CONTENT_TYPE_RE.test(contentType)) {
        return { ok: false, reason: `disallowed_content_type:${contentType}` };
      }
      if (!res.body) return { ok: false, reason: "empty_body" };

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, reason: "response_too_large" };
        }
        chunks.push(value);
      }
      return {
        ok: true,
        text: Buffer.concat(chunks).toString("utf-8"),
        finalUrl: current.toString(),
      };
    }
    return { ok: false, reason: "too_many_redirects" };
  } finally {
    clearTimeout(timer);
  }
}

const IMAGE_CONTENT_TYPE_RE = /^image\/(jpeg|png|webp)\s*(;.*)?$/i;
const DEFAULT_MAX_IMAGE_BYTES = 5_000_000;

export type SafeFetchBinaryResult =
  | { ok: true; bytes: Buffer; contentType: string; finalUrl: string }
  | { ok: false; reason: string };

/**
 * Binary sibling of `safeFetchText`, used to re-host event posters instead of
 * hotlinking them. Same guards: http(s) only, private/loopback/link-local IPs
 * rejected on every redirect hop, byte cap counted while streaming (never
 * trusting Content-Length), and a raster-image content-type allowlist that
 * excludes SVG.
 *
 * `allowedDomains` may be null. Poster imports are curator-initiated against
 * arbitrary image CDNs (meetup posters live on secure.meetupstatic.com, not
 * meetup.com), so an up-front domain allowlist isn't workable. That widens the
 * DNS-rebinding TOCTOU window described above from allowlisted hosts to any
 * host: the pre-flight lookup and the connection's own lookup can disagree.
 * Two things bound the impact — the caller is an authenticated curator, and the
 * response is only ever stored after `detectImageMime` confirms real image
 * magic bytes, so a rebind onto an internal HTTP service yields a rejected
 * upload rather than exfiltrated content. Closing it properly needs a
 * connect-time IP pin on the dispatcher.
 */
export async function safeFetchBinary(
  url: string,
  opts: { allowedDomains?: string[] | null; timeoutMs?: number; maxBytes?: number } = {},
): Promise<SafeFetchBinaryResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_IMAGE_BYTES;
  const allowed =
    opts.allowedDomains == null ? null : new Set(opts.allowedDomains.map((d) => d.toLowerCase()));

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const check = await validateHost(current, allowed);
      if (!check.ok) return check;

      let res: Response;
      try {
        res = await fetch(current.toString(), {
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "Mozilla/5.0 (compatible; ChennaiEventsBot/1.0)" },
        });
      } catch (err) {
        return {
          ok: false,
          reason: controller.signal.aborted
            ? "timeout"
            : `fetch_failed:${String(err).slice(0, 200)}`,
        };
      }

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) return { ok: false, reason: "redirect_without_location" };
        if (hop === MAX_REDIRECTS) return { ok: false, reason: "too_many_redirects" };
        current = new URL(location, current);
        continue;
      }

      if (!res.ok) return { ok: false, reason: `http_${res.status}` };

      const contentType = (res.headers.get("content-type") ?? "").trim();
      if (!IMAGE_CONTENT_TYPE_RE.test(contentType)) {
        return { ok: false, reason: `disallowed_content_type:${contentType || "none"}` };
      }
      if (!res.body) return { ok: false, reason: "empty_body" };

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel();
          return { ok: false, reason: "response_too_large" };
        }
        chunks.push(value);
      }
      return {
        ok: true,
        bytes: Buffer.concat(chunks),
        contentType: contentType.split(";")[0].trim().toLowerCase(),
        finalUrl: current.toString(),
      };
    }
    return { ok: false, reason: "too_many_redirects" };
  } finally {
    clearTimeout(timer);
  }
}
