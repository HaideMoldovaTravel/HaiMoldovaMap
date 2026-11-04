// Read-only by default. --apply publishes only the selected records to the map DB.
import { createHash, randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db, pool } from "../src/server/db";
import {
  assets,
  audit,
  categories,
  haideCatalog,
  listings,
  revisions,
  templates,
  user,
} from "../src/server/db/schema";
import { initializeStorage, putImage } from "../src/server/storage";
import {
  validateValues,
  type ContentValues,
} from "../src/modules/catalog/schema";
import {
  vtbAssetId,
  vtbDecisionsSchema,
  vtbDuplicate,
  vtbSnapshotSchema,
  vtbValues,
  type DuplicateCandidate,
} from "../src/modules/vtb/catalog";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file)
    throw new Error(
      "Folosește npm run import:vtb -- data/vtb/AAAA-LL-ZZ/catalog.json [--select] [--apply]",
    );
  const path = resolve(file),
    directory = dirname(path),
    applying = args.includes("--apply");
  const input = await readFile(path);
  const hash = createHash("sha256").update(input).digest("hex");
  const snapshot = vtbSnapshotSchema.parse(JSON.parse(input.toString("utf8")));
  const decisionPath = resolve(directory, "selection.json");
  // The user explicitly delegated selection to the assistant. Generated decisions
  // remain reviewable and do not write anything until the separate --apply flag.
  if (args.includes("--select")) {
    await writeFile(
      decisionPath,
      JSON.stringify(
        {
          schema_version: 1,
          snapshot_sha256: hash,
          source: snapshot.source,
          publication_scope: "map_only",
          sync_to_haide: false,
          reviewer: "assistant",
          authorization:
            "Utilizatorul a delegat selecția și importul numai pe hartă, cu rezervare prin contact direct.",
          decisions: snapshot.records.map((record) => ({
            id: record.id,
            name: record.name,
            decision:
              record.recommendation.bucket === "location"
                ? "approve_location"
                : record.recommendation.bucket === "experience"
                  ? "approve_experience"
                  : record.recommendation.bucket === "exclude"
                    ? "reject"
                    : "verify",
            notes: record.recommendation.reason,
          })),
        },
        null,
        2,
      ) + "\n",
    );
  }
  const decisions = vtbDecisionsSchema.parse(
    JSON.parse(await readFile(decisionPath, "utf8")),
  );
  if (decisions.snapshot_sha256 !== hash)
    throw new Error("Selecția nu corespunde snapshotului.");
  const decisionById = new Map(
    decisions.decisions.map((decision) => [decision.id, decision]),
  );
  if (
    decisionById.size !== snapshot.records.length ||
    decisions.decisions.length !== snapshot.records.length ||
    snapshot.records.some((r) => !decisionById.has(r.id))
  )
    throw new Error("Selecție incompletă sau cu ID-uri duplicate.");
  const [owner] = await db
    .select()
    .from(user)
    .where(eq(user.role, "owner"))
    .limit(1);
  if (!owner)
    throw new Error("Administratorul principal nu există în baza configurată.");
  const config = await db
    .select({ category: categories, template: templates })
    .from(categories)
    .innerJoin(templates, eq(templates.categoryId, categories.id))
    .orderBy(desc(templates.version));
  const existing = await db
    .select({ listing: listings, revision: revisions })
    .from(listings)
    .leftJoin(revisions, eq(revisions.id, listings.publishedRevisionId));
  const candidates: DuplicateCandidate[] = existing
    .filter((r) => r.revision && !r.listing.demo)
    .map(({ listing, revision }) => ({
      id: listing.id,
      kind: listing.kind,
      name: String(revision!.values.name ?? ""),
      latitude:
        typeof revision!.values.latitude === "number"
          ? revision!.values.latitude
          : null,
      longitude:
        typeof revision!.values.longitude === "number"
          ? revision!.values.longitude
          : null,
      village: String(revision!.values.village ?? ""),
    }));
  const haide = await db
    .select()
    .from(haideCatalog)
    .where(
      and(eq(haideCatalog.visible, true), eq(haideCatalog.suppressed, false)),
    );
  for (const row of haide)
    candidates.push({
      id: row.id,
      kind: row.payload.type === "experience" ? "experience" : "location",
      name: row.payload.name,
      latitude: row.payload.latitude,
      longitude: row.payload.longitude,
      village: row.payload.city,
    });
  const prepared: {
    id: string;
    kind: "location" | "experience";
    categoryId: string;
    templateId: string;
    values: ContentValues;
  }[] = [];
  const photos = new Map<
    string,
    { id: string; key: string; bytes: Buffer; alt: string }
  >();
  const skipped: { id: string; name: string; reason: string }[] = [];
  const imageIssues: { id: string; url: string; reason: string }[] = [];
  const resortHotel = snapshot.records.find((r) => r.id === "vtb-32");
  const combineResort =
    resortHotel &&
    decisionById.get("vtb-30")?.decision === "approve_location" &&
    decisionById.get("vtb-32")?.decision === "approve_location";
  for (const original of snapshot.records) {
    if (original.id === "vtb-32" && combineResort) {
      skipped.push({
        id: original.id,
        name: original.name,
        reason:
          "Hotelul și restaurantul Eco Resort Butuceni sunt reunite în locația vtb-30.",
      });
      continue;
    }
    const record =
      original.id === "vtb-30" && combineResort
        ? {
            ...original,
            images: [
              ...original.images,
              ...resortHotel.images.filter(
                (image) =>
                  !original.images.some(
                    (existing) => existing.url === image.url,
                  ),
              ),
            ],
            fields: {
              ...original.fields,
              Curiozitate: [
                original.fields.Curiozitate,
                resortHotel.fields.Curiozitate,
              ]
                .filter(Boolean)
                .join("\n\n"),
              "Sfat / Logistic": [
                original.fields["Sfat / Logistic"],
                resortHotel.fields["Sfat / Logistic"],
              ]
                .filter(Boolean)
                .join("\n\n"),
            },
          }
        : original;
    const decision = decisionById.get(record.id)!;
    if (!decision.decision.startsWith("approve_")) continue;
    if (existing.some((row) => row.listing.id === record.id)) {
      skipped.push({
        id: record.id,
        name: record.name,
        reason: "ID deja existent; păstrat fără suprascriere.",
      });
      continue;
    }
    const kind =
      decision.decision === "approve_experience" ? "experience" : "location";
    try {
      if (record.recommendation.bucket === "exclude")
        throw new Error("Fișă exclusă de regulile editoriale.");
      if (!record.source_flags.approved || !record.source_flags.available)
        throw new Error("Fișă neaprobată sau indisponibilă la sursă.");
      const duplicate = vtbDuplicate(record, kind, candidates);
      if (duplicate)
        throw new Error(
          `Posibil duplicat: ${duplicate.id} (${duplicate.name}).`,
        );
      const categoryId =
        kind === "experience"
          ? "experience"
          : record.recommendation.suggested_category;
      const entry = config.find(
        (row) =>
          row.category.id === categoryId &&
          row.category.active &&
          row.category.kind === kind,
      );
      if (!entry) throw new Error("Categoria sau șablonul nu este disponibil.");
      const base = vtbValues(record, kind);
      if (record.id === "vtb-30" && combineResort)
        base.internal_notes += `\nFișa hotelului reunită în această locație: ${resortHotel.source_url}`;
      const known = new Set(entry.template.fields.map((field) => field.id));
      const values = Object.fromEntries(
        Object.entries(base).filter(([key]) => known.has(key)),
      ) as ContentValues;
      validateValues(entry.template.fields, values, true);
      const gallery: string[] = [];
      for (const image of record.images
        .filter((i) => !i.role?.startsWith("Istorie"))
        .slice(0, 10)) {
        try {
          if (!image.local_path || !image.sha256)
            throw new Error(image.error || "Fotografie locală lipsă.");
          const imagePath = resolve(directory, image.local_path);
          if (!imagePath.startsWith(resolve(directory, "images") + sep))
            throw new Error("Cale media invalidă.");
          const bytes = await readFile(imagePath);
          if (createHash("sha256").update(bytes).digest("hex") !== image.sha256)
            throw new Error("Fotografia nu corespunde hashului din snapshot.");
          const id = vtbAssetId(image.sha256);
          if (!photos.has(id)) {
            const optimized = await sharp(bytes, {
              limitInputPixels: 25000000,
              animated: false,
            })
              .rotate()
              .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
              .webp({ quality: 85 })
              .toBuffer();
            photos.set(id, {
              id,
              key: `imports/vtb/${id}.webp`,
              bytes: optimized,
              alt: String(values.name),
            });
          }
          if (!gallery.includes(id)) gallery.push(id);
        } catch (error) {
          imageIssues.push({
            id: record.id,
            url: image.url,
            reason: String(error instanceof Error ? error.message : error),
          });
        }
      }
      if (!gallery.length)
        throw new Error(
          "Nu există fotografie publică validă pentru această fișă.",
        );
      values.gallery = gallery;
      validateValues(entry.template.fields, values, true);
      prepared.push({
        id: record.id,
        kind,
        categoryId: entry.category.id,
        templateId: entry.template.id,
        values,
      });
      candidates.push({
        id: record.id,
        kind,
        name: record.name,
        latitude: record.coordinates!.latitude,
        longitude: record.coordinates!.longitude,
        village: String(values.village),
      });
    } catch (error) {
      skipped.push({
        id: record.id,
        name: record.name,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  const usedPhotos = new Set(
    prepared.flatMap((r) => r.values.gallery as string[]),
  );
  const uploads = [...photos.values()].filter((p) => usedPhotos.has(p.id));
  const result = {
    mode: applying ? "applied" : "dry_run",
    publication_scope: "map_only",
    sync_to_haide: false,
    snapshot_sha256: hash,
    selected: decisions.decisions.filter((d) =>
      d.decision.startsWith("approve_"),
    ).length,
    locations: prepared.filter((r) => r.kind === "location").length,
    experiences: prepared.filter((r) => r.kind === "experience").length,
    images: uploads.length,
    optimized_bytes: uploads.reduce((total, p) => total + p.bytes.length, 0),
    records: prepared.map((r) => ({
      id: r.id,
      name: r.values.name,
      kind: r.kind,
      category: r.categoryId,
      phone: r.values.phone ?? null,
      whatsapp: r.values.whatsapp ?? null,
      images: (r.values.gallery as string[]).length,
    })),
    skipped,
    image_issues: imageIssues,
  };
  if (applying && prepared.length) {
    await initializeStorage();
    for (const photo of uploads) {
      const [asset] = await db
        .select()
        .from(assets)
        .where(eq(assets.id, photo.id));
      if (asset && (asset.key !== photo.key || asset.archivedAt))
        throw new Error(`Identitate media indisponibilă: ${photo.id}`);
      if (!asset) await putImage(photo.key, photo.bytes);
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(832746130)`);
      for (const photo of uploads)
        await tx
          .insert(assets)
          .values({
            id: photo.id,
            ownerId: owner.id,
            key: photo.key,
            filename: `${photo.id}.webp`,
            size: photo.bytes.length,
            altText: photo.alt,
            purpose: "listing",
          })
          .onConflictDoNothing({ target: assets.id });
      for (const record of prepared) {
        const [found] = await tx
          .select()
          .from(listings)
          .where(eq(listings.id, record.id));
        if (found)
          throw new Error(
            "Catalog modificat în timpul pregătirii. Reexecută importul.",
          );
        const revisionId = randomUUID();
        await tx.insert(listings).values({
          id: record.id,
          ownerId: owner.id,
          kind: record.kind,
          status: "unpublished",
          demo: false,
        });
        await tx.insert(revisions).values({
          id: revisionId,
          listingId: record.id,
          authorId: owner.id,
          categoryId: record.categoryId,
          templateId: record.templateId,
          values: record.values,
          point: {
            x: Number(record.values.longitude),
            y: Number(record.values.latitude),
          },
          status: "approved",
          reviewedBy: owner.id,
          reviewedAt: new Date(),
          feedback:
            "Import editorial Village Travel Bot. Doar harta; rezervare prin contact direct.",
        });
        await tx
          .update(listings)
          .set({ status: "published", publishedRevisionId: revisionId })
          .where(eq(listings.id, record.id));
        await tx.insert(audit).values({
          id: randomUUID(),
          actorId: owner.id,
          action: "listing.imported.vtb",
          resourceId: record.id,
        });
      }
    });
  }
  await writeFile(
    resolve(directory, applying ? "import-result.json" : "import-preview.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify({ ...result, records: undefined }, null, 2));
}

await main().finally(() => pool.end());
