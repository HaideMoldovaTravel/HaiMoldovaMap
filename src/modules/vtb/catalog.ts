import { createHash } from "node:crypto";
import { z } from "zod";
import type { ContentValues } from "../catalog/schema";

const sourceUrl = z
  .url()
  .refine((value) =>
    /^https:\/\/www\.implicareplus\.org\/vtb\/location\/\d+\/$/.test(value),
  );
export const vtbRecordSchema = z.object({
  id: z.string().regex(/^vtb-\d+$/),
  source_url: sourceUrl,
  name: z.string().min(1),
  description: z.string(),
  locality: z.string(),
  district: z.string(),
  country: z.string(),
  coordinates: z
    .object({
      latitude: z.number().min(45).max(49),
      longitude: z.number().min(26).max(31),
    })
    .nullable(),
  contact_text: z.string(),
  phones: z.array(z.string()),
  emails: z.array(z.string()),
  activities: z.array(z.string()),
  images: z.array(
    z.object({
      url: z.url(),
      alt: z.string(),
      role: z.string().optional(),
      local_path: z.string().optional(),
      sha256: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      error: z.string().optional(),
    }),
  ),
  fields: z.record(z.string(), z.string()),
  field_links: z.record(z.string(), z.array(z.string())),
  publication_scope: z.literal("map_only"),
  sync_to_haide: z.literal(false),
  source_flags: z.object({
    approved: z.boolean().nullable(),
    available: z.boolean().nullable(),
  }),
  recommendation: z.object({
    bucket: z.enum(["location", "experience", "review", "exclude"]),
    suggested_category: z.string().nullable(),
    reason: z.string(),
  }),
});
export type VtbRecord = z.infer<typeof vtbRecordSchema>;
export const vtbSnapshotSchema = z
  .object({
    schema_version: z.literal(1),
    source: z.literal("https://www.implicareplus.org/vtb/"),
    extracted_at: z.string(),
    complete: z.literal(true),
    discovered: z.number().int().positive(),
    records: z.array(vtbRecordSchema),
  })
  .superRefine((snapshot, ctx) => {
    const ids = snapshot.records.map((r) => r.id);
    if (ids.length !== snapshot.discovered || new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Snapshot incomplet sau cu ID-uri duplicate.",
      });
    for (const record of snapshot.records)
      if (record.source_url.split("/").at(-2) !== record.id.slice(4))
        ctx.addIssue({
          code: "custom",
          message: `Identitate sursă invalidă: ${record.id}`,
        });
  });

export const vtbDecisionsSchema = z.object({
  snapshot_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  publication_scope: z.literal("map_only"),
  sync_to_haide: z.literal(false),
  decisions: z.array(
    z.object({
      id: z.string().regex(/^vtb-\d+$/),
      decision: z.enum([
        "pending",
        "approve_location",
        "approve_experience",
        "reject",
        "verify",
      ]),
      notes: z.string(),
    }),
  ),
});

