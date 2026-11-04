import { pool } from "../src/server/db";
import { resolveHaideLocations } from "../src/server/haide/geocode";
import { setTimeout as delay } from "node:timers/promises";
const watch = process.argv.includes("--watch");
const stop = new AbortController();
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => stop.abort());
try {
  do {
    try {
      console.log("Haide locations:", await resolveHaideLocations());
    } catch {
      console.error(
        "Location lookup unavailable; existing positions preserved.",
      );
      if (!watch) process.exitCode = 1;
    }
    if (!watch) break;
    await delay(60000, undefined, { signal: stop.signal }).catch(() => {});
  } while (!stop.signal.aborted);
} finally {
  await pool.end();
}
