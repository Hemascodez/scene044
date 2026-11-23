import { readFileSync } from "node:fs";
import { pool } from "../lib/db";

pool.query(readFileSync(new URL("../db/migrations/2026-11-23-event-ingestion.sql", import.meta.url), "utf8"))
  .then(() => console.log("Event ingestion migration applied."))
  .catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => pool.end());
