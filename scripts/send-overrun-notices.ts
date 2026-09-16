import { pool } from "../lib/db";
import { runOverrunSweep } from "../lib/venueOverrun";

async function main() {
  const result = await runOverrunSweep();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("send-overrun-notices failed", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
