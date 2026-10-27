// Imports places from the "Creăm harta turistică a Chișinăului" survey export.
//   npm run import:places -- <file.csv> [--dry-run]
// Idempotent: listing IDs derive from name + position, so re-running skips
// rows already imported and never overwrites edits made in the admin.
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/server/db";
import {
  categories,
  listings,
  revisions,
  templates,
  user,
} from "../src/server/db/schema";
import { initialFields } from "../src/modules/catalog/templates";
import {
  validateValues,
  type ContentValues,
} from "../src/modules/catalog/schema";

type NewCategory = {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  kind: "location" | "experience";
  // Existing category whose standard form the new one starts from.
  template: "culture" | "nature" | "stay" | "food" | "experience";
};

export const importCategories: NewCategory[] = [
  {
    id: "worship",
    name: "Lăcașuri de cult",
    nameEn: "Places of worship",
    color: "#7a5230",
    kind: "location",
    template: "culture",
  },
  {
    id: "monuments",
    name: "Monumente și patrimoniu",
    nameEn: "Monuments & heritage",
    color: "#8a6d3b",
    kind: "location",
    template: "culture",
  },
  {
    id: "museums",
    name: "Muzee",
    nameEn: "Museums",
    color: "#2f6f73",
    kind: "location",
    template: "culture",
  },
  {
    id: "theatres",
    name: "Teatre",
    nameEn: "Theatres",
    color: "#7b3f61",
    kind: "location",
    template: "culture",
  },
  {
    id: "galleries",
    name: "Galerii și spații culturale",
    nameEn: "Galleries & cultural venues",
    color: "#b5577a",
    kind: "location",
    template: "culture",
  },
  {
    id: "parks",
    name: "Parcuri",
    nameEn: "Parks",
    color: "#3f7d4e",
    kind: "location",
    template: "nature",
  },
  {
    id: "markets",
    name: "Piețe și târguri",
    nameEn: "Markets & fairs",
    color: "#c28a2b",
    kind: "location",
    template: "culture",
  },
  {
    id: "hotels",
    name: "Hoteluri",
    nameEn: "Hotels",
    color: "#9c5b3c",
    kind: "location",
    template: "stay",
  },
  {
    id: "resorts",
    name: "Complexe turistice",
    nameEn: "Resorts",
    color: "#4f7a3a",
    kind: "location",
    template: "stay",
  },
  {
    id: "cafes",
    name: "Cafenele",
    nameEn: "Coffee shops",
    color: "#6f4e37",
    kind: "location",
    template: "food",
  },
  {
    id: "bars",
    name: "Baruri",
    nameEn: "Bars",
    color: "#b8642f",
    kind: "location",
    template: "food",
  },
  {
    id: "wine-bars",
    name: "Baruri de vin",
    nameEn: "Wine bars",
    color: "#8e2f4f",
    kind: "location",
    template: "food",
  },
  {
    id: "tour-operators",
    name: "Agenții de turism",
    nameEn: "Tour operators",
    color: "#3d6fa3",
    kind: "location",
    template: "culture",
  },
  {
    id: "shopping",
    name: "Shopping",
    nameEn: "Shopping",
    color: "#5b5fa8",
    kind: "location",
    template: "culture",
  },
];

// Survey sub-category → platform category, tags, and whether entry is free.
const mapping: Record<
  string,
  { category: string; tags: string[]; free?: boolean }
> = {
  Church: { category: "worship", tags: ["Patrimoniu", "Istorie"], free: true },
  Monument: {
    category: "monuments",
    tags: ["Patrimoniu", "Istorie"],
    free: true,
  },
  "Historic Monument": {
    category: "monuments",
    tags: ["Patrimoniu", "Istorie"],
  },
  "Historical Monument": {
    category: "monuments",
    tags: ["Patrimoniu", "Istorie"],
  },
  Station: { category: "monuments", tags: ["Istorie"] },
  Museum: { category: "museums", tags: ["Istorie", "Patrimoniu"] },
  Theatre: { category: "theatres", tags: ["Tradiții"] },
  "Art Gallery": { category: "galleries", tags: [] },
  "Cultural venue": { category: "galleries", tags: [] },
  Park: { category: "parks", tags: ["Plimbări", "Familie"], free: true },
  Market: { category: "markets", tags: ["Bucătărie locală", "Tradiții"] },
  "Weekend Fair": { category: "markets", tags: ["Bucătărie locală"] },
  "Seasonal Fair": { category: "markets", tags: ["Tradiții"] },
  Exhibition: { category: "markets", tags: [] },
  "Food trucks": { category: "markets", tags: [] },
  Kiosks: { category: "markets", tags: [] },
  "Street Performer": { category: "markets", tags: [] },
  Hotel: { category: "hotels", tags: ["Cazare"] },
  "Touristic Complex": { category: "resorts", tags: ["Cazare", "Restaurant"] },
  "Coffee Shops": { category: "cafes", tags: [] },
  Bars: { category: "bars", tags: [] },
  "Wine Bar": { category: "wine-bars", tags: ["Degustări de vin"] },
  "Traditional cuisine": {
    category: "food",
    tags: ["Restaurant", "Bucătărie locală"],
  },
  Experiences: { category: "experience", tags: [] },
  "Tour Operator": { category: "tour-operators", tags: ["Tur ghidat"] },
  "Shopping Mall": { category: "shopping", tags: [] },
};
// When the survey lists a place twice, keep the more specific category.
const preferred = ["Theatre", "Museum", "Historic Monument", "Church"];

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

