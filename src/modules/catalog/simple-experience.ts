import {
  ContentValidationError,
  type ContentField,
  type ContentValues,
} from "./schema";

export const simpleExperienceKeys = [
  "name",
  "description",
  "min_people",
  "max_people",
  "village",
  "latitude",
  "longitude",
  "price",
  "hours",
  "phone",
  "gallery",
] as const;

/** The public submission only requires fields present in its compact form. */
export function simpleExperienceFields(fields: ContentField[]): ContentField[] {
  const required = new Set<string>(simpleExperienceKeys);
  return fields.map((field) => ({
    ...field,
    required: required.has(field.id),
  }));
}

export function validateSimpleExperience(
  values: ContentValues,
  complete: boolean,
) {
  for (const key of ["min_people", "max_people"]) {
    const value = values[key];
    if (
      value !== undefined &&
      value !== "" &&
      (typeof value !== "number" || !Number.isInteger(value) || value < 1)
    )
      throw new ContentValidationError(
        "Numărul de persoane trebuie să fie un întreg de cel puțin 1.",
      );
  }
  if (
    typeof values.min_people === "number" &&
    typeof values.max_people === "number" &&
    values.min_people > values.max_people
  )
    throw new ContentValidationError(
      "Numărul maxim de persoane trebuie să fie cel puțin egal cu cel minim.",
    );
  const gallery = Array.isArray(values.gallery) ? values.gallery : [];
  if (gallery.length > 5 || (complete && gallery.length < 4))
    throw new ContentValidationError("Adaugă 4–5 fotografii ale experienței.");
}

export type ListingFormMode = "simple" | "full";

/** Public submission mode is independent of the account's moderation rights. */
export function listingFormMode(
  kind: string,
  role: string,
  requested?: ListingFormMode,
): ListingFormMode {
  return kind === "experience" &&
    (requested === "simple" || !["owner", "admin", "moderator"].includes(role))
    ? "simple"
    : "full";
}
