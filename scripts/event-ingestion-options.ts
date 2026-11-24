import { ingestionMarkets } from "../lib/eventIngestionScope";

/** Pure parser so malformed operator input is tested without importing a DB or
 * starting a pipeline. Repeated/comma-separated markets and item IDs supported. */
export function parseIngestionOptions(args: readonly string[]) {
  const flags = new Set<string>();
  const values = new Map<string, string[]>();
  const switches = ["discover-only", "extract-only", "verify-only", "cleanup-only"];
  const valued = ["city", "market", "item-id", "limit", "site", "max-minutes", "max-publish"];
  for (let i = 0; i < args.length; i++) {
    const name = args[i].replace(/^--/, "");
    if (args[i] !== `--${name}`) throw new Error(`Unexpected argument: ${args[i]}`);
    if (switches.includes(name)) { flags.add(name); continue; }
    if (!valued.includes(name)) throw new Error(`Unknown option: --${name}`);
    const value = args[++i];
    if (!value?.trim() || value.startsWith("--")) throw new Error(`--${name} needs a value`);
    values.set(name, [...values.get(name) ?? [], value]);
  }
  if (flags.size > 1) throw new Error("Choose at most one --*-only mode");
  const list = (name: string) => (values.get(name) ?? []).flatMap(value => value.split(",").map(v => v.trim()));
  const one = (name: string) => {
    const entries = values.get(name);
    if (entries && entries.length !== 1) throw new Error(`--${name} may only be supplied once`);
    return entries?.[0];
  };
  const number = (name: string, min: number, max: number) => {
    const raw = one(name);
    if (raw === undefined) return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`--${name} must be ${min}..${max}`);
    return value;
  };
  const markets = ingestionMarkets([...list("city"), ...list("market")]);
  const itemIds = list("item-id").map(raw => {
    const id = Number(raw);
    if (!raw || !Number.isSafeInteger(id) || id < 1) throw new Error("--item-id must contain positive integers");
    return id;
  });
  if (itemIds.length && !flags.has("extract-only")) throw new Error("--item-id requires --extract-only");
  if (markets.length && (flags.has("verify-only") || flags.has("cleanup-only"))) {
    throw new Error("Market filters support discovery/extraction only");
  }
  return {
    discoverOnly: flags.has("discover-only"), extractOnly: flags.has("extract-only"),
    verifyOnly: flags.has("verify-only"), cleanupOnly: flags.has("cleanup-only"),
    markets, itemIds: [...new Set(itemIds)], site: one("site"),
    limit: number("limit", 1, 100), maxMinutes: number("max-minutes", 1, 120),
    maxPublish: number("max-publish", 0, 50),
  };
}
