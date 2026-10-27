import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertOrigin,
  HttpError,
  requireActor,
  requireAdmin,
} from "@/server/access";
import {
  HaideSyncBusy,
  haideSyncOverview,
  syncHaide,
} from "@/server/haide/sync";
import { pool } from "@/server/db";
import { randomUUID } from "node:crypto";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
function failure(error: unknown) {
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  if (error instanceof HaideSyncBusy)
    return json({ error: error.message }, 409);
  if (error instanceof z.ZodError)
    return json({ error: "Date invalide." }, 400);
  return json(
    {
      error:
        "Sincronizarea nu a putut fi finalizată. Verifică setările și conexiunea. Datele existente sunt păstrate.",
    },
    503,
  );
}
export async function GET() {
  try {
    requireAdmin(await requireActor(), true);
    return json(await haideSyncOverview());
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const actor = await requireActor();
    requireAdmin(actor, true);
    // Suppression is an editorial override, never another approval requirement.
    const input = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("sync") }).strict(),
        z
          .object({
            action: z.literal("visibility"),
            id: z.string().max(80),
            suppressed: z.boolean(),
          })
          .strict(),
      ])
      .parse(await request.json());
    if (input.action === "sync")
      return json(await syncHaide("manual", actor.id));
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "UPDATE haide_catalog SET suppressed=$2,updated_at=now() WHERE id=$1 RETURNING id",
        [input.id, input.suppressed],
      );
      if (!result.rowCount) throw new HttpError(404, "Fișă inexistentă.");
      await client.query(
        "INSERT INTO audit_log(id,actor_id,action,resource_id) VALUES($1,$2,$3,$4)",
        [
          randomUUID(),
          actor.id,
          input.suppressed ? "haide.hide" : "haide.restore",
          input.id,
        ],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
