import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import sharp from "sharp";
import { sql } from "drizzle-orm";
import { db } from "@/server/db";
import { assets } from "@/server/db/schema";
import {
  currentActor,
  requireActor,
  assertOrigin,
  HttpError,
  requireAdmin,
} from "@/server/access";
import {
  catalogConfig,
  dashboard,
  saveDraft,
  submitRevision,
  moderate,
  saveTemplate,
  saveCategory,
  publicCatalog,
  inviteAdmin,
  acceptInvite,
  revokeAdmin,
  suspendListing,
} from "@/server/catalog";
import {
  adminData,
  addTeamMember,
  editTeamMember,
  manageInvitation,
  changeListingState,
  updateMedia,
  archiveMedia,
  updateProfile,
  editUser,
  inspectServices,
} from "@/server/admin";
import { putImage } from "@/server/storage";
import {
  changeIntegration,
  listIntegrations,
  saveIntegration,
} from "@/server/integrations";
import {
  detectTelegramChats,
  saveTelegramSettings,
  sendTelegramTest,
  telegramOverview,
} from "@/server/telegram";
import { ContentValidationError } from "@/modules/catalog/schema";
import { TelegramError } from "@/modules/notifications/telegram";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Date invalide.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 150000) {
      await reader.cancel();
      throw new HttpError(413, "Formularul este prea mare.");
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Date invalide.");
  }
}

