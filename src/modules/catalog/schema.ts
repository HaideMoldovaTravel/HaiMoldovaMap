import { z } from "zod";

export class ContentValidationError extends Error {}
export const fieldTypes = [
  "text",
  "textarea",
  "phone",
  "email",
  "url",
  "number",
  "boolean",
  "select",
  "multiselect",
  "price",
  "gallery",
] as const;
export const fieldSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),
    label: z.string().trim().min(1).max(100),
    labelEn: z.string().trim().max(100).default(""),
    type: z.enum(fieldTypes),
    group: z.enum(["presentation", "location", "media", "contacts", "details"]),
    required: z.boolean().default(false),
    public: z.boolean().default(true),
    help: z.string().max(300).default(""),
    options: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  })
  .strict();
export type ContentField = z.infer<typeof fieldSchema>;
export const fieldsSchema = z
  .array(fieldSchema)
  .min(1)
  .max(80)
  .superRefine((fields, ctx) => {
    if (new Set(fields.map((f) => f.id)).size !== fields.length)
      ctx.addIssue({
        code: "custom",
        message: "Identificatorii câmpurilor trebuie să fie unici.",
      });
    for (const key of [
      "name",
      "description",
      "village",
      "region",
      "latitude",
      "longitude",
    ]) {
      const field = fields.find((f) => f.id === key);
      if (!field || !field.required || !field.public)
        ctx.addIssue({
          code: "custom",
          message: `Câmpul standard ${key} este obligatoriu și public.`,
        });
    }
    for (const f of fields)
      if (
        (f.type === "select" || f.type === "multiselect") &&
        (!f.options.length || new Set(f.options).size !== f.options.length)
      )
        ctx.addIssue({
          code: "custom",
          message: `Opțiuni invalide pentru ${f.label}.`,
        });
  });
export type ContentValues = Record<
  string,
  string | number | boolean | string[]
>;
const safeUrl = z
  .url()
  .max(2048)
  .refine(
    (value) => ["https:", "http:"].includes(new URL(value).protocol),
    "Folosește un link http sau https.",
  );
const phone = z
  .string()
  .regex(/^\+?[0-9 ()-]{6,30}$/, "Număr de telefon invalid.");

export function validateValues(
  fields: ContentField[],
  input: unknown,
  complete: boolean,
  allowDemoImages = false,
): ContentValues {
  const values = z.record(z.string(), z.unknown()).parse(input);
  const known = new Set(fields.map((f) => f.id));
  for (const key of Object.keys(values))
    if (!known.has(key))
      throw new ContentValidationError(
        `Câmp necunoscut: ${key}. Reîncarcă formularul.`,
      );
  const result: ContentValues = {};
  for (const field of fields) {
    const value = values[field.id];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && !value.length);
    if (empty) {
      if (complete && field.required)
        throw new ContentValidationError(`Completează „${field.label}”.`);
      continue;
    }
    let validator: z.ZodType = z
      .string()
      .max(field.type === "textarea" ? 20000 : 1000);
    if (field.type === "phone") validator = phone;
    if (field.type === "email") validator = z.email().max(254);
    if (field.type === "url") validator = safeUrl;
    if (field.type === "boolean") validator = z.boolean();
    if (field.type === "number" || field.type === "price")
      validator = z.number().finite().min(0).max(1e9);
    if (field.id === "latitude") validator = z.number().min(-90).max(90);
    if (field.id === "longitude") validator = z.number().min(-180).max(180);
    if (field.type === "select")
      validator = z.string().refine((v) => field.options.includes(v));
    if (field.type === "multiselect")
      validator = z
        .array(z.string().refine((v) => field.options.includes(v)))
        .max(50);
    if (field.type === "gallery")
      validator = z
        .array(
          allowDemoImages
            ? z
                .string()
                .refine(
                  (value) =>
                    z.uuid().safeParse(value).success ||
                    /^https:\/\/images\.unsplash\.com\//.test(value),
                )
            : z.uuid(),
        )
        .max(10);
    const checked = validator.safeParse(value);
    if (!checked.success)
      throw new ContentValidationError(
        `Valoare invalidă pentru „${field.label}”.`,
      );
    result[field.id] = checked.data as ContentValues[string];
  }
  return result;
}
export function publicValues(
  fields: ContentField[],
  values: ContentValues,
): ContentValues {
  const visible = new Set(fields.filter((f) => f.public).map((f) => f.id));
  return Object.fromEntries(
    Object.entries(values).filter(([key]) => visible.has(key)),
  );
}
export function assertCompatibleFields(
  previous: ContentField[],
  next: ContentField[],
) {
  const checked = fieldsSchema.parse(next);
  for (const old of previous) {
    const field = checked.find((f) => f.id === old.id);
    if (
      field &&
      (field.type !== old.type ||
        (old.public === false && field.public === true))
    )
      throw new ContentValidationError(
        `„${old.label}”: schimbarea tipului sau publicarea unui câmp intern necesită un câmp nou.`,
      );
    if (
      [
        "name",
        "description",
        "village",
        "region",
        "latitude",
        "longitude",
      ].includes(old.id) &&
      (!field || field.type !== old.type)
    )
      throw new ContentValidationError(
        "Câmpurile standard nu pot fi eliminate sau schimbate.",
      );
  }
  return checked;
}
