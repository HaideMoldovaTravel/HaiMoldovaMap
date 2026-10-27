import "server-only";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
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
  templates,
  user,
  session,
} from "./db/schema";
import {
  HttpError,
  isAdmin,
  canConfigure,
  requireAdmin,
  type Actor,
} from "./access";
import {
  assertCompatibleFields,
  fieldsSchema,
  publicValues,
  validateValues,
} from "@/modules/catalog/schema";
import { initialFields } from "@/modules/catalog/templates";
import { linkEmail, roleLabel } from "./mail";
import { queueDecisionNotice, queueSubmissionNotice } from "./telegram";
import type { Place } from "@/features/places/types";
import { importedHaidePlaces } from "./haide/sync";

export async function catalogConfig(includeInactive = false) {
  const cats = await db.select().from(categories).orderBy(categories.order);
  const all = await db
    .select()
    .from(templates)
    .orderBy(desc(templates.version));
  return cats
    .filter((c) => includeInactive || c.active)
    .map((category) => ({
      ...category,
      template: all.find((t) => t.categoryId === category.id)!,
    }));
}
export async function dashboard(actor: Actor, administrative = false) {
  if (administrative) requireAdmin(actor);
  const items = await db
    .select({ listing: listings, revision: revisions, authorName: user.name })
    .from(listings)
    .innerJoin(revisions, eq(revisions.listingId, listings.id))
    .innerJoin(user, eq(revisions.authorId, user.id))
    .where(administrative ? undefined : eq(listings.ownerId, actor.id))
    .orderBy(desc(revisions.createdAt));
  const config = await catalogConfig(true);
  const team =
    administrative && actor.role === "owner"
      ? await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            emailVerified: user.emailVerified,
          })
          .from(user)
      : [];
  const activity = administrative
    ? await db.select().from(audit).orderBy(desc(audit.createdAt)).limit(50)
    : [];
  return { actor, config, items, team, activity };
}
const draftInput = z
  .object({
    listingId: z.string().max(100).optional(),
    baseRevisionId: z.string().optional(),
    categoryId: z.string().min(1).max(80),
    templateId: z.string().min(1),
    parentLocationId: z.string().max(100).nullable().optional(),
    values: z.unknown(),
  })
  .strict();
