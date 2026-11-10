import { z } from "zod";
import { sourceKey, type HaideItem } from "./catalog";
const identity = z.union([z.string(), z.number()]).transform(String);
const guestCount = z.number().int().positive().nullish().catch(undefined);
const publicDetails = z.object({
  data: z.object({
    id: identity.optional(),
    booking_mode: z.enum(["group", "private"]).nullish().catch(undefined),
    min_guests: guestCount,
    max_guests: guestCount,
    guesthouse: z.object({
      id: identity,
      public_phone: z.string().max(50).nullish(),
    }),
  }),
});

/** Fill fields missing from the export using the approved public projection. */
export async function withPublicHaideDetails(
  items: HaideItem[],
  apiUrl: string,
  previous: Map<string, HaideItem>,
  getPublic: (url: URL) => Promise<unknown>,
): Promise<HaideItem[]> {
  const result: HaideItem[] = [];
  const routes = {
    experience: "experiences",
    guesthouse: "guesthouses",
    accommodation: "accommodations",
  };
  for (let start = 0; start < items.length; start += 4) {
    const batch = await Promise.all(
      items.slice(start, start + 4).map(async (item) => {
        // Explicit source values, including null, always win over the fallback.
        const fields = [
          ...(!Object.hasOwn(item, "phone") && !Object.hasOwn(item, "whatsapp")
            ? (["phone", "whatsapp"] as const)
            : []),
          ...(item.type === "experience"
            ? (["booking_mode", "min_guests", "max_guests"] as const)
            : []),
        ].filter((field) => !Object.hasOwn(item, field));
        if (!fields.length) return item;
        const url = new URL(
          `v1/public/${routes[item.type]}/${encodeURIComponent(item.id)}`,
          apiUrl.replace(/\/?$/, "/"),
        );
        if (url.protocol !== "https:")
          throw new Error("Haide public details require HTTPS");
        let fallback: Partial<HaideItem> | undefined;
        try {
          const { data } = publicDetails.parse(await getPublic(url));
          if (
            data.guesthouse.id !== item.organization_id ||
            (item.type !== "guesthouse" && data.id !== item.id)
          )
            throw new Error("Public detail identity mismatch");
          fallback = {
            booking_mode: data.booking_mode,
            min_guests: data.min_guests,
            max_guests: data.max_guests,
            phone: data.guesthouse.public_phone,
            whatsapp: data.guesthouse.public_phone,
          };
        } catch {
          // Preserve previously verified data if the public endpoint is unavailable.
          const old = previous.get(sourceKey(item));
          if (old?.organization_id === item.organization_id) fallback = old;
        }
        return {
          ...item,
          ...Object.fromEntries(
            fields
              .filter((field) => fallback?.[field] !== undefined)
              .map((field) => [field, fallback?.[field]]),
          ),
        };
      }),
    );
    result.push(...batch);
  }
  return result;
}
