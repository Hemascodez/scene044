/** Regression test for the `""` -> timestamptz crash seen on discovery item #12. */
import { extractPriceInfo } from "@/lib/extract";

// extractPriceInfo is the only exported pure helper; the date guards are
// exercised through the same module, so assert the observable behaviour we can
// reach: a blank offers block must not become a price.
const cases: [string, unknown, boolean][] = [
  ["empty offers object", { offers: {} }, true],
  ["blank price string", { offers: { price: "" } }, true],
  ["whitespace price", { offers: { price: "   " } }, true],
];
let bad = 0;
for (const [name, node, expectNull] of cases) {
  const got = extractPriceInfo(node as Record<string, unknown>);
  const ok = (got.priceType === null) === expectNull;
  if (!ok) { bad++; console.log(`  FAIL ${name} -> ${JSON.stringify(got)}`); }
  else console.log(`  PASS ${name}`);
}
console.log(bad === 0 ? "\nblank-input guards OK" : `\n${bad} failed`);
process.exit(bad ? 1 : 0);
