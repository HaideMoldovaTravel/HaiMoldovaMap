import "server-only";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  assets,
  audit,
  categories,
  invitations,
  listings,
  mailOutbox,
  revisions,
  session,
  templates,
  user,
} from "./db/schema";
import { requireAdmin, canConfigure, HttpError, type Actor } from "./access";
import { dashboard } from "./catalog";
import { linkEmail, roleLabel } from "./mail";

export async function adminData(actor: Actor) {
  requireAdmin(actor);
  const [base, versions, files, people, invites, events, seen, delivery] =
    await Promise.all([
      dashboard(actor, true),
      db.select().from(templates).orderBy(desc(templates.version)),
      db.select().from(assets).orderBy(desc(assets.createdAt)),
      canConfigure(actor)
        ? db
            .select({
              id: user.id,
              name: user.name,
              email: user.email,
              emailVerified: user.emailVerified,
              role: user.role,
              createdAt: user.createdAt,
            })
            .from(user)
            .orderBy(desc(user.createdAt))
        : Promise.resolve([]),
      actor.role === "owner"
        ? db
            .select({
              id: invitations.id,
              email: invitations.email,
              role: invitations.role,
              invitedBy: invitations.invitedBy,
              createdAt: invitations.createdAt,
              expiresAt: invitations.expiresAt,
              acceptedAt: invitations.acceptedAt,
              revokedAt: invitations.revokedAt,
            })
            .from(invitations)
            .orderBy(desc(invitations.createdAt))
        : Promise.resolve([]),
      db
        .select({
          id: audit.id,
          action: audit.action,
          resourceId: audit.resourceId,
          createdAt: audit.createdAt,
          actorName: user.name,
        })
        .from(audit)
        .leftJoin(user, eq(audit.actorId, user.id))
        .orderBy(desc(audit.createdAt))
        .limit(200),
      canConfigure(actor)
        ? db
            .select({
              userId: session.userId,
              lastSeen: sql<Date>`max(${session.updatedAt})`,
            })
            .from(session)
            .groupBy(session.userId)
        : Promise.resolve([]),
      actor.role === "owner"
        ? db
            .select({
              status: mailOutbox.status,
              count: sql<number>`count(*)::int`,
            })
            .from(mailOutbox)
            .groupBy(mailOutbox.status)
        : Promise.resolve([]),
    ]);
  const media = files.map((file) => {
    const usedBy = base.items.filter((item) => {
      const schema = versions.find((t) => t.id === item.revision.templateId);
      return schema?.fields.some(
        (field) =>
          field.type === "gallery" &&
          Array.isArray(item.revision.values[field.id]) &&
          (item.revision.values[field.id] as string[]).includes(file.id),
      );
    });
    const category = base.config.find((c) => c.iconAssetId === file.id);
    const references = Array.from(
      new Map(
        usedBy.map((item) => [
          item.listing.id,
          {
            id: item.listing.id,
            name: String(item.revision.values.name ?? "Fără denumire"),
            kind: item.listing.kind,
          },
        ]),
      ).values(),
    );
    return {
      ...file,
      key: undefined,
      ownerName:
        people.find((person) => person.id === file.ownerId)?.name ??
        base.items.find((item) => item.listing.ownerId === file.ownerId)
          ?.authorName ??
        "Utilizator",
      references,
      categoryName: category?.name ?? null,
      used: !!category || references.length > 0,
    };
  });
  return {
    ...base,
    versions,
    media,
    people: people.map((person) => ({
      ...person,
      lastSeen: seen.find((s) => s.userId === person.id)?.lastSeen ?? null,
    })),
    invitations: invites,
    events,
    delivery,
    mailProvider:
      process.env.MAIL_TRANSPORT === "mailpit"
        ? "Mailpit (dezvoltare)"
        : "Resend",
  };
}
export async function editTeamMember(actor: Actor, id: string, raw: unknown) {
  if (actor.role !== "owner")
    throw new HttpError(
      403,
      "Numai administratorul principal gestionează rolurile echipei.",
    );
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      role: z.enum(["admin", "moderator", "user"]),
    })
    .strict()
    .parse(raw);
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.id, id))
      .for("update");
    if (!target) throw new HttpError(404, "Utilizator inexistent.");
    if (target.role === "owner")
      throw new HttpError(
        403,
        "Rolul administratorului principal nu poate fi modificat de aici.",
      );
    await tx
      .update(user)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(user.id, id));
    if (target.role !== input.role) {
      await tx.delete(session).where(eq(session.userId, id));
      await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(invitations.email, target.email.toLowerCase()),
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
          ),
        );
    }
    await tx
      .insert(audit)
      .values({
        id: randomUUID(),
        actorId: actor.id,
        action: "team.updated",
        resourceId: id,
      });
  });
  return { ok: true };
}
/**
 * Grants a team role to an account that already exists, without an email
 * round-trip. The account must have a confirmed email, which proves the
 * person controls the address an invitation would have gone to.
 */
