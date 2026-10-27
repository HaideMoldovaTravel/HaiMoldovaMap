import { pool } from "../src/server/db";
import {
  haideConfig,
  HaideSyncBusy,
  syncHaide,
} from "../src/server/haide/sync";
import { setTimeout as delay } from "node:timers/promises";
const watch = process.argv.includes("--watch");
let stopped = false;
const controller = new AbortController();
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    stopped = true;
    controller.abort();
  });
try {
  do {
    const config = haideConfig();
    if (!config.enabled) {
      if (!watch) throw new Error("Haide synchronization is not configured");
    } else {
      try {
        const result = await syncHaide("scheduled");
        console.log(
          `Haide sync completed: ${result.imported} received; ${result.hidden} withdrawn; ${result.issues} incomplete.`,
        );
      } catch (error) {
        if (!(error instanceof HaideSyncBusy)) {
          console.error(
            "Haide sync failed. Existing catalog preserved; check integration configuration and API connectivity.",
          );
          if (!watch) process.exitCode = 1;
        }
      }
    }
    if (!watch || stopped) break;
    await delay(config.intervalSeconds * 1000, undefined, {
      signal: controller.signal,
    }).catch(() => {});
  } while (!stopped);
} finally {
  await pool.end();
}
