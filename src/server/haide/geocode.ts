import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { pool } from "../db";
import type { HaideItem } from "../../modules/haide/catalog";
import {
  chooseGeocode,
  locationKey,
  normalizeLocation,
} from "../../modules/haide/location";

/** Persistent cache and a database lock serialize provider requests across workers. */
export async function resolveHaideLocations(limit = 30) {
  const client = await pool.connect();
  let locked = false,
    resolved = 0;
  try {
    locked = (
      await client.query("SELECT pg_try_advisory_lock(74119,2) AS locked")
    ).rows[0].locked;
    if (!locked) return { resolved: 0 };
    const { rows } = await client.query(
      `SELECT h.id,h.payload,h.content_hash FROM haide_catalog h
      WHERE h.issue='Lipsesc coordonatele' AND h.suppressed=false ORDER BY h.location_checked_at NULLS FIRST,h.id LIMIT $1`,
      [limit],
    );
    let lastRequest = 0;
    for (const row of rows) {
      await client.query(
        "UPDATE haide_catalog SET location_checked_at=now() WHERE id=$1",
        [row.id],
      );
      const item = row.payload as HaideItem;
      if (!item.city.trim()) continue;
      let found: {
        coordinates: [number, number];
        precision: "city" | "address";
      } | null = null;
      for (const precision of (item.address?.trim()
        ? ["address", "city"]
        : ["city"]) as ("address" | "city")[]) {
        const query =
          precision === "address"
            ? `${item.address}, ${item.city}, Moldova`
            : `${item.city}, Moldova`;
        const key = createHash("sha256")
          .update(`v3:${precision}:${normalizeLocation(query)}`)
          .digest("hex");
        const cached = (
          await client.query(
            "SELECT * FROM haide_geocode_cache WHERE key=$1 AND retry_at>now()",
            [key],
          )
        ).rows[0];
        let coordinates: [number, number] | null;
        if (cached)
          coordinates =
            cached.latitude === null
              ? null
              : [cached.latitude, cached.longitude];
        else {
          await delay(Math.max(0, 1200 - (Date.now() - lastRequest)));
          lastRequest = Date.now();
          const endpoint = new URL(
            "api/",
            (process.env.PHOTON_URL ?? "https://photon.komoot.io").replace(
              /\/?$/,
              "/",
            ),
          );
          endpoint.search = new URLSearchParams({
            q: query,
            countrycode: "MD",
            limit: "10",
          }).toString();
          // Only public listing addresses go to the provider. No account details or integration key.
          const response = await fetch(endpoint, {
            headers: {
              Accept: "application/json",
              "User-Agent": "HaideMap/1.0 (map.haide.md)",
            },
            signal: AbortSignal.timeout(10000),
            redirect: "error",
          });
          if (!response.ok) throw new Error("Geocoding provider unavailable");
          coordinates = chooseGeocode(
            await response.json(),
            item.city,
            item.address ?? "",
            precision,
          );
          await client.query(
            `INSERT INTO haide_geocode_cache(key,latitude,longitude,precision,retry_at)
            VALUES($1,$2,$3,$4,now()+$5::interval) ON CONFLICT(key) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,retry_at=excluded.retry_at`,
            [
              key,
              coordinates?.[0] ?? null,
              coordinates?.[1] ?? null,
              precision,
              coordinates ? "365 days" : "1 day",
            ],
          );
        }
        if (coordinates) {
          found = { coordinates, precision };
          break;
        }
      }
      if (!found) continue;
      await client.query("BEGIN");
      try {
        // Never revive withdrawn data or publish a stale location after a concurrent sync.
        const current = (
          await client.query(
            "SELECT id FROM haide_catalog WHERE id=$1 AND content_hash=$2 AND issue='Lipsesc coordonatele' FOR UPDATE",
            [row.id, row.content_hash],
          )
        ).rows[0];
        if (current) {
          await client.query(
            `INSERT INTO haide_locations(id,query_key,latitude,longitude,precision) VALUES($1,$2,$3,$4,$5)
            ON CONFLICT(id) DO UPDATE SET query_key=excluded.query_key,latitude=excluded.latitude,longitude=excluded.longitude,precision=excluded.precision,updated_at=now() WHERE haide_locations.precision<>'manual'`,
            [row.id, locationKey(item), ...found.coordinates, found.precision],
          );
          await client.query(
            "UPDATE haide_catalog SET visible=true,issue=NULL,updated_at=now() WHERE id=$1",
            [row.id],
          );
          resolved++;
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
    return { resolved };
  } finally {
    if (locked)
      await client.query("SELECT pg_advisory_unlock(74119,2)").catch(() => {});
    client.release();
  }
}
