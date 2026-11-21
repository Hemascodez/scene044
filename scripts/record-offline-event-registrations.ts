import { readFileSync } from 'node:fs';
import { pool } from '../lib/db';
import { recordOfflineEventRegistrations, type OfflineBatch } from '../lib/offlineEventRegistrations';

// Supply a private JSON batch on stdin. Dry-run unless --apply is explicit.
async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('Usage: node --import tsx scripts/record-offline-event-registrations.ts [--apply] < private-batch.json');
  const input = JSON.parse(readFileSync(0, 'utf8')) as OfflineBatch;
  console.log(JSON.stringify(await recordOfflineEventRegistrations(input, args.includes('--apply'))));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Offline registration failed.'); process.exitCode = 1; }).finally(() => pool.end());