export const normalizeName = (value: string) =>
  value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/** Decimal pairs ("47.03, 28.84") and DMS ("47°1′9.5″N 28°49′20″E"). */
export function parseCoordinates(value: string): [number, number] | null {
  const text = value.trim();
  const decimal = text.match(
    /(-?\d{1,2}\.\d+)\s*°?\s*N?\s*[,;\s]\s*(-?\d{1,3}\.\d+)/,
  );
  let result: [number, number] | null = null;
  if (decimal) result = [Number(decimal[1]), Number(decimal[2])];
  else {
    const dms = [
      ...text.matchAll(
        /(\d{1,3})°\s*(\d{1,2})?[′']?\s*([\d.]+)?[″"]?\s*([NSEW])/g,
      ),
    ];
    if (dms.length === 2) {
      const [lat, lng] = dms.map(
        (m) =>
          (Number(m[1]) + Number(m[2] ?? 0) / 60 + Number(m[3] ?? 0) / 3600) *
          (m[4] === "S" || m[4] === "W" ? -1 : 1),
      );
      result = [lat, lng];
    }
  }
  // Moldova's bounding box, with a margin.
  if (
    !result ||
    result[0] < 45 ||
    result[0] > 49 ||
    result[1] < 26 ||
    result[1] > 31
  )
    return null;
  return result;
}

export function parsePhones(value: string) {
  const phones: string[] = [];
  for (const match of value.matchAll(/\+?\(?\+?\d[\d\s()-]{6,}\d/g)) {
    let digits = match[0].replace(/\D/g, "");
    if (digits.length < 8) continue;
    if (digits.startsWith("373")) digits = digits.slice(3);
    else if (match[0].includes("+") || digits.length > 9) {
      phones.push(`+${digits}`);
      continue;
    }
    digits = digits.replace(/^0/, "");
    if (digits.length === 8) phones.push(`+373 ${digits}`);
  }
  return [...new Set(phones)];
}

export const parseEmails = (value: string) => [
  ...new Set(value.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? []),
];

export function parseLinks(value: string) {
  const links: Record<string, string> = {};
  for (let raw of value.split(/[\s,]+/).filter(Boolean)) {
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    let url: URL;
    try {
      url = new URL(raw);
      // Unwrap Google redirect links.
      if (url.hostname.endsWith("google.com") && url.searchParams.get("url"))
        url = new URL(url.searchParams.get("url")!);
    } catch {
      continue;
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !url.hostname.includes(".")
    )
      continue;
    const host = url.hostname.replace(/^www\./, "");
    const key = host.endsWith("facebook.com")
      ? "facebook"
      : host.endsWith("instagram.com")
        ? "instagram"
        : host.endsWith("tiktok.com")
          ? "tiktok"
          : host.endsWith("youtube.com") || host === "youtu.be"
            ? "youtube"
            : host === "t.me"
              ? "telegram"
              : host.endsWith("booking.com")
                ? "booking_url"
                : host.startsWith("maps.") || host.includes("goo.gl")
                  ? ""
                  : "website";
    if (key && !links[key] && url.href.length <= 2048) links[key] = url.href;
  }
  return links;
}

const cleanAddress = (value: string) => {
  const address = value
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[\s,]+$/g, "")
    .replace(/^[\s,]+/g, "")
    .trim();
  if (!address) return "Chișinău";
  return /chi[sș]in[aă]u|kishinev/i.test(address)
    ? address
    : `${address}, Chișinău`;
};

const distance = (a: [number, number], b: [number, number]) => {
  const rad = Math.PI / 180;
  const x = (b[1] - a[1]) * rad * Math.cos(((a[0] + b[0]) / 2) * rad);
  const y = (b[0] - a[0]) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
};

type Row = {
  line: number;
  name: string;
  description: string;
  address: string;
  coordinates: [number, number] | null;
  links: string;
  contacts: string;
  source: string;
  photos: string;
};

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  if (!file)
    throw new Error(
      "Folosire: npm run import:places -- <fișier.csv> [--dry-run]",
    );
  const [header, ...body] = parseCsv(
    readFileSync(file, "utf8").replace(/^﻿/, ""),
  );
  const column = (label: RegExp) => {
    const index = header.findIndex((h) => label.test(h));
    if (index < 0) throw new Error(`Coloana ${label} lipsește din fișier.`);
    return index;
  };
  const c = {
    name: column(/^Denumire/i),
    description: column(/^Descrierea/i),
    address: column(/^Adres/i),
    coordinates: column(/^Coordonate/i),
    links: column(/^Website|social/i),
    contacts: column(/^Date de contact/i),
    category: column(/^Categoria loca/i),
    photos: column(/^Fotografii/i),
  };
  const skipped: { line: number; name: string; reason: string }[] = [];
  const unique: Row[] = [];
  body.forEach((cells, index) => {
    const line = index + 2;
    const get = (i: number) => (cells[i] ?? "").trim();
    const row: Row = {
      line,
      name: get(c.name).replace(/\s+/g, " "),
      description: get(c.description),
      address: get(c.address),
      coordinates: parseCoordinates(get(c.coordinates)),
      links: get(c.links),
      contacts: get(c.contacts),
      source: get(c.category),
      photos: get(c.photos),
    };
    if (!row.name) return;
    if (!mapping[row.source])
      return skipped.push({
        line,
        name: row.name,
        reason: `categorie neacoperită: ${row.source || "—"}`,
      });
    if (!row.coordinates)
      return skipped.push({ line, name: row.name, reason: "fără coordonate" });
    const twin = unique.find(
      (u) =>
        normalizeName(u.name) === normalizeName(row.name) &&
        distance(u.coordinates!, row.coordinates!) < 200,
    );
    if (!twin) return unique.push(row);
    // Merge duplicates: fill gaps, prefer the more specific category.
    if (
      preferred.indexOf(row.source) > -1 &&
      (preferred.indexOf(twin.source) < 0 ||
        preferred.indexOf(row.source) < preferred.indexOf(twin.source))
    )
      twin.source = row.source;
    for (const key of [
      "description",
      "address",
      "links",
      "contacts",
      "photos",
    ] as const)
      if (!twin[key]) twin[key] = row[key];
    skipped.push({
      line,
      name: row.name,
      reason: `duplicat al rândului ${twin.line} (unit)`,
    });
  });

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(832746129)`);
    const [owner] = await tx
      .select()
      .from(user)
      .where(eq(user.role, "owner"))
      .limit(1);
    if (!owner) throw new Error("Rulează mai întâi npm run db:seed.");
    const existingCategories = await tx
      .select({ id: categories.id, order: categories.order })
      .from(categories);
    let order = Math.max(0, ...existingCategories.map((x) => x.order)) + 1;
    let createdCategories = 0;
    for (const category of importCategories) {
      if (existingCategories.some((x) => x.id === category.id)) continue;
      createdCategories++;
      if (dryRun) continue;
      await tx.insert(categories).values({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        color: category.color,
        kind: category.kind,
        order: order++,
      });
      await tx.insert(templates).values({
        id: `initial-${category.id}-v1`,
        categoryId: category.id,
        version: 1,
        fields: initialFields(category.template),
      });
    }
    const latestTemplate = new Map<
      string,
      { id: string; fields: typeof templates.$inferSelect.fields }
    >();
    for (const t of await tx
      .select()
      .from(templates)
      .orderBy(sql`${templates.version} DESC`))
      if (!latestTemplate.has(t.categoryId))
        latestTemplate.set(t.categoryId, t);

    let imported = 0;
    let existing = 0;
    const perCategory: Record<string, number> = {};
    for (const row of unique) {
      const target = mapping[row.source];
      const [lat, lng] = row.coordinates!;
      const id = `import-${createHash("sha1")
        .update(
          `${normalizeName(row.name)}:${lat.toFixed(4)}:${lng.toFixed(4)}`,
        )
        .digest("hex")
        .slice(0, 20)}`;
      const [found] = await tx
        .select({ id: listings.id })
        .from(listings)
        .where(eq(listings.id, id));
      if (found) {
        existing++;
        continue;
      }
      const template =
        latestTemplate.get(target.category) ??
        (dryRun
          ? {
              id: "dry-run",
              fields: initialFields(
                importCategories.find((x) => x.id === target.category)
                  ?.template ?? (target.category as "food" | "experience"),
              ),
            }
          : undefined);
      if (!template) throw new Error(`Șablon lipsă pentru ${target.category}.`);
      const known = new Set(template.fields.map((f) => f.id));
      const links = parseLinks(row.links);
      const phones = parsePhones(row.contacts);
      const emails = parseEmails(row.contacts);
      const tagOptions =
        template.fields.find((f) => f.id === "tags")?.options ?? [];
      const notes = [
        `Importat din ${file.split("/").pop()}, rândul ${row.line}. Categoria din chestionar: ${row.source}.`,
        phones.length > 1
          ? `Alte telefoane: ${phones.slice(1).join(", ")}`
          : "",
        emails.length > 1 ? `Alte emailuri: ${emails.slice(1).join(", ")}` : "",
        row.photos
          ? `Fotografii propuse: ${row.photos}`
          : "Fără fotografii în chestionar.",
        (row.address.match(/https?:\/\/\S+/) ?? [""])[0]
          ? `Google Maps: ${row.address.match(/https?:\/\/\S+/)![0].replace(/,$/, "")}`
          : "",
        "Text original în engleză: de tradus în română.",
      ].filter(Boolean);
      const description = row.description || `${row.name}, Chișinău.`;
      const candidate: ContentValues = {
        name: row.name.slice(0, 1000),
        name_en: row.name.slice(0, 1000),
        description,
        description_en: description,
        region: "Centru",
        village: cleanAddress(row.address).slice(0, 1000),
        latitude: lat,
        longitude: lng,
        ...(phones[0] ? { phone: phones[0] } : {}),
        ...(emails[0] ? { email: emails[0].toLowerCase() } : {}),
        ...links,
        ...(target.tags.filter((t) => tagOptions.includes(t)).length
          ? { tags: target.tags.filter((t) => tagOptions.includes(t)) }
          : {}),
        ...(target.free ? { price_mode: "Gratuit" } : {}),
        internal_notes: notes.join("\n"),
      };
      const values = Object.fromEntries(
        Object.entries(candidate).filter(([key]) => known.has(key)),
      ) as ContentValues;
      // Drop single values the form validator rejects, instead of the place.
      for (const key of ["phone", "email", ...Object.keys(links)])
        if (key in values)
          try {
            validateValues(
              template.fields.filter((f) => f.id === key),
              { [key]: values[key] },
              false,
            );
          } catch {
            delete values[key];
          }
      validateValues(template.fields, values, true);
      perCategory[target.category] = (perCategory[target.category] ?? 0) + 1;
      imported++;
      if (dryRun) continue;
      const kind =
        importCategories.find((x) => x.id === target.category)?.kind ??
        (target.category === "experience" ? "experience" : "location");
      const revisionId = randomUUID();
      await tx
        .insert(listings)
        .values({ id, ownerId: owner.id, kind, status: "unpublished" });
      await tx.insert(revisions).values({
        id: revisionId,
        listingId: id,
        authorId: owner.id,
        categoryId: target.category,
        templateId: template.id,
        values,
        point: { x: lng, y: lat },
        status: "approved",
        feedback: "Import din chestionarul hărții Chișinăului.",
        reviewedBy: owner.id,
        reviewedAt: new Date(),
      });
      await tx
        .update(listings)
        .set({ publishedRevisionId: revisionId, status: "published" })
        .where(eq(listings.id, id));
    }
    console.log(
      `${dryRun ? "[SIMULARE] " : ""}Categorii noi: ${createdCategories}`,
    );
    console.log(
      `${dryRun ? "[SIMULARE] " : ""}Locații importate și publicate: ${imported} (deja existente: ${existing})`,
    );
    for (const [category, count] of Object.entries(perCategory).sort(
      (a, b) => b[1] - a[1],
    ))
      console.log(`  ${category.padEnd(15)} ${count}`);
    console.log(`Rânduri omise: ${skipped.length}`);
    for (const s of skipped)
      console.log(`  rândul ${s.line}: ${s.name} — ${s.reason}`);
  });
}

if (process.argv[1]?.endsWith("import-places.ts"))
  await main().finally(() => pool.end());
