import { z } from "zod";
import { sourceKey, type HaideItem } from "./catalog";
const identity = z.union([z.string(), z.number()]).transform(String);
const publicContact = z.object({
  data: z.object({
    id: identity.optional(),
    guesthouse: z.object({
      id: identity,
      public_phone: z.string().max(50).nullable(),
    }),
  }),
});

/** Compatibility with older exports: use only the approved public projection. */
export async function withPublicHaideContacts(
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
        if (Object.hasOwn(item, "phone") || Object.hasOwn(item, "whatsapp"))
          return item;
        const url = new URL(
          `v1/public/${routes[item.type]}/${encodeURIComponent(item.id)}`,
          apiUrl.replace(/\/?$/, "/"),
        );
        if (url.protocol !== "https:")
          throw new Error("Haide contacts require HTTPS");
        try {
          const { data } = publicContact.parse(await getPublic(url));
          if (
            data.guesthouse.id !== item.organization_id ||
            (item.type !== "guesthouse" && data.id !== item.id)
          )
            throw new Error("Public contact identity mismatch");
          return {
            ...item,
            phone: data.guesthouse.public_phone,
            whatsapp: data.guesthouse.public_phone,
          };
        } catch {
          // A temporary API outage must not erase a previously confirmed contact.
          const old = previous.get(sourceKey(item));
          return old?.organization_id === item.organization_id
            ? {
                ...item,
                ...(old.phone !== undefined ? { phone: old.phone } : {}),
                ...(old.whatsapp !== undefined
                  ? { whatsapp: old.whatsapp }
                  : {}),
              }
            : item;
        }
      }),
    );
    result.push(...batch);
  }
  return result;
}
