/** Self-hosted poster paths (/api/poster/<id>) must be accepted by the
 *  approve route's validation — every curator upload produces exactly this
 *  shape (lib/posterStore.ts), and rejecting it blocked every upload. */

function safeHttpUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}
function safePosterUrl(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  if (/^\/api\/poster\/\d+$/.test(raw)) return raw;
  return safeHttpUrl(raw);
}

let pass = 0, fail = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (ok) pass++;
  else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${actual} want=${expected}`}`);
}

check("self-hosted poster path accepted", safePosterUrl("/api/poster/7"), "/api/poster/7");
check("self-hosted poster, larger id", safePosterUrl("/api/poster/12345"), "/api/poster/12345");
check("absolute https URL still accepted", safePosterUrl("https://example.com/x.jpg"), "https://example.com/x.jpg");
check("empty string is null, not an error", safePosterUrl(""), null);
check("null passes through", safePosterUrl(null), null);
check("path traversal rejected", safePosterUrl("/api/poster/../../etc/passwd"), null);
check("non-numeric id falls through to safeHttpUrl and fails", safePosterUrl("/api/poster/abc"), null);
check("unrelated relative path rejected", safePosterUrl("/etc/passwd"), null);
check("javascript: scheme rejected", safePosterUrl("javascript:alert(1)"), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