export async function saveDraft(actor: Actor, raw: unknown) {
  const input = draftInput.parse(raw);
  return db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(categories)
      .where(
        and(eq(categories.id, input.categoryId), eq(categories.active, true)),
      );
    const [template] = await tx
      .select()
      .from(templates)
      .where(eq(templates.categoryId, input.categoryId))
      .orderBy(desc(templates.version))
      .limit(1);
    if (!category || !template)
      throw new HttpError(400, "Categorie indisponibilă.");
    if (input.templateId !== template.id)
      throw new HttpError(
        409,
        "Formularul a fost actualizat. Reîncarcă pagina și verifică noile câmpuri.",
      );
    const existingIdentity = input.listingId
      ? (
          await tx
            .select()
            .from(listings)
            .where(eq(listings.id, input.listingId))
        )[0]
      : undefined;
    const values = validateValues(
      template.fields,
      input.values,
      false,
      existingIdentity?.demo ?? false,
    );
    if (input.parentLocationId) {
      const [parent] = await tx
        .select()
        .from(listings)
        .where(
          and(
            eq(listings.id, input.parentLocationId),
            eq(listings.kind, "location"),
            eq(listings.status, "published"),
          ),
        );
      if (!parent || category.kind !== "experience")
        throw new HttpError(
          400,
          "Locația asociată trebuie să fie publicată; numai experiențele se pot asocia.",
        );
    }
    const gallery = template.fields
      .filter((field) => field.type === "gallery")
      .flatMap((field) =>
        Array.isArray(values[field.id]) ? (values[field.id] as string[]) : [],
      );
    for (const assetId of [...new Set(gallery)].sort()) {
      if (
        existingIdentity?.demo &&
        assetId.startsWith("https://images.unsplash.com/")
      )
        continue;
      const [asset] = await tx
        .select()
        .from(assets)
        .where(eq(assets.id, assetId))
        .for("update");
      if (
        !asset ||
        asset.archivedAt ||
        asset.purpose !== "listing" ||
        (!isAdmin(actor) && asset.ownerId !== actor.id)
      )
        throw new HttpError(403, "Fotografie inaccesibilă.");
    }
    let listingId = input.listingId;
    if (listingId) {
      const [listing] = await tx
        .select()
        .from(listings)
        .where(eq(listings.id, listingId))
        .for("update");
      if (!listing || (listing.ownerId !== actor.id && !isAdmin(actor)))
        throw new HttpError(404, "Fișă inexistentă.");
      if (listing.demo && !canConfigure(actor))
        throw new HttpError(
          403,
          "Numai administratorii pot edita conținutul demonstrativ.",
        );
      if (["suspended", "archived"].includes(listing.status) && !isAdmin(actor))
        throw new HttpError(
          409,
          "Fișa este retrasă. Contactează administratorul.",
        );
      const [latest] = await tx
        .select()
        .from(revisions)
        .where(eq(revisions.listingId, listingId))
        .orderBy(desc(revisions.createdAt))
        .limit(1);
      if (latest?.id !== input.baseRevisionId)
        throw new HttpError(
          409,
          "Fișa a fost modificată între timp. Reîncarcă pagina.",
        );
      if (latest.status === "pending" && !isAdmin(actor))
        throw new HttpError(
          409,
          "Propunerea este în verificare. Așteaptă decizia moderatorului.",
        );
      if (latest.status === "pending")
        await tx
          .update(revisions)
          .set({
            status: "changes",
            feedback: "O nouă revizie a fost creată de administrator.",
            reviewedBy: actor.id,
            reviewedAt: new Date(),
          })
          .where(eq(revisions.id, latest.id));
      if (latest.status === "pending")
        await queueDecisionNotice(tx, {
          revisionId: latest.id,
          decision: "superseded",
          moderatorName: actor.name,
        });
      if (listing.kind !== category.kind)
        throw new HttpError(400, "Nu poți schimba tipul locație/experiență.");
    } else {
      listingId = randomUUID();
      await tx
        .insert(listings)
        .values({ id: listingId, ownerId: actor.id, kind: category.kind });
    }
    const revisionId = randomUUID();
    await tx.insert(revisions).values({
      id: revisionId,
      listingId,
      authorId: actor.id,
      categoryId: category.id,
      templateId: template.id,
      values,
      point:
        typeof values.latitude === "number" &&
        typeof values.longitude === "number"
          ? { x: values.longitude, y: values.latitude }
          : null,
      parentLocationId: input.parentLocationId ?? null,
    });
    await tx
      .update(listings)
      .set({ updatedAt: new Date() })
      .where(eq(listings.id, listingId));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "draft.saved",
      resourceId: revisionId,
    });
    return { listingId, revisionId };
  });
}
export async function submitRevision(actor: Actor, revisionId: string) {
  return db.transaction(async (tx) => {
    const [first] = await tx
      .select()
      .from(revisions)
      .where(eq(revisions.id, revisionId));
    if (!first) throw new HttpError(404, "Revizie inexistentă.");
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, first.listingId))
      .for("update");
    if (!listing || (listing.ownerId !== actor.id && !isAdmin(actor)))
      throw new HttpError(404, "Fișă inexistentă.");
    if (["suspended", "archived"].includes(listing.status) && !isAdmin(actor))
      throw new HttpError(409, "Fișa este retrasă.");
    const [latest] = await tx
      .select()
      .from(revisions)
      .where(eq(revisions.listingId, listing.id))
      .orderBy(desc(revisions.createdAt))
      .limit(1);
    if (latest.id !== revisionId || latest.status !== "draft")
      throw new HttpError(409, "Poate fi trimisă numai ultima ciornă.");
    const [template] = await tx
      .select()
      .from(templates)
      .where(eq(templates.id, latest.templateId));
    validateValues(template.fields, latest.values, true, listing.demo);
    const [category] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, latest.categoryId));
    if (!category?.active)
      throw new HttpError(400, "Categoria a fost arhivată.");
    await tx
      .update(revisions)
      .set({ status: "pending" })
      .where(eq(revisions.id, revisionId));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "revision.submitted",
      resourceId: revisionId,
    });
    await queueSubmissionNotice(tx, {
      revisionId,
      kind: listing.kind,
      isUpdate: !!listing.publishedRevisionId,
      name: String(latest.values.name ?? ""),
      categoryName: category.name,
      place: [latest.values.village, latest.values.region]
        .filter(Boolean)
        .join(", "),
      authorName: actor.name,
    });
    await tx.insert(mailOutbox).values({
      id: randomUUID(),
      to: actor.email,
      subject: "Propunerea ta este în verificare",
      html: linkEmail(
        `Mulțumim! Am primit propunerea ta${latest.values.name ? ` „${String(latest.values.name)}”` : ""} și echipa noastră o verifică. Îți scriem imediat ce o publicăm sau dacă e nevoie de corecturi.`,
        `${process.env.BETTER_AUTH_URL}/cont`,
        "Vezi propunerile mele",
        {
          eyebrow: "Propunere trimisă",
          title: "Propunerea ta e în verificare",
        },
      ),
    });
    return { ok: true };
  });
}
export async function moderate(actor: Actor, revisionId: string, raw: unknown) {
  requireAdmin(actor);
  const input = z
    .object({
      decision: z.enum(["approve", "changes", "reject"]),
      feedback: z.string().trim().max(3000).default(""),
    })
    .strict()
    .parse(raw);
  if (input.decision !== "approve" && !input.feedback)
    throw new HttpError(400, "Scrie motivul sau corectările necesare.");
  return db.transaction(async (tx) => {
    const [first] = await tx
      .select()
      .from(revisions)
      .where(eq(revisions.id, revisionId));
    if (!first) throw new HttpError(404, "Revizie inexistentă.");
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, first.listingId))
      .for("update");
    const [revision] = await tx
      .select()
      .from(revisions)
      .where(eq(revisions.id, revisionId));
    if (
      revision.status !== "pending" ||
      ["suspended", "archived"].includes(listing.status)
    )
      throw new HttpError(409, "Propunerea nu mai poate fi moderată.");
    const [template] = await tx
      .select()
      .from(templates)
      .where(eq(templates.id, revision.templateId));
    if (input.decision === "approve") {
      validateValues(template.fields, revision.values, true, listing.demo);
      const [category] = await tx
        .select()
        .from(categories)
        .where(eq(categories.id, revision.categoryId));
      if (!category?.active)
        throw new HttpError(400, "Categoria este arhivată.");
      if (revision.parentLocationId) {
        const [parent] = await tx
          .select()
          .from(listings)
          .where(
            and(
              eq(listings.id, revision.parentLocationId),
              eq(listings.status, "published"),
              eq(listings.kind, "location"),
            ),
          );
        if (!parent)
          throw new HttpError(400, "Locația asociată nu mai este publicată.");
      }
      await tx
        .update(listings)
        .set({
          status: "published",
          publishedRevisionId: revisionId,
          updatedAt: new Date(),
        })
        .where(eq(listings.id, listing.id));
    }
    const status = {
      approve: "approved",
      changes: "changes",
      reject: "rejected",
    }[input.decision];
    await tx
      .update(revisions)
      .set({
        status,
        feedback: input.feedback,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      })
      .where(eq(revisions.id, revisionId));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: `revision.${status}`,
      resourceId: revisionId,
    });
    await queueDecisionNotice(tx, {
      revisionId,
      decision: input.decision,
      moderatorName: actor.name,
    });
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.id, listing.ownerId));
    await tx.insert(mailOutbox).values({
      id: randomUUID(),
      to: owner.email,
      subject:
        input.decision === "approve"
          ? "Propunerea ta a fost publicată"
          : "Actualizare pentru propunerea ta",
      html: (() => {
        const name = revision.values.name
          ? ` „${String(revision.values.name)}”`
          : "";
        const account = `${process.env.BETTER_AUTH_URL}/cont`;
        if (input.decision === "approve")
          return linkEmail(
            `Vești bune! Propunerea ta${name} a fost aprobată și apare acum pe harta Hai Moldova. Mulțumim că ne ajuți să arătăm locurile frumoase ale țării.`,
            account,
            "Vezi propunerile mele",
            {
              eyebrow: "Propunere aprobată",
              title: "Propunerea ta e publicată",
            },
          );
        return linkEmail(
          `Echipa de moderare a verificat propunerea ta${name} și are un mesaj pentru tine:\n\n${input.feedback}`,
          account,
          input.decision === "changes"
            ? "Fă corecturile"
            : "Vezi propunerile mele",
          input.decision === "changes"
            ? {
                eyebrow: "Corecturi necesare",
                title: "Propunerea ta are nevoie de câteva corecturi",
                note: "După ce faci modificările, trimite propunerea din nou la verificare din contul tău.",
              }
            : {
                eyebrow: "Propunere respinsă",
                title: "Propunerea ta nu a fost aprobată",
              },
        );
      })(),
    });
    return { ok: true };
  });
}
export async function suspendListing(actor: Actor, id: string) {
  requireAdmin(actor);
  await db.transaction(async (tx) => {
    const [listing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, id))
      .for("update");
    if (!listing) throw new HttpError(404, "Fișă inexistentă.");
    await tx
      .update(listings)
      .set({ status: "suspended", updatedAt: new Date() })
      .where(eq(listings.id, id));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "listing.suspended",
      resourceId: id,
    });
  });
  return { ok: true };
}
export async function saveTemplate(
  actor: Actor,
  categoryId: string,
  raw: unknown,
) {
  requireAdmin(actor, true);
  const input = z
    .object({ baseTemplateId: z.string(), fields: fieldsSchema })
    .strict()
    .parse(raw);
  return db.transaction(async (tx) => {
    const [category] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .for("update");
    if (!category) throw new HttpError(404, "Categorie inexistentă.");
    const [latest] = await tx
      .select()
      .from(templates)
      .where(eq(templates.categoryId, categoryId))
      .orderBy(desc(templates.version))
      .limit(1);
    if (input.baseTemplateId !== latest.id)
      throw new HttpError(409, "Șablonul a fost modificat între timp.");
    const history = await tx
      .select()
      .from(templates)
      .where(eq(templates.categoryId, categoryId));
    for (const version of history)
      assertCompatibleFields(version.fields, input.fields);
    const fields = assertCompatibleFields(latest.fields, input.fields);
    const [next] = await tx
      .insert(templates)
      .values({
        id: randomUUID(),
        categoryId,
        version: latest.version + 1,
        fields,
      })
      .returning();
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "template.published",
      resourceId: next.id,
    });
    return next;
  });
}
const categoryInput = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    name: z.string().trim().min(1).max(80),
    nameEn: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    kind: z.enum(["location", "experience"]),
    active: z.boolean(),
    order: z.number().int().min(0).max(1000),
    description: z.string().trim().max(1000).optional(),
    iconAssetId: z.uuid().nullable().optional(),
    create: z.boolean().optional(),
    sourceCategoryId: z.string().max(64).optional(),
  })
  .strict();
