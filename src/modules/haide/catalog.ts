import { z } from "zod";
import type { Place } from "@/features/places/types";

const webUrl = z
  .url()
  .max(2048)
  .refine((value) => new URL(value).protocol === "https:", "HTTPS required");
export const haideItemSchema = z
  .object({
    type: z.enum(["experience", "guesthouse", "accommodation"]),
    id: z.string().regex(/^\d+$/).max(30),
    organization_id: z.string().regex(/^\d+$/).max(30),
    name: z.string().max(255),
    name_en: z.string().max(255),
    description: z.string().max(100000),
    description_en: z.string().max(100000),
    city: z.string().max(255),
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
    images: z.array(webUrl).max(30),
    price: z.number().finite().min(0).nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    bookable: z.boolean(),
    url: webUrl,
  })
  .strict();
export type HaideItem = z.infer<typeof haideItemSchema>;
export const haidePageSchema = z
  .object({
    version: z.literal(1),
    snapshot: z.uuid(),
    page: z.number().int().positive(),
    pages: z.number().int().positive().max(1000),
    total: z.number().int().nonnegative().max(100000),
    items: z.array(haideItemSchema).max(100),
  })
  .strict();
export type HaidePage = z.infer<typeof haidePageSchema>;
export const sourceKey = (item: Pick<HaideItem, "type" | "id">) =>
  `${item.type}:${item.id}`;
export const defaultCategories = {
  experience: "experience",
  guesthouse: "culture",
  accommodation: "stay",
};

export function validateHaideOrigin(item: HaideItem, siteUrl: string) {
  if (new URL(item.url).origin !== new URL(siteUrl).origin)
    throw new Error("Unexpected Haide listing origin");
}

export function importIssue(item: HaideItem): string | null {
  if (!item.name.trim()) return "Lipsește denumirea";
  if (
    item.latitude === null ||
    item.longitude === null ||
    (item.latitude === 0 && item.longitude === 0)
  )
    return "Lipsesc coordonatele";
  return null;
}

export function haidePlace(item: HaideItem, category: string): Place | null {
  if (importIssue(item)) return null;
  const linkId = item.bookable ? "booking_url" : "haide_url";
  return {
    id: `haide-${item.type}-${item.id}`,
    source: "haide",
    sourceId: sourceKey(item),
    name: item.name,
    translatedName: item.name_en,
    description: item.description,
    translatedDescription: item.description_en,
    category,
    kind: item.type === "experience" ? "experience" : "location",
    region: "",
    village: item.city,
    coordinates: [item.latitude!, item.longitude!],
    rating: 0,
    reviews: 0,
    demo: false,
    image: item.images[0] ?? "/placeholder.svg",
    images: item.images.length ? item.images : ["/placeholder.svg"],
    tags: [],
    hours: "",
    price: item.price ?? 0,
    currency: item.currency,
    priceMode:
      item.price === null
        ? "La cerere"
        : item.price === 0
          ? "Gratuit"
          : "De la",
    priceLabel: item.type === "accommodation" ? "noapte" : "persoană",
    contacts: { [linkId]: item.url },
    contactFields: [
      {
        id: linkId,
        label: item.bookable ? "Rezervă online" : "Vezi pe Haide",
        labelEn: item.bookable ? "Book online" : "View on Haide",
        type: "url",
        value: item.url,
      },
    ],
  };
}

/** Fetch a frozen, complete export before making any database changes. */
export async function fetchHaideSnapshot(
  apiUrl: string,
  token: string,
  siteUrl: string,
  getPage: (url: URL, token: string) => Promise<unknown>,
): Promise<HaideItem[]> {
  const endpoint = new URL(
    "integrations/map/catalog",
    apiUrl.replace(/\/?$/, "/"),
  );
  if (endpoint.protocol !== "https:")
    throw new Error("Haide API requires HTTPS");
  if (token.length < 32)
    throw new Error("Haide sync token must have at least 32 characters");
  let snapshot = "",
    pages = 1,
    total = 0;
  const items: HaideItem[] = [];
  const keys = new Set<string>();
  for (let page = 1; page <= pages; page++) {
    const url = new URL(endpoint);
    url.searchParams.set("page", String(page));
    if (snapshot) url.searchParams.set("snapshot", snapshot);
    const data = haidePageSchema.parse(await getPage(url, token));
    if (data.page !== page) throw new Error("Out-of-order Haide snapshot");
    if (page === 1) {
      snapshot = data.snapshot;
      pages = data.pages;
      total = data.total;
    }
    if (
      data.snapshot !== snapshot ||
      data.pages !== pages ||
      data.total !== total
    )
      throw new Error("Inconsistent Haide snapshot");
    for (const item of data.items) {
      validateHaideOrigin(item, siteUrl);
      const key = sourceKey(item);
      if (keys.has(key)) throw new Error("Duplicate Haide identifier");
      keys.add(key);
      items.push(item);
    }
  }
  if (items.length !== total) throw new Error("Incomplete Haide snapshot");
  return items;
}
