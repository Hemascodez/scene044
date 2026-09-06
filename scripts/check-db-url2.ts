import fs from "node:fs";
import path from "node:path";
let raw: string | null = null;
for (const line of fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
  if (line.startsWith("SUPABASE_DATABASE_URL=")) raw = line.slice("SUPABASE_DATABASE_URL=".length);
}
if (raw === null) { console.log("  not found"); process.exit(1); }
const variants: [string, string][] = [
  ["exactly as stored (incl. any trailing \\r)", raw],
  ["trimmed", raw.trim()],
];
for (const [label, v] of variants) {
  try {
    // This is what pg-connection-string does internally.
    new URL(v, "postgres://base");
    console.log(`  PASS  ${label}`);
  } catch (e) {
    console.log(`  FAIL  ${label} -> ${(e as Error).message}`);
  }
}
const t = raw.trim();
console.log("  trailing CR present:", raw.includes("\r"));
console.log("  contains a space   :", /\s/.test(t));
console.log("  starts with        :", t.slice(0, 13));
console.log("  length             :", t.length);