export const normalizeVtbName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export const plainVtbText = (value: string) =>
  value
    .replace(/<\/?(?:a|b|strong|em|i|p|br|span)\b[^>]*>/gi, " ")
    .replace(/[<>]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();
export const vtbName = (value: string) =>
  plainVtbText(value)
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

export function vtbPhones(text: string): string[] {
  const result: string[] = [];
  for (const match of text.matchAll(
    /\+\s*\d[\d ()\u200e\u200f.-]{6,24}\d|(?<!\d)0\d{8}(?!\d)/g,
  )) {
    let digits = match[0].replace(/\D/g, "");
    if (/^0\d{8}$/.test(digits)) digits = `373${digits.slice(1)}`;
    if (/^3730\d{8}$/.test(digits)) digits = `373${digits.slice(4)}`;
    if (
      digits.startsWith("373")
        ? /^373[2-9]\d{7}$/.test(digits)
        : /^[1-9]\d{7,14}$/.test(digits)
    )
      result.push(`+${digits}`);
  }
  return [...new Set(result)];
}

export function vtbRegion(
  record: Pick<VtbRecord, "district" | "id">,
): string | null {
  const district = normalizeVtbName(
    record.district.replace(/District|Raionul/gi, ""),
  );
  if (
    [
      "briceni",
      "ocnita",
      "edinet",
      "donduseni",
      "rascani",
      "riscani",
      "drochia",
      "soroca",
      "glodeni",
      "falesti",
      "floresti",
      "singerei",
      "sangerei",
      "balti",
    ].includes(district)
  )
    return "Nord";
  if (
    [
      "cahul",
      "cantemir",
      "leova",
      "cimislia",
      "basarabeasca",
      "taraclia",
      "gagauzia",
      "comrat",
      "ceadir lunga",
      "vulcanesti",
      "stefanvoda",
      "causeni",
    ]
      .map(normalizeVtbName)
      .includes(district)
  )
    return "Sud";
  if (
    [
      "aneniinoi",
      "chisinau",
      "criuleni",
      "calarasi",
      "hincesti",
      "ialoveni",
      "nisporeni",
      "orhei",
      "rezina",
      "straseni",
      "telenesti",
      "soldanesti",
      "ungheni",
      "dubasari",
    ].includes(district)
  )
    return "Centru";
  // The source labels Severinovca broadly as left-bank administrative units.
  if (record.id === "vtb-223") return "Nord";
  return null;
}

export function vtbLinks(record: VtbRecord): Record<string, string> {
  const result: Record<string, string> = {};
  const relevant = [
    "Informații de Contact",
    "Meniu/ Servicii",
    "Sfat / Logistic",
  ];
  for (const key of relevant) {
    for (const raw of record.field_links[key] ?? []) {
      let url: URL;
      try {
        url = new URL(raw);
      } catch {
        continue;
      }
      if (!["http:", "https:"].includes(url.protocol)) continue;
      const host = url.hostname.replace(/^www\./, "");
      const channel =
        host === "t.me"
          ? "telegram"
          : ["facebook.com", "instagram.com", "tiktok.com", "youtube.com"]
              .find((h) => host === h || host.endsWith(`.${h}`))
              ?.split(".")[0];
      if (channel) result[channel] ??= url.href;
      else if (!/google\.|goo\.gl|booking\.com|youtu\.be/.test(host))
        result.website ??= url.href;
    }
  }
  const telegram = record.contact_text.match(/^@([a-z\d_]{5,32})$/i);
  if (telegram) result.telegram ??= `https://t.me/${telegram[1]}`;
  return result;
}

export function vtbValues(
  record: VtbRecord,
  kind: "location" | "experience",
): ContentValues {
  if (!record.coordinates) throw new Error("Coordonate exacte lipsă.");
  const region = vtbRegion(record);
  // The locality is stated verbatim in this source's title, but its form field is empty.
  const locality =
    record.locality || (record.id === "vtb-174" ? "Colibași" : "");
  if (!region || !locality)
    throw new Error("Localitatea sau regiunea nu este confirmată.");
  const logistic = record.fields["Sfat / Logistic"] ?? "";
  const reservationPhone = /rezerv|programar/i.test(logistic)
    ? vtbPhones(logistic)[0]
    : undefined;
  const phone = reservationPhone ?? vtbPhones(record.contact_text)[0];
  if (kind === "experience" && !phone)
    throw new Error("Experiență fără telefon de rezervare valid.");
  const publicServices =
    record.id === "vtb-156" ? "" : record.fields["Meniu/ Servicii"];
  const publicLogistic =
    record.id === "vtb-136"
      ? "Vizita se face cu programare. Perioada de înflorire și programul se confirmă telefonic."
      : logistic;
  const description = [
    ...new Set(
      [
        record.description,
        record.fields.Curiozitate,
        publicServices,
        publicLogistic,
      ]
        .filter(Boolean)
        .map(plainVtbText),
    ),
  ].join("\n\n");
  const { latitude, longitude } = record.coordinates;
  return {
    name: vtbName(record.name),
    description,
    village: locality,
    region,
    latitude,
    longitude,
    price_mode: "La cerere",
    ...(phone ? { phone } : {}),
    ...(phone && (/^\+373[67]\d{7}$/.test(phone) || /^\+447\d{9}$/.test(phone))
      ? { whatsapp: phone }
      : {}),
    ...(record.emails[0] ? { email: record.emails[0] } : {}),
    ...vtbLinks(record),
    // 24/7 on the source often describes access, not reservation availability.
    ...(record.fields["Orar de Functionare"]
      ? { hours: record.fields["Orar de Functionare"] }
      : {}),
    internal_notes: [
      "Origine: VTB. publication_scope=map_only; sync_to_haide=false.",
      `Sursă: ${record.source_url}`,
      `Raionul original: ${record.district}`,
      `Contact original: ${record.fields["Informații de Contact"] ?? ""}`,
      `Activități sursă (nu oferte separate): ${record.activities.join("; ")}`,
      "Import editorial autorizat de utilizator. Fără cont sau fișă în Haide. Prețul și disponibilitatea se confirmă la gazdă.",
    ].join("\n"),
  };
}

export function vtbAssetId(sha: string) {
  const hash = createHash("sha256").update(`vtb:${sha}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export type DuplicateCandidate = {
  id: string;
  kind: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  village: string;
};
export function vtbDuplicate(
  record: VtbRecord,
  kind: string,
  candidates: DuplicateCandidate[],
) {
  const name = normalizeVtbName(record.name);
  return candidates.find((candidate) => {
    if (candidate.id === record.id || candidate.kind !== kind) return false;
    const other = normalizeVtbName(candidate.name);
    const exact = name === other;
    const contained =
      Math.min(name.length, other.length) >= 8 &&
      (name.includes(other) || other.includes(name));
    if (!exact && !contained) return false;
    if (
      record.coordinates &&
      candidate.latitude !== null &&
      candidate.longitude !== null
    ) {
      const km = Math.hypot(
        (record.coordinates.latitude - candidate.latitude) * 111,
        (record.coordinates.longitude - candidate.longitude) * 76,
      );
      return km < 0.5;
    }
    return (
      exact &&
      normalizeVtbName(candidate.village) === normalizeVtbName(record.locality)
    );
  });
}
