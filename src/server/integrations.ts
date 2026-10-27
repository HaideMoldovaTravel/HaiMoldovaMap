import "server-only";
import { randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "./db";
import {
  audit,
  integrationStats,
  listings,
  partnerIntegrations,
} from "./db/schema";
import { HttpError, requireAdmin, type Actor } from "./access";
import { catalogConfig, publicCatalog } from "./catalog";
import {
  domainsSchema,
  integrationSettingsSchema,
  type IntegrationSettings,
} from "@/modules/integrations/settings";
import type { Place } from "@/features/places/types";

export type Integration = typeof partnerIntegrations.$inferSelect;

const newKey = () => randomBytes(12).toString("base64url");
export const validKey = (key: string) => /^[A-Za-z0-9_-]{16,64}$/.test(key);
const since = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

export async function listIntegrations(actor: Actor) {
  requireAdmin(actor, true);
  const [rows, stats] = await Promise.all([
    db
      .select()
      .from(partnerIntegrations)
      .orderBy(desc(partnerIntegrations.updatedAt)),
    db
      .select({
        integrationId: integrationStats.integrationId,
        allowed: integrationStats.allowed,
        count: sql<number>`sum(${integrationStats.count})::int`,
      })
      .from(integrationStats)
      .where(gte(integrationStats.day, since(30)))
      .groupBy(integrationStats.integrationId, integrationStats.allowed),
  ]);
  return rows.map((row) => ({
    ...row,
    views:
      stats.find((s) => s.integrationId === row.id && s.allowed)?.count ?? 0,
    blocked:
      stats.find((s) => s.integrationId === row.id && !s.allowed)?.count ?? 0,
  }));
}

export async function integrationDetail(actor: Actor, id: string) {
  requireAdmin(actor, true);
  const [row] = await db
    .select()
    .from(partnerIntegrations)
    .where(eq(partnerIntegrations.id, id));
  if (!row) return null;
  const stats = await db
    .select()
    .from(integrationStats)
    .where(
      and(
        eq(integrationStats.integrationId, id),
        gte(integrationStats.day, since(30)),
      ),
    )
    .orderBy(desc(integrationStats.day));
  return { integration: row, stats };
}

const integrationInput = z
  .object({
    title: z.string().trim().min(2, "Scrie un titlu intern.").max(120),
    partnerName: z.string().trim().max(160).default(""),
    contactEmail: z.union([z.literal(""), z.email().max(254)]).default(""),
    notes: z.string().trim().max(3000).default(""),
    domains: domainsSchema,
    allowSubdomains: z.boolean(),
    status: z.enum(["active", "paused"]),
    settings: integrationSettingsSchema,
    baseVersion: z.number().int().optional(),
  })
  .strict();

export async function saveIntegration(
  actor: Actor,
  id: string | null,
  raw: unknown,
) {
  requireAdmin(actor, true);
  const input = integrationInput.parse(raw);
  const config = await catalogConfig(true);
  const known = new Set(config.map((c) => c.id));
  const settings: IntegrationSettings = {
    ...input.settings,
    content: {
      ...input.settings.content,
      categoryIds: input.settings.content.categoryIds.filter((c) =>
        known.has(c),
      ),
    },
  };
  if (
    settings.content.categoryMode === "selected" &&
    !settings.content.categoryIds.length
  )
    throw new HttpError(400, "Categoriile selectate nu mai există.");
  const values = {
    title: input.title,
    partnerName: input.partnerName,
    contactEmail: input.contactEmail.toLowerCase(),
    notes: input.notes,
    domains: input.domains,
    allowSubdomains: input.allowSubdomains,
    status: input.status,
    settings,
  };
  return db.transaction(async (tx) => {
    let integrationId = id;
    if (id) {
      const [current] = await tx
        .select()
        .from(partnerIntegrations)
        .where(eq(partnerIntegrations.id, id))
        .for("update");
      if (!current) throw new HttpError(404, "Integrare inexistentă.");
      if (
        input.baseVersion !== undefined &&
        input.baseVersion !== current.version
      )
        throw new HttpError(
          409,
          "Integrarea a fost modificată de altcineva între timp. Reîncarcă pagina.",
        );
      await tx
        .update(partnerIntegrations)
        .set({ ...values, version: current.version + 1, updatedAt: new Date() })
        .where(eq(partnerIntegrations.id, id));
    } else {
      integrationId = randomUUID();
      await tx.insert(partnerIntegrations).values({
        ...values,
        id: integrationId,
        publicKey: newKey(),
        createdBy: actor.id,
      });
    }
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: id ? "integration.updated" : "integration.created",
      resourceId: integrationId!,
    });
    return { id: integrationId! };
  });
}

