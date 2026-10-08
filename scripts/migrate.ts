import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../lib/db";

async function main() {
  const sql = readFileSync(
    path.join(__dirname, "..", "db", "schema.sql"),
    "utf-8",
  );
  await pool.query(sql);
  await pool.query(readFileSync(path.join(__dirname, '..', 'db', 'migrations', '2026-10-08-multi-venue-host-access.sql'), 'utf8'));
  // New transactional triggers are kept in one migration source, not duplicated
  // in schema.sql. Re-applying is safe and never backfills historical messages.
  await pool.query(readFileSync(path.join(__dirname, '..', 'db', 'migrations', '2026-10-08-venue-notifications.sql'), 'utf8'));
  await pool.query(readFileSync(path.join(__dirname, '..', 'db', 'migrations', '2026-10-08-host-venue-changes.sql'), 'utf8'));
  console.log("Schema applied.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
