/**
 * Exercises schema.org price extraction against the shapes real event
 * platforms actually emit. Pure-function test — no network, no DB.
 *
 * Run: node --import tsx scripts/test-price-extraction.ts
 */
import { extractPriceInfo } from "@/lib/extract";

interface Case {
  name: string;
  node: Record<string, unknown>;
  expectType: "free" | "paid" | null;
  expectNote: string | null;
}

const CASES: Case[] = [
  {
    name: "no price info at all (meetup.com — verified live)",
    node: { name: "DevDay" },
    expectType: null,
    expectNote: null,
  },
  {
    name: "isAccessibleForFree: true",
    node: { isAccessibleForFree: true },
    expectType: "free",
    expectNote: null,
  },
  {
    name: 'isAccessibleForFree: "true" (string form seen in the wild)',
    node: { isAccessibleForFree: "true" },
    expectType: "free",
    expectNote: null,
  },
  {
    name: "isAccessibleForFree: false, no amount",
    node: { isAccessibleForFree: false },
    expectType: "paid",
    expectNote: null,
  },
  {
    name: "single Offer, price 0 (Eventbrite free ticket)",
    node: { offers: { "@type": "Offer", price: "0", priceCurrency: "INR" } },
    expectType: "free",
    expectNote: null,
  },
  {
    name: "single Offer, numeric INR price",
    node: { offers: { "@type": "Offer", price: 499, priceCurrency: "INR" } },
    expectType: "paid",
    expectNote: "₹499",
  },
  {
    name: "string price with symbol and separator",
    node: { offers: { "@type": "Offer", price: "₹1,499.00", priceCurrency: "INR" } },
    expectType: "paid",
    expectNote: "₹1499",
  },
  {
    name: "USD maps to $",
    node: { offers: { "@type": "Offer", price: "20", priceCurrency: "USD" } },
    expectType: "paid",
    expectNote: "$20",
  },
  {
    name: "unknown currency falls back to the code",
    node: { offers: { "@type": "Offer", price: "50", priceCurrency: "AUD" } },
    expectType: "paid",
    expectNote: "AUD 50",
  },
  {
    name: "no currency at all",
    node: { offers: { "@type": "Offer", price: "250" } },
    expectType: "paid",
    expectNote: "250",
  },
  {
    name: "AggregateOffer uses lowPrice",
    node: { offers: { "@type": "AggregateOffer", lowPrice: "300", highPrice: "900", priceCurrency: "INR" } },
    expectType: "paid",
    expectNote: "₹300",
  },
  {
    name: "offer array picks the cheapest tier",
    node: {
      offers: [
        { "@type": "Offer", price: "1500", priceCurrency: "INR" },
        { "@type": "Offer", price: "750", priceCurrency: "INR" },
      ],
    },
    expectType: "paid",
    expectNote: "₹750",
  },
  {
    name: "offer array containing a free tier => free",
    node: {
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "INR" },
        { "@type": "Offer", price: "500", priceCurrency: "INR" },
      ],
    },
    expectType: "free",
    expectNote: null,
  },
  {
    name: "isAccessibleForFree outranks a paid offer",
    node: { isAccessibleForFree: true, offers: { "@type": "Offer", price: "500", priceCurrency: "INR" } },
    expectType: "free",
    expectNote: null,
  },
  {
    name: 'unparseable price ("Free" as text) is not treated as an amount',
    node: { offers: { "@type": "Offer", price: "Free" } },
    expectType: null,
    expectNote: null,
  },
  {
    name: "decimal price keeps 2dp",
    node: { offers: { "@type": "Offer", price: "12.50", priceCurrency: "USD" } },
    expectType: "paid",
    expectNote: "$12.50",
  },
  {
    name: "null offers is unknown, NOT free",
    node: { offers: null },
    expectType: null,
    expectNote: null,
  },
];

let passed = 0;
const failures: string[] = [];

for (const c of CASES) {
  const got = extractPriceInfo(c.node);
  const ok = got.priceType === c.expectType && got.priceNote === c.expectNote;
  if (ok) {
    passed++;
    console.log(`  PASS  ${c.name}  ->  ${got.priceType ?? "null"}${got.priceNote ? ` (${got.priceNote})` : ""}`);
  } else {
    failures.push(
      `  FAIL  ${c.name}\n        expected ${c.expectType}/${c.expectNote}, got ${got.priceType}/${got.priceNote}`,
    );
  }
}

console.log("");
for (const f of failures) console.log(f);
console.log(`\n${passed}/${CASES.length} price-extraction cases passed`);
process.exit(failures.length === 0 ? 0 : 1);
