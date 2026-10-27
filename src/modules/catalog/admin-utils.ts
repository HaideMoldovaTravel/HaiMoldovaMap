import type { AdminData } from "@/components/admin/types";
export function latestItems(data: Pick<AdminData, "items">) {
  return [
    ...new Map(
      [...data.items].reverse().map((item) => [item.listing.id, item]),
    ).values(),
  ].reverse();
}