export async function addTeamMember(actor: Actor, raw: unknown) {
  if (actor.role !== "owner")
    throw new HttpError(
      403,
      "Numai administratorul principal poate adăuga membri în echipă.",
    );
  const input = z
    .object({
      userId: z.string().min(1).max(64),
      role: z.enum(["admin", "moderator"]),
    })
    .strict()
    .parse(raw);
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.id, input.userId))
      .for("update");
    if (!target) throw new HttpError(404, "Utilizator inexistent.");
    if (target.role !== "user")
      throw new HttpError(
        409,
        "Acest utilizator face deja parte din echipă. Editează rolul din tabelul membrilor.",
      );
    if (!target.emailVerified)
      throw new HttpError(
        400,
        "Contul nu are emailul confirmat. Trimite-i o invitație pe email.",
      );
    await tx
      .update(user)
      .set({ role: input.role, updatedAt: new Date() })
      .where(eq(user.id, target.id));
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.email, target.email.toLowerCase()),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
        ),
      );
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "team.added",
      resourceId: target.id,
    });
  });
  return { ok: true };
}
export async function manageInvitation(
  actor: Actor,
  id: string,
  action: "resend" | "cancel",
) {
  if (actor.role !== "owner")
    throw new HttpError(403, "Nu ai dreptul să gestionezi invitațiile.");
  await db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.id, id))
      .for("update");
    if (!invite || invite.acceptedAt || invite.revokedAt)
      throw new HttpError(409, "Invitația a fost deja acceptată sau anulată.");
    if (action === "cancel")
      await tx
        .update(invitations)
        .set({ revokedAt: new Date() })
        .where(eq(invitations.id, id));
    else {
      const token = randomBytes(32).toString("hex");
      await tx
        .update(invitations)
        .set({
          tokenHash: createHash("sha256").update(token).digest("hex"),
          expiresAt: new Date(Date.now() + 48 * 3600000),
        })
        .where(eq(invitations.id, id));
      await tx
        .insert(mailOutbox)
        .values({
          id: randomUUID(),
          to: invite.email,
          subject: "Invitație în echipa Hai Moldova",
          html: linkEmail(
            `Invitația ta ca ${roleLabel(invite.role)} în echipa Hai Moldova a fost reînnoită. Linkul primit anterior nu mai este valabil, folosește-l pe acesta.`,
            `${process.env.BETTER_AUTH_URL}/invitatie/${token}`,
            "Acceptă invitația",
            {
              eyebrow: "Invitație în echipă",
              title: "Invitația ta a fost reînnoită",
              note: "Intră sau creează-ți contul cu adresa pe care ai primit acest email. Dacă nu te așteptai la invitație, ignoră mesajul.",
            },
          ),
        });
    }
    await tx
      .insert(audit)
      .values({
        id: randomUUID(),
        actorId: actor.id,
        action: `invitation.${action}`,
        resourceId: id,
      });
  });
  return { ok: true };
}
export async function changeListingState(
  actor: Actor,
  id: string,
  action: "archive" | "restore",
) {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .for("update");
    if (!listing) throw new HttpError(404, "Fișă inexistentă.");
    let status = "archived";
    if (action === "restore") {
      if (!["archived", "suspended"].includes(listing.status))
        throw new HttpError(409, "Fișa nu este retrasă sau arhivată.");
      status = listing.publishedRevisionId ? "published" : "unpublished";
      if (listing.publishedRevisionId) {
        const [approved] = await tx
          .select()
          .from(revisions)
          .where(eq(revisions.id, listing.publishedRevisionId));
        const [category] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, approved.categoryId));
        if (!category.active)
          throw new HttpError(
            409,
            "Reactivează categoria înainte de a restabili fișa.",
          );
      }
    }
    if (action === "archive")
      await tx
        .update(revisions)
        .set({
          status: "changes",
          feedback: "Fișa a fost arhivată de un administrator.",
          reviewedBy: actor.id,
          reviewedAt: new Date(),
        })
        .where(
          and(eq(revisions.listingId, id), eq(revisions.status, "pending")),
        );
    await tx
      .update(listings)
      .set({ status, updatedAt: new Date() })
      .where(eq(listings.id, id));
    await tx
      .insert(audit)
      .values({
        id: randomUUID(),
        actorId: actor.id,
        action: `listing.${action}`,
        resourceId: id,
      });
  });
  return { ok: true };
}
export async function updateMedia(actor: Actor, id: string, raw: unknown) {
  requireAdmin(actor, true);
  const input = z
    .object({
      filename: z.string().trim().min(1).max(200),
      altText: z.string().trim().max(300),
    })
    .strict()
    .parse(raw);
  const result = await db
    .update(assets)
    .set(input)
    .where(eq(assets.id, id))
    .returning({ id: assets.id });
  if (!result.length) throw new HttpError(404, "Fișier inexistent.");
  await db
    .insert(audit)
    .values({
      id: randomUUID(),
      actorId: actor.id,
      action: "media.updated",
      resourceId: id,
    });
  return { ok: true };
}
export async function archiveMedia(actor: Actor, id: string, restore = false) {
  requireAdmin(actor, true);
  await db.transaction(async (tx) => {
    // Serialize asset references with saveDraft/category edits using the same asset row lock.
    const [asset] = await tx
      .select()
      .from(assets)
      .where(eq(assets.id, id))
      .for("update");
    if (!asset) throw new HttpError(404, "Fișier inexistent.");
    if (!restore) {
      const usage = await tx.execute(
        sql`SELECT 1 FROM categories WHERE icon_asset_id=${id} UNION ALL SELECT 1 FROM listing_revisions r JOIN templates t ON t.id=r.template_id WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'type'='gallery' AND r.values->(f->>'id') @> ${JSON.stringify([id])}::jsonb) LIMIT 1`,
      );
      if (usage.rows.length)
        throw new HttpError(
          409,
          "Fișierul este folosit de o categorie sau de istoricul unei fișe. Nu poate fi arhivat.",
        );
    }
    await tx
      .update(assets)
      .set({ archivedAt: restore ? null : new Date() })
      .where(eq(assets.id, id));
    await tx
      .insert(audit)
      .values({
        id: randomUUID(),
        actorId: actor.id,
        action: restore ? "media.restored" : "media.archived",
        resourceId: id,
      });
  });
  return { ok: true };
}
export async function updateProfile(actor: Actor, raw: unknown) {
  const input = z
    .object({ name: z.string().trim().min(2).max(100) })
    .strict()
    .parse(raw);
  await db
    .update(user)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(user.id, actor.id));
  return { ok: true };
}
export async function editUser(actor: Actor, id: string, raw: unknown) {
  requireAdmin(actor, true);
  const input = z
    .object({ name: z.string().trim().min(2).max(100) })
    .strict()
    .parse(raw);
  const [target] = await db.select().from(user).where(eq(user.id, id));
  if (!target) throw new HttpError(404, "Utilizator inexistent.");
  if (target.role !== "user" && actor.id !== id && actor.role !== "owner")
    throw new HttpError(
      403,
      "Datele membrilor echipei se gestionează de administratorul principal.",
    );
  await db
    .update(user)
    .set({ name: input.name, updatedAt: new Date() })
    .where(eq(user.id, id));
  await db
    .insert(audit)
    .values({
      id: randomUUID(),
      actorId: actor.id,
      action: "user.updated",
      resourceId: id,
    });
  return { ok: true };
}
export async function inspectServices(actor: Actor) {
  requireAdmin(actor);
  const { storage, bucket } = await import("./storage");
  const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
  const [database, media] = await Promise.allSettled([
    db.execute(sql`SELECT 1`),
    storage().send(new HeadBucketCommand({ Bucket: bucket }), {
      abortSignal: AbortSignal.timeout(5000),
    }),
  ]);
  return {
    database: database.status === "fulfilled",
    storage: media.status === "fulfilled",
    emailConfigured:
      process.env.MAIL_TRANSPORT === "mailpit"
        ? process.env.APP_ENV !== "production"
        : !!process.env.RESEND_API_KEY,
    checkedAt: new Date().toISOString(),
  };
}
