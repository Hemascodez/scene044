/** Synthetic menu only; no customer photo or saved production menu is used. */
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { extractVenueMenu } from '../lib/venueMenuExtract';
async function main() {
  const image = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="900" height="400"><rect width="900" height="400" fill="white"/><g font-family="sans-serif" font-size="45" fill="black"><text x="40" y="80">TEST MENU - INR</text><text x="40" y="160">Filter Coffee     Rs 120.50</text><text x="40" y="240">Lemon Tea         Rs 80</text><text x="40" y="320">Daily Special     Ask staff</text></g></svg>')).png().toBuffer();
  const result = await extractVenueMenu(image, 'image/png');
  assert.ok(result.items.some(i => /filter coffee/i.test(i.name) && i.priceRupees === 120.5));
  assert.ok(result.items.some(i => /lemon tea/i.test(i.name) && i.priceRupees === 80));
  assert.ok(result.items.some(i => /daily special/i.test(i.name) && i.priceRupees === null));
  console.log('PASS: photo extraction preserved two INR prices and left the unknown price blank. No menu was saved.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Menu extraction failed'); process.exitCode = 1; });