export async function saveCategory(actor: Actor, raw: unknown) {
  requireAdmin(actor, true);
  const input = categoryInput.parse(raw);
  return db.transaction(async (tx) => {
    const [old] = await tx
      .select()
      .from(categories)
      .where(eq(categories.id, input.id))
      .for("update");
    if (old && input.create)
      throw new HttpError(
        409,
        "Există deja o categorie cu acest identificator. Alege altă denumire.",
      );
    const { create: _create, sourceCategoryId, ...categoryValues } = input;
    void _create;
    if (input.iconAssetId) {
      const [icon] = await tx
        .select()
        .from(assets)
        .where(eq(assets.id, input.iconAssetId))
        .for("update");
      if (!icon || icon.archivedAt || icon.purpose !== "category-icon")
        throw new HttpError(400, "Încarcă o iconiță validă pentru categorie.");
    }
    if (old && old.kind !== input.kind)
      throw new HttpError(
        400,
        "Tipul categoriei existente nu poate fi schimbat.",
      );
    if (old)
      await tx
        .update(categories)
        .set(categoryValues)
        .where(eq(categories.id, input.id));
    else {
      await tx.insert(categories).values(categoryValues);
      let sourceFields = initialFields(
        input.kind === "experience" ? "experience" : "culture",
      );
      if (sourceCategoryId) {
        const [source] = await tx
          .select()
          .from(categories)
          .where(eq(categories.id, sourceCategoryId));
        if (!source)
          throw new HttpError(400, "Formularul ales nu mai este disponibil.");
        const [sourceTemplate] = await tx
          .select()
          .from(templates)
          .where(eq(templates.categoryId, sourceCategoryId))
          .orderBy(desc(templates.version))
          .limit(1);
        if (!sourceTemplate)
          throw new HttpError(400, "Formularul ales nu mai este disponibil.");
        sourceFields = sourceTemplate.fields;
      }
      await tx.insert(templates).values({
        id: randomUUID(),
        categoryId: input.id,
        version: 1,
        fields: sourceFields,
      });
    }
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "category.saved",
      resourceId: input.id,
    });
    return { ok: true };
  });
}
export async function inviteAdmin(actor: Actor, raw: unknown) {
  if (actor.role !== "owner")
    throw new HttpError(
      403,
      "Numai administratorul principal poate invita echipa.",
    );
  const input = z
    .object({ email: z.email().max(254), role: z.enum(["admin", "moderator"]) })
    .strict()
    .parse(raw);
  const token = randomBytes(32).toString("hex");
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.email, input.email.toLowerCase()));
    if (target && target.role !== "user")
      throw new HttpError(
        409,
        "Acest utilizator face deja parte din echipă. Editează rolul din tabelul membrilor.",
      );
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.email, input.email.toLowerCase()),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      );
    await tx.insert(invitations).values({
      id: randomUUID(),
      email: input.email.toLowerCase(),
      role: input.role,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      invitedBy: actor.id,
      expiresAt: new Date(Date.now() + 48 * 3600000),
    });
    await tx.insert(mailOutbox).values({
      id: randomUUID(),
      to: input.email,
      subject: "Invitație în echipa Hai Moldova",
      html: linkEmail(
        `Ai fost invitat să te alături echipei Hai Moldova ca ${roleLabel(input.role)}. Acceptă invitația ca să ajuți la verificarea locurilor și experiențelor de pe hartă.`,
        `${process.env.BETTER_AUTH_URL}/invitatie/${token}`,
        "Acceptă invitația",
        {
          eyebrow: "Invitație în echipă",
          title: "Ești invitat în echipa Hai Moldova",
          note: "Intră sau creează-ți contul cu adresa pe care ai primit acest email. Dacă nu te așteptai la invitație, ignoră mesajul.",
        },
      ),
    });
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "team.invited",
      resourceId: input.email.toLowerCase(),
    });
  });
  return { ok: true };
}
export async function acceptInvite(actor: Actor, token: string) {
  const hash = createHash("sha256").update(token).digest("hex");
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, hash))
      .for("update");
    if (
      !invite ||
      invite.acceptedAt ||
      invite.revokedAt ||
      invite.expiresAt < new Date() ||
      invite.email !== actor.email.toLowerCase()
    )
      throw new HttpError(
        400,
        "Invitație invalidă, expirată sau destinată altui email.",
      );
    // Never demote a principal through an older invitation.
    if (actor.role !== "owner")
      await tx
        .update(user)
        .set({ role: invite.role, updatedAt: new Date() })
        .where(eq(user.id, actor.id));
    await tx
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invite.id));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "team.accepted",
      resourceId: invite.id,
    });
    return { ok: true };
  });
}
export async function revokeAdmin(actor: Actor, id: string) {
  if (actor.role !== "owner" || actor.id === id)
    throw new HttpError(403, "Nu poți efectua această operație.");
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select()
      .from(user)
      .where(eq(user.id, id))
      .for("update");
    if (!target || target.role === "owner")
      throw new HttpError(
        403,
        "Accesul administratorilor principali se gestionează separat.",
      );
    await tx
      .update(user)
      .set({ role: "user", updatedAt: new Date() })
      .where(eq(user.id, id));
    await tx.delete(session).where(eq(session.userId, id));
    await tx
      .update(invitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(invitations.email, target.email.toLowerCase()),
          sql`${invitations.acceptedAt} IS NULL`,
          sql`${invitations.revokedAt} IS NULL`,
        ),
      );
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: "team.revoked",
      resourceId: id,
    });
  });
  return { ok: true };
}
export async function publicCatalog(): Promise<Place[]> {
  const imported = await importedHaidePlaces();
  const rows = await db
    .select({
      listing: listings,
      revision: revisions,
      template: templates,
      category: categories,
    })
    .from(listings)
    .innerJoin(
      revisions,
      and(
        eq(revisions.id, listings.publishedRevisionId),
        eq(revisions.listingId, listings.id),
      ),
    )
    .innerJoin(templates, eq(templates.id, revisions.templateId))
    .innerJoin(categories, eq(categories.id, revisions.categoryId))
    .where(and(eq(listings.status, "published"), eq(categories.active, true)))
    .orderBy(desc(listings.updatedAt));
  const latestTemplates = await db
    .select()
    .from(templates)
    .orderBy(desc(templates.version));
  const assetNames = await db
    .select({ id: assets.id, altText: assets.altText })
    .from(assets);
  const altById = new Map(assetNames.map((asset) => [asset.id, asset.altText]));
  const local: Place[] = rows.map(
    ({ listing, revision, template, category }) => {
      const hidden = new Set(
        latestTemplates
          .filter(
            (t) =>
              t.categoryId === category.id && t.version >= template.version,
          )
          .flatMap((t) => t.fields.filter((f) => !f.public).map((f) => f.id)),
      );
      const visibleFields = template.fields.filter((f) => !hidden.has(f.id));
      const v = publicValues(visibleFields, revision.values);
      const gallery = Array.isArray(v.gallery)
        ? v.gallery.map((id) =>
            listing.demo && id.startsWith("https://images.unsplash.com/")
              ? id
              : `/api/media/${id}`,
          )
        : [];
      const contacts = Object.fromEntries(
        visibleFields
          .filter((f) => f.group === "contacts" && f.public && v[f.id])
          .map((f) => [f.id, String(v[f.id])]),
      );
      return {
        id: listing.id,
        name: String(v.name ?? ""),
        category: category.id,
        kind: listing.kind === "experience" ? "experience" : "location",
        categoryLabel: category.name,
        categoryLabelEn: category.nameEn,
        categoryColor: category.color,
        categoryIcon: category.iconAssetId
          ? `/api/media/${category.iconAssetId}`
          : undefined,
        region: String(v.region ?? ""),
        village: String(v.village ?? ""),
        coordinates: [Number(v.latitude), Number(v.longitude)],
        rating: listing.demo ? Number(revision.values.demo_rating ?? 0) : 0,
        reviews: listing.demo ? Number(revision.values.demo_reviews ?? 0) : 0,
        image: gallery[0] ?? "/placeholder.svg",
        imageAlts: Array.isArray(v.gallery)
          ? v.gallery.map((id) => altById.get(id) || String(v.name ?? ""))
          : [],
        images: gallery.length ? gallery : ["/placeholder.svg"],
        description: String(v.description ?? ""),
        tags: Array.isArray(v.tags) ? v.tags : [],
        price: Number(v.price ?? 0),
        priceLabel: String(v.price_unit ?? ""),
        priceMode: String(v.price_mode ?? "La cerere"),
        currency: String(v.currency ?? "MDL"),
        hours: String(v.hours ?? ""),
        featured: listing.demo && !!revision.values.demo_featured,
        demo: listing.demo,
        contacts,
        contactFields: visibleFields
          .filter((f) => f.group === "contacts" && f.public && v[f.id])
          .map((f) => ({
            id: f.id,
            label: f.label,
            labelEn: f.labelEn,
            type: f.type,
            value: String(v[f.id]),
          })),
        translatedName: String(v.name_en ?? ""),
        translatedDescription: String(v.description_en ?? ""),
        details: visibleFields
          .filter(
            (f) =>
              f.public &&
              f.group !== "contacts" &&
              ![
                "name",
                "name_en",
                "description",
                "description_en",
                "latitude",
                "longitude",
                "village",
                "region",
                "gallery",
                "hours",
                "price",
                "currency",
                "price_mode",
                "price_unit",
                "tags",
                "internal_notes",
              ].includes(f.id) &&
              v[f.id] !== undefined,
          )
          .map((f) => ({
            id: f.id,
            label: f.label,
            labelEn: f.labelEn,
            type: f.type,
            value:
              f.type === "gallery" && Array.isArray(v[f.id])
                ? (v[f.id] as string[]).map((id) => `/api/media/${id}`)
                : v[f.id],
          })),
      };
    },
  );
  return [...local, ...imported];
}
export async function assetAllowed(id: string, actor: Actor | null) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset || asset.archivedAt) return null;
  const [iconCategory] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.iconAssetId, id), eq(categories.active, true)))
    .limit(1);
  if (iconCategory) return { asset, public: true };
  if (actor && (actor.id === asset.ownerId || isAdmin(actor)))
    return { asset, public: false };
  const result = await db.execute(
    sql`SELECT 1 FROM listings l JOIN listing_revisions r ON r.id=l.published_revision_id AND r.listing_id=l.id JOIN templates t ON t.id=r.template_id JOIN categories c ON c.id=r.category_id WHERE l.status='published' AND c.active=true AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'type'='gallery' AND (f->>'public')::boolean=true AND r.values->(f->>'id') @> ${JSON.stringify([id])}::jsonb AND NOT EXISTS (SELECT 1 FROM templates overrides, jsonb_array_elements(overrides.fields) latest_field WHERE overrides.category_id=r.category_id AND overrides.version>=t.version AND latest_field->>'id'=f->>'id' AND (latest_field->>'public')::boolean=false)) LIMIT 1`,
  );
  return result.rows.length ? { asset, public: true } : null;
}
