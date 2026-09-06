/**
 * Validates a Postgres connection string the way `pg` will parse it, without
 * connecting and without ever printing the password.
 *
 * Written after three failed deploys traced to one character: a `#` in the
 * password. In URL syntax `#` starts a fragment, so `new URL()` throws
 * ERR_INVALID_URL and the host is never even read — the app fails instantly
 * with "Invalid URL" and no connection is attempted. Percent-encoding is fine
 * (%26 %40 %24 decode back correctly); a raw `#` is not.
 *
 *   npx tsx scripts/check-db-url.ts                       # checks SUPABASE_DATABASE_URL
 *   npx tsx scripts/check-db-url.ts DATABASE_URL          # or any other key
 */
import fs from "node:fs";
import path from "node:path";

const KEY = process.argv[2] ?? "SUPABASE_DATABASE_URL";

function readEnvValue(key: string): string | null {
  const file = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.startsWith(`${key}=`)) return line.slice(key.length + 1);
  }
  return null;
}

const raw = readEnvValue(KEY);
if (raw === null) {
  console.log(`${KEY} not found in .env.local`);
  process.exit(1);
}

const value = raw.trim().replace(/^["']|["']$/g, "");
let failures = 0;
function check(label: string, passed: boolean, detail = "") {
  if (!passed) failures++;
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${label}${detail ? `  -> ${detail}` : ""}`);
}

check("no surrounding quotes", raw.trim() === value);
check("no stray whitespace", raw.trim() === raw.replace(/\r?\n$/, ""));
check("no '#' (would truncate the URL)", !value.includes("#"));
check("no leftover [ ] placeholder brackets", !/[[\]]/.test(value.split("@")[0] ?? ""));

try {
  // Exactly what pg-connection-string does internally.
  const u = new URL(value, "postgres://base");
  check("parses as pg parses it", true);
  check("host looks like a pooler", u.hostname.includes("pooler."), u.hostname);
  check("port is 6543 (transaction pooler)", u.port === "6543", u.port);
  check("username carries the project ref", u.username.includes("."), u.username);
  check("password is non-empty", u.password.length > 0, `${u.password.length} chars after decoding`);

  const escapes = [...value.matchAll(/%(.{0,2})/g)].map((m) => `%${m[1]}`);
  const malformed = escapes.filter((e) => !/^%[0-9a-fA-F]{2}$/.test(e));
  check("percent-escapes are well-formed", malformed.length === 0, malformed.join(", "));
} catch (err) {
  check("parses as pg parses it", false, (err as Error).message);
}

console.log(failures === 0 ? "\nREADY — safe to paste into the host's variables" : `\n${failures} problem(s) — fix before deploying`);
process.exit(failures === 0 ? 0 : 1);
