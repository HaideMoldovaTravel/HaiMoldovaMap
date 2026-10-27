import { createHash, randomUUID } from "node:crypto";
import { pool } from "../db";
import {
  defaultCategories,
  fetchHaideSnapshot,
  haidePlace,
  importIssue,
  sourceKey,
  type HaideItem,
} from "../../modules/haide/catalog";
import type { Place } from "../../features/places/types";

export class HaideSyncBusy extends Error {}
export function haideConfig() {
  const apiUrl = process.env.HAIDE_API_URL ?? "";
  const siteUrl = process.env.HAIDE_SITE_URL ?? "https://haide.md";
  const token = process.env.HAIDE_SYNC_TOKEN ?? "";
  const intervalSeconds = Number(
    process.env.HAIDE_SYNC_INTERVAL_SECONDS ?? 1800,
  );
  if (!Number.isInteger(intervalSeconds) || intervalSeconds < 60)
    throw new Error("Invalid Haide sync interval");
  const mapping = JSON.parse(process.env.HAIDE_CATEGORY_MAP ?? "{}") as Record<
    string,
    string
  >;
  if (
    !mapping ||
    typeof mapping !== "object" ||
    Array.isArray(mapping) ||
    Object.values(mapping).some((v) => typeof v !== "string")
  )
    throw new Error("Invalid Haide category mapping");
  return {
    apiUrl,
    siteUrl,
    token,
    intervalSeconds,
    mapping: { ...defaultCategories, ...mapping },
    enabled: !!apiUrl && token.length >= 32,
  };
}

async function getPage(url: URL, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(30000),
    redirect: "error",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Haide API HTTP ${response.status}`);
  // Bound response size before JSON parsing. Never log source payloads or secrets.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing Haide response");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 12000000) {
      await reader.cancel();
      throw new Error("Haide page too large");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function syncHaide(
  trigger: "manual" | "scheduled" = "manual",
  actorId: string | null = null,
) {
  const config = haideConfig();
  if (!config.enabled) throw new Error("Integrarea Haide nu este configurată.");
  const client = await pool.connect();
  let locked = false,
    runId: string | null = null;
  try {
    const lock = await client.query(
      "SELECT pg_try_advisory_lock(74119, 1) AS locked",
    );
    locked = lock.rows[0].locked;
    if (!locked) throw new HaideSyncBusy("O sincronizare este deja în curs.");
    const source = `${new URL(config.apiUrl).origin}|${new URL(config.siteUrl).origin}`;
    const previous = await client.query(
      "SELECT source FROM haide_sync_runs WHERE status='success' ORDER BY started_at DESC LIMIT 1",
    );
    if (previous.rows[0] && previous.rows[0].source !== source)
      throw new Error(
        "Sursa Haide diferă de importul existent. Schimbarea trebuie verificată înainte de sincronizare.",
      );
    // An interrupted process cannot keep the advisory lock. Preserve its audit trail.
    await client.query(
      "UPDATE haide_sync_runs SET status='failed',error='Proces întrerupt; reluare sigură la următoarea rulare.',finished_at=now() WHERE status='running'",
    );
    runId = randomUUID();
    await client.query(
      "INSERT INTO haide_sync_runs(id,source,status,trigger,actor_id) VALUES($1,$2,'running',$3,$4)",
      [runId, source, trigger, actorId],
    );
    const items = await fetchHaideSnapshot(
      config.apiUrl,
      config.token,
      config.siteUrl,
      getPage,
    );
    await client.query("BEGIN");
    const { rows: categories } = await client.query(
      "SELECT id,active FROM categories",
    );
    const existing = new Map<string, boolean>(
      categories.map((c) => [c.id, c.active]),
    );
    let issues = 0;
    for (const item of items) {
      const category = config.mapping[item.type];
      if (!existing.has(category))
        throw new Error(
          `Configurează categoria locală pentru ${item.type}: ${category}`,
        );
      const issue = importIssue(item);
      if (issue) issues++;
      const payload = JSON.stringify(item);
      const hash = createHash("sha256").update(payload).digest("hex");
      await client.query(
        `INSERT INTO haide_catalog(id,payload,content_hash,category_id,visible,issue,last_seen_run_id)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET
        payload=excluded.payload,content_hash=excluded.content_hash,category_id=excluded.category_id,
        visible=excluded.visible,issue=excluded.issue,last_seen_run_id=excluded.last_seen_run_id,
        updated_at=CASE WHEN haide_catalog.content_hash<>excluded.content_hash OR haide_catalog.visible<>excluded.visible OR haide_catalog.category_id<>excluded.category_id THEN now() ELSE haide_catalog.updated_at END`,
        [sourceKey(item), payload, hash, category, !issue, issue, runId],
      );
    }
    // Only a complete, validated snapshot is allowed to withdraw disappeared rows.
    const hidden = await client.query(
      "UPDATE haide_catalog SET visible=false,issue='Nu mai este public pe Haide',updated_at=now() WHERE last_seen_run_id<>$1 AND visible=true RETURNING id",
      [runId],
    );
    await client.query(
      "UPDATE haide_sync_runs SET status='success',imported=$2,hidden=$3,issues=$4,finished_at=now() WHERE id=$1",
      [runId, items.length, hidden.rowCount, issues],
    );
    if (actorId)
      await client.query(
        "INSERT INTO audit_log(id,actor_id,action,resource_id) VALUES($1,$2,'haide.sync',$3)",
        [randomUUID(), actorId, runId],
      );
    await client.query("COMMIT");
    return {
      id: runId,
      imported: items.length,
      hidden: hidden.rowCount,
      issues,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (runId)
      await client
        .query(
          "UPDATE haide_sync_runs SET status='failed',error='Sincronizare eșuată. Datele publicate au fost păstrate; verifică setările și conexiunea Haide.',finished_at=now() WHERE id=$1",
          [runId],
        )
        .catch(() => {});
    throw error;
  } finally {
    if (locked)
      await client.query("SELECT pg_advisory_unlock(74119, 1)").catch(() => {});
    client.release();
  }
}

export async function importedHaidePlaces(): Promise<Place[]> {
  const { rows } =
    await pool.query(`SELECT h.payload,h.category_id,c.name,c.name_en,c.color FROM haide_catalog h
    JOIN categories c ON c.id=h.category_id WHERE h.visible=true AND h.suppressed=false AND c.active=true ORDER BY h.id`);
  return rows.flatMap((row) => {
    const place = haidePlace(row.payload as HaideItem, row.category_id);
    return place
      ? [
          {
            ...place,
            categoryLabel: row.name,
            categoryLabelEn: row.name_en,
            categoryColor: row.color,
          },
        ]
      : [];
  });
}

export async function haideSyncOverview() {
  const config = haideConfig();
  const [runs, items] = await Promise.all([
    pool.query(
      "SELECT id,status,trigger,imported,hidden,issues,error,started_at,finished_at FROM haide_sync_runs ORDER BY started_at DESC LIMIT 20",
    ),
    pool.query(
      `SELECT h.id,h.payload->>'name' AS name,h.payload->>'url' AS url,
        (h.visible AND c.active) AS visible,h.suppressed,
        CASE WHEN NOT c.active THEN 'Categoria locală este arhivată' ELSE h.issue END AS issue,h.updated_at
        FROM haide_catalog h JOIN categories c ON c.id=h.category_id ORDER BY h.issue NULLS LAST,h.id LIMIT 500`,
    ),
  ]);
  return {
    enabled: config.enabled,
    apiUrl: config.apiUrl,
    intervalSeconds: config.intervalSeconds,
    runs: runs.rows,
    items: items.rows,
  };
}
