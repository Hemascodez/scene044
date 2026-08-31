import { readFileSync } from "node:fs";
import path from "node:path";
import { pool } from "../lib/db";

async function main() {
  const sql = readFileSync(
    path.join(__dirname, "..", "db", "schema.sql"),
    "utf-8",
  );
  await pool.query(sql);
  console.log("Schema applied.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
