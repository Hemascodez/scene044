import { pool } from "../lib/db";
import { runWhatsappDigest, type DigestMode } from "../lib/whatsappDigest";

function requestedMode(args: string[]): DigestMode {
  const known = new Set(["--dry-run", "--test"]);
  const unknown = args.filter((arg) => arg.startsWith("--") && !known.has(arg));
  if (unknown.length > 0) throw new Error(`Unknown option: ${unknown.join(", ")}`);
  if (args.includes("--dry-run") && args.includes("--test")) {
    throw new Error("Choose either --dry-run or --test, not both");
  }
  if (args.includes("--dry-run")) return "dry-run";
  if (args.includes("--test")) return "test";
  return "production";
}

async function main() {
  const mode = requestedMode(process.argv.slice(2));
  const result = await runWhatsappDigest(mode);
  const output = mode === "production" ? { ...result, previews: undefined } : result;
  console.log(JSON.stringify(output, null, 2));
  if (result.aborted) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("whatsapp-digest failed", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
