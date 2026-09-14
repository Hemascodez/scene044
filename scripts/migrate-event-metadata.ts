import { pool } from "../lib/db";

async function main() {
  await pool.query(`
    ALTER TABLE events ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
    ALTER TABLE events ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN NOT NULL DEFAULT false;
  `);
  console.log("Event tags and promotion columns are ready.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