export async function changeIntegration(
  actor: Actor,
  id: string,
  action: "pause" | "activate" | "rotate" | "delete",
) {
  requireAdmin(actor, true);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(partnerIntegrations)
      .where(eq(partnerIntegrations.id, id))
      .for("update");
    if (!current) throw new HttpError(404, "Integrare inexistentă.");
    if (action === "delete")
      await tx
        .delete(partnerIntegrations)
        .where(eq(partnerIntegrations.id, id));
    else
      await tx
        .update(partnerIntegrations)
        .set({
          ...(action === "rotate"
            ? { publicKey: newKey() }
            : { status: action === "pause" ? "paused" : "active" }),
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(partnerIntegrations.id, id));
    await tx.insert(audit).values({
      id: randomUUID(),
      actorId: actor.id,
      action: `integration.${action === "rotate" ? "key_rotated" : action === "delete" ? "deleted" : action === "pause" ? "paused" : "activated"}`,
      resourceId: id,
    });
    return { ok: true };
  });
}

export async function integrationByKey(key: string) {
  if (!validKey(key)) return null;
  const [row] = await db
    .select()
    .from(partnerIntegrations)
    .where(eq(partnerIntegrations.publicKey, key));
  return row ?? null;
}

/** Changes whenever the partner should see something new. */
export async function embedVersion(integration: Integration) {
  const [latest] = await db
    .select({
      updated: sql<string>`coalesce(max(${listings.updatedAt})::text, '')`,
      count: sql<number>`count(*)::int`,
    })
    .from(listings)
    .where(eq(listings.status, "published"));
  return `${integration.version}.${integration.status}.${latest.count}.${latest.updated}`;
}

const messengerFields = ["whatsapp", "viber"];
const socialFields = ["facebook", "instagram", "tiktok", "youtube", "telegram"];
const linkTypes = ["phone", "email", "url"];

/**
 * The catalog as the partner may show it. Filtering happens here so that
 * switched-off data never reaches the partner's visitors' browsers.
 */
export async function embedCatalog(settings: IntegrationSettings) {
  const [places, config] = await Promise.all([
    publicCatalog(),
    catalogConfig(),
  ]);
  const { content, contacts } = settings;
  const categories = config.filter(
    (c) =>
      content.kinds.includes(c.kind as "location" | "experience") &&
      (content.categoryMode === "all" || content.categoryIds.includes(c.id)),
  );
  const allowed = new Set(categories.map((c) => c.id));
  const excluded = new Set(content.excludedListingIds);
  const visible = places
    .filter(
      (p) =>
        allowed.has(p.category) &&
        !excluded.has(p.id) &&
        (content.regionMode === "all" || content.regions.includes(p.region)),
    )
    .map((p): Place => {
      const contactsOn =
        p.kind === "experience" ? contacts.experiences : contacts.locations;
      const keep = (id: string) => {
        if (id === "booking_url") return contacts.booking;
        if (!contactsOn) return false;
        if (messengerFields.includes(id)) return contacts.messengers;
        if (socialFields.includes(id)) return contacts.social;
        return true;
      };
      return {
        ...p,
        contacts: Object.fromEntries(
          Object.entries(p.contacts ?? {}).filter(([id]) => keep(id)),
        ),
        contactFields: (p.contactFields ?? []).filter((f) => keep(f.id)),
        details: contactsOn
          ? p.details
          : p.details?.filter((d) => !linkTypes.includes(d.type ?? "")),
        ...(settings.features.prices
          ? {}
          : { price: 0, priceLabel: "", priceMode: "La cerere" }),
      };
    });
  return { places: visible, categories };
}

/** Published listings an admin can exclude from an integration. */
export async function excludableListings() {
  const places = await publicCatalog();
  return places.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    region: p.region,
    kind: p.kind ?? "location",
  }));
}

export async function recordEmbedView(
  integrationId: string,
  host: string,
  allowed: boolean,
) {
  const day = new Date().toISOString().slice(0, 10);
  await db
    .insert(integrationStats)
    .values({ integrationId, day, host: host.slice(0, 255), allowed, count: 1 })
    .onConflictDoUpdate({
      target: [
        integrationStats.integrationId,
        integrationStats.day,
        integrationStats.host,
        integrationStats.allowed,
      ],
      set: { count: sql`${integrationStats.count} + 1`, lastAt: new Date() },
    });
  if (allowed)
    await db
      .update(partnerIntegrations)
      .set({ lastSeenAt: new Date() })
      .where(eq(partnerIntegrations.id, integrationId));
}
