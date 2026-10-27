import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import {
  user,
  account,
  categories,
  templates,
  listings,
  revisions,
} from "../src/server/db/schema";
import {
  initialCategories,
  initialFields,
} from "../src/modules/catalog/templates";
import { places } from "../src/features/places/data";
import { mockContacts } from "../src/features/places/contacts";
const email = process.env.ADMIN_EMAIL?.toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password || password.length < 12)
  throw new Error(
    "Configurează ADMIN_EMAIL și ADMIN_PASSWORD (minimum 12 caractere).",
  );
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(832746128)`);
  let [owner] = await tx.select().from(user).where(eq(user.email, email));
  if (!owner) {
    const [existingOwner] = await tx
      .select()
      .from(user)
      .where(eq(user.role, "owner"))
      .limit(1);
    if (existingOwner)
      throw new Error(
        "Bootstrap already completed. Invite administrators from the application.",
      );
    const id = randomUUID();
    [owner] = await tx
      .insert(user)
      .values({
        id,
        name: "Administrator Hai Moldova",
        email,
        emailVerified: true,
        role: "owner",
      })
      .returning();
    await tx
      .insert(account)
      .values({
        id: randomUUID(),
        userId: id,
        accountId: id,
        providerId: "credential",
        password: await hashPassword(password),
      });
  }
  // Never promote a pre-existing public account through seed configuration.
  if (owner.role !== "owner")
    throw new Error(
      "Bootstrap email belongs to an existing non-owner account.",
    );
  for (const [order, category] of initialCategories.entries()) {
    await tx
      .insert(categories)
      .values({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        color: category.color,
        kind: category.kind,
        order,
      })
      .onConflictDoNothing();
    const templateId = `initial-${category.id}-v1`;
    await tx
      .insert(templates)
      .values({
        id: templateId,
        categoryId: category.id,
        version: 1,
        fields: initialFields(category.id),
      })
      .onConflictDoNothing();
  }
  if (process.env.SEED_DEMO !== "true") return;
  for (const place of places) {
    const [existing] = await tx
      .select()
      .from(listings)
      .where(eq(listings.id, place.id));
    if (existing) continue;
    const category = initialCategories.find((c) => c.id === place.category)!;
    const contact = mockContacts[place.id];
    const revisionId = randomUUID();
    await tx
      .insert(listings)
      .values({
        id: place.id,
        ownerId: owner.id,
        kind: category.kind,
        demo: true,
        status: "unpublished",
      });
    await tx
      .insert(revisions)
      .values({
        id: revisionId,
        listingId: place.id,
        authorId: owner.id,
        categoryId: category.id,
        templateId: `initial-${category.id}-v1`,
        point: { x: place.coordinates[1], y: place.coordinates[0] },
        status: "approved",
        reviewedBy: owner.id,
        reviewedAt: new Date(),
        values: {
          name: place.name,
          description: place.description,
          region: place.region,
          village: place.village,
          latitude: place.coordinates[0],
          longitude: place.coordinates[1],
          gallery: place.images,
          phone: contact.phone,
          email: contact.email,
          website: `https://${contact.website}`,
          whatsapp: contact.whatsapp,
          viber: contact.viber,
          hours: place.hours,
          price: place.price,
          price_mode: place.price ? "De la" : "Gratuit",
          currency: "MDL",
          price_unit: place.priceLabel,
          demo_featured: !!place.featured,
          demo_rating: place.rating,
          demo_reviews: place.reviews,
          tags: place.tags,
        },
      });
    await tx
      .update(listings)
      .set({ publishedRevisionId: revisionId, status: "published" })
      .where(eq(listings.id, place.id));
  }
});
console.log(
  "Bootstrap and category templates ready. Existing data was preserved.",
);
await pool.end();