async function limit(id: string, scope: string, max: number) {
  const minute = Math.floor(Date.now() / 60000);
  const key = `platform:${scope}:${id}:${minute}`;
  const result = await db.execute(
    sql`INSERT INTO rate_limit(id,key,count,last_request) VALUES(${key},${key},1,${Date.now()}) ON CONFLICT(key) DO UPDATE SET count=rate_limit.count+1,last_request=EXCLUDED.last_request RETURNING count`,
  );
  if (Number(result.rows[0].count) > max)
    throw new HttpError(429, "Prea multe cereri. Încearcă peste un minut.");
}
async function handle(request: Request, context: Context) {
  try {
    const { path } = await context.params;
    const route = path.join("/");
    if (request.method === "GET") {
      if (route === "public") return json(await publicCatalog());
      if (route === "config") return json(await catalogConfig());
      if (route === "session") return json({ actor: await currentActor() });
      const actor = await requireActor();
      if (route === "admin-status") return json(await inspectServices(actor));
      if (route === "admin") return json(await adminData(actor));
      if (route === "integrations") return json(await listIntegrations(actor));
      if (route === "telegram") return json(await telegramOverview(actor));
      if (route === "dashboard")
        return json(
          await dashboard(
            actor,
            new URL(request.url).searchParams.get("scope") === "admin",
          ),
        );
    }
    if (request.method === "POST") {
      assertOrigin(request);
      const actor = await requireActor();
      await limit(actor.id, "write", 90);
      if (path[0] === "team" && path.length === 2)
        return json(await editTeamMember(actor, path[1], await body(request)));
      if (path[0] === "invitation-resend" && path.length === 2)
        return json(await manageInvitation(actor, path[1], "resend"));
      if (path[0] === "invitation-cancel" && path.length === 2)
        return json(await manageInvitation(actor, path[1], "cancel"));
      if (path[0] === "archive-listing" && path.length === 2)
        return json(await changeListingState(actor, path[1], "archive"));
      if (path[0] === "restore-listing" && path.length === 2)
        return json(await changeListingState(actor, path[1], "restore"));
      if (path[0] === "media-update" && path.length === 2)
        return json(await updateMedia(actor, path[1], await body(request)));
      if (path[0] === "media-archive" && path.length === 2)
        return json(await archiveMedia(actor, path[1]));
      if (path[0] === "media-restore" && path.length === 2)
        return json(await archiveMedia(actor, path[1], true));
      if (path[0] === "user-update" && path.length === 2)
        return json(await editUser(actor, path[1], await body(request)));
      if (route === "integrations")
        return json(
          await saveIntegration(actor, null, await body(request)),
          201,
        );
      if (path[0] === "integrations" && path.length === 2)
        return json(await saveIntegration(actor, path[1], await body(request)));
      if (path[0] === "integration-action" && path.length === 3) {
        const action = path[2];
        if (!["pause", "activate", "rotate", "delete"].includes(action))
          throw new HttpError(404, "Resursă inexistentă.");
        return json(
          await changeIntegration(
            actor,
            path[1],
            action as "pause" | "activate" | "rotate" | "delete",
          ),
        );
      }
      if (route === "telegram")
        return json(await saveTelegramSettings(actor, await body(request)));
      if (route === "telegram-detect") {
        await limit(actor.id, "telegram", 10);
        return json(await detectTelegramChats(actor));
      }
      if (route === "telegram-test") {
        await limit(actor.id, "telegram", 10);
        return json(await sendTelegramTest(actor, await body(request)));
      }
      if (route === "profile")
        return json(await updateProfile(actor, await body(request)));
      if (route === "listings") {
        await limit(actor.id, "draft", 20);
        return json(await saveDraft(actor, await body(request)), 201);
      }
      if (path[0] === "submit" && path.length === 2)
        return json(await submitRevision(actor, path[1]));
      if (path[0] === "moderate" && path.length === 2)
        return json(await moderate(actor, path[1], await body(request)));
      if (path[0] === "suspend" && path.length === 2)
        return json(await suspendListing(actor, path[1]));
      if (path[0] === "templates" && path.length === 2)
        return json(await saveTemplate(actor, path[1], await body(request)));
      if (route === "categories")
        return json(await saveCategory(actor, await body(request)));
      if (route === "invitations")
        return json(await inviteAdmin(actor, await body(request)));
      if (route === "team-members")
        return json(await addTeamMember(actor, await body(request)));
      if (path[0] === "accept-invite" && path.length === 2)
        return json(await acceptInvite(actor, path[1]));
      if (path[0] === "revoke" && path.length === 2)
        return json(await revokeAdmin(actor, path[1]));
      if (route === "upload") {
        await limit(actor.id, "upload", 20);
        const usage = await db.execute(
          sql`SELECT count(*)::int AS count,coalesce(sum(size),0)::bigint AS total FROM assets WHERE owner_id=${actor.id}`,
        );
        if (
          Number(usage.rows[0].count) >= 1000 ||
          Number(usage.rows[0].total) >= 250 * 1024 * 1024
        )
          throw new HttpError(
            429,
            "Limita de stocare a contului a fost atinsă. Contactează echipa.",
          );
        const length = Number(request.headers.get("content-length"));
        if (!length || length > 11 * 1024 * 1024)
          throw new HttpError(413, "Fotografia trebuie să aibă maximum 10 MB.");
        const purpose =
          new URL(request.url).searchParams.get("purpose") === "category-icon"
            ? "category-icon"
            : "listing";
        if (purpose === "category-icon") requireAdmin(actor, true);
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size > 10 * 1024 * 1024)
          throw new HttpError(400, "Alege o fotografie de maximum 10 MB.");
        if (purpose === "category-icon" && file.size > 2 * 1024 * 1024)
          throw new HttpError(413, "Iconița trebuie să aibă maximum 2 MB.");
        const input = Buffer.from(await file.arrayBuffer());
        let image: Buffer;
        try {
          const metadata = await sharp(input, {
            limitInputPixels: 25000000,
            animated: false,
          }).metadata();
          if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
            throw new Error("format");
          image = await sharp(input, { limitInputPixels: 25000000 })
            .rotate()
            .resize(
              purpose === "category-icon" ? 256 : 1600,
              purpose === "category-icon" ? 256 : 1600,
              { fit: "inside", withoutEnlargement: true },
            )
            .webp({ quality: 85 })
            .toBuffer();
        } catch {
          throw new HttpError(
            400,
            "Fotografie invalidă. Folosește JPEG, PNG sau WebP (maximum 25 megapixeli).",
          );
        }
        const id = randomUUID();
        const key = `images/${actor.id}/${id}.webp`;
        await putImage(key, image);
        await db.insert(assets).values({
          id,
          ownerId: actor.id,
          key,
          filename: file.name.slice(0, 200),
          purpose,
          size: image.length,
        });
        return json({ id, url: `/api/media/${id}` }, 201);
      }
      if (route === "admin-health") {
        requireAdmin(actor);
        return json({ ok: true });
      }
    }
    throw new HttpError(404, "Resursă inexistentă.");
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof ZodError)
      return json({ error: error.issues[0]?.message ?? "Date invalide." }, 400);
    if (error instanceof ContentValidationError)
      return json({ error: error.message }, 400);
    if (error instanceof TelegramError)
      return json({ error: error.message }, 502);
    console.error(
      "Platform request failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "Operația nu a putut fi finalizată. Încearcă din nou." },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
