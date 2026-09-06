/** Validates SUPABASE_DATABASE_URL parses the way `pg` will parse it, without
 *  connecting and without printing the password. */
import fs from "node:fs";
import path from "node:path";

const file = path.join(__dirname, "..", ".env.local");
let raw: string | null = null;
for (const line of fs.readFileSync(file, "utf8").split("\n")) {
  if (line.startsWith("SUPABASE_DATABASE_URL=")) raw = line.slice("SUPABASE_DATABASE_URL=".length).trim();
}
if (!raw) { console.log("not found"); process.exit(1); }

const m = raw.match(/^postgres(?:ql)?:\/\/([^:@/]+):([^@]*)@/);
const pwd = m ? m[2] : "";
const pct = [...pwd.matchAll(/%(.{0,2})/g)].map((x) => "%" + x[1]);

try {
  const u = new URL(raw);
  console.log("new URL() succeeded");
  console.log("  host      :", u.hostname);
  console.log("  port      :", u.port);
  console.log("  username  :", u.username);
  // What pg will actually send as the password after URL decoding.
  const decoded = decodeURIComponent(u.password);
  console.log("  percent sequences in password:", pct.length ? pct.join(", ") : "none");
  console.log("  password length as written   :", pwd.length);
  console.log("  password length after decode :", decoded.length);
  /*
   * Decoding SHOULD change the string when percent-escapes are present — that
   * is what they are for. %26 %40 %24 in a URL mean the real password contains
   * & @ $, and pg decodes them before authenticating. So a length change here
   * is correct, not a fault, PROVIDED the escapes were written deliberately.
   * The only genuine failure is a malformed escape, which makes new URL()
   * throw outright and is caught below.
   */
  if (pct.length) {
    const malformed = pct.filter((seq) => !/^%[0-9a-fA-F]{2}$/.test(seq));
    console.log(
      malformed.length
        ? `  -> MALFORMED escape(s): ${malformed.join(", ")} — fix or remove`
        : "  -> escapes are well-formed; pg will decode them to the real password",
    );
  } else {
    console.log("  -> no escapes; password passes through unchanged");
  }
} catch (e) {
  console.log("new URL() FAILED:", (e as Error).message);
  console.log("  percent sequences:", pct.join(", "));
}
