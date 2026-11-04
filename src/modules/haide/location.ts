import { createHash } from "node:crypto";
import type { HaideItem } from "./catalog";
export type Located = {
  latitude: number;
  longitude: number;
  precision: "manual" | "address" | "city";
  query_key: string;
};
export const normalizeLocation = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^(municipiul|mun\.?|orasul|or\.?|satul|s\.)\s+/i, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
export function locationKey(item: HaideItem) {
  return createHash("sha256")
    .update(
      `${normalizeLocation(item.address ?? "")}|${normalizeLocation(item.city)}`,
    )
    .digest("hex");
}
export function locatedItem(
  item: HaideItem,
  location?: Located | null,
): HaideItem {
  if (
    location?.precision === "manual" ||
    (location &&
      location.query_key === locationKey(item) &&
      (item.latitude === null ||
        item.longitude === null ||
        (item.latitude === 0 && item.longitude === 0)))
  )
    return {
      ...item,
      latitude: location.latitude,
      longitude: location.longitude,
    };
  return item;
}
export function isCityLocation(item: HaideItem, location?: Located | null) {
  return (
    location?.precision === "city" &&
    location.query_key === locationKey(item) &&
    (item.latitude === null ||
      item.longitude === null ||
      (item.latitude === 0 && item.longitude === 0))
  );
}

type Feature = {
  properties?: {
    countrycode?: string;
    country?: string;
    name?: string;
    city?: string;
    district?: string;
    state?: string;
    street?: string;
    housenumber?: string;
    osm_key?: string;
    osm_value?: string;
    type?: string;
  };
  geometry?: { coordinates?: number[] };
};
export function chooseGeocode(
  raw: unknown,
  city: string,
  address: string,
  precision: "city" | "address",
): [number, number] | null {
  const features = (raw as { features?: Feature[] })?.features;
  if (!Array.isArray(features)) return null;
  const cityIdentity = (name: string) => {
    const normalized = normalizeLocation(name);
    return ["дубоссары", "dubossary"].includes(normalized)
      ? "dubasari"
      : normalized;
  };
  const cityName = cityIdentity(city);
  let matches = features.filter((f) => {
    const p = f.properties,
      c = f.geometry?.coordinates;
    if (!p || !c || c.length !== 2 || !c.every(Number.isFinite)) return false;
    if (
      c[1] < 45.4 ||
      c[1] > 48.6 ||
      c[0] < 26.5 ||
      c[0] > 30.2 ||
      p.countrycode?.toUpperCase() !== "MD"
    )
      return false;
    if (precision === "city")
      return (
        p.osm_key === "place" &&
        ["city", "town", "village", "hamlet", "municipality"].includes(
          p.osm_value ?? "",
        ) &&
        cityIdentity(p.name ?? "") === cityName
      );
    // Only complete addresses with a house number can enable door-to-door routing.
    return (
      !!p.street &&
      !!p.housenumber &&
      cityIdentity(p.city ?? "") === cityName &&
      ` ${normalizeLocation(address)} `.includes(
        ` ${normalizeLocation(p.housenumber)} `,
      ) &&
      normalizeLocation(address).includes(normalizeLocation(p.street))
    );
  });
  if (precision === "city") {
    const settlements = matches.filter(
      (f) => f.properties?.osm_value !== "municipality",
    );
    if (settlements.length) matches = settlements;
    const rank: Record<string, number> = {
      city: 0,
      town: 1,
      village: 2,
      hamlet: 3,
      municipality: 4,
    };
    const best = Math.min(
      ...matches.map((f) => rank[f.properties?.osm_value ?? ""] ?? 9),
    );
    matches = matches.filter(
      (f) => rank[f.properties?.osm_value ?? ""] === best,
    );
  }
  if (precision === "city" && matches.length > 1) {
    // OSM can return a node, boundary and relation for the same settlement.
    const [lng, lat] = matches[0].geometry!.coordinates!;
    if (
      matches.every((f) => {
        const c = f.geometry!.coordinates!;
        return Math.hypot((c[0] - lng) * 76, (c[1] - lat) * 111) < 5;
      })
    )
      matches = [matches[0]];
  }
  if (matches.length !== 1) return null;
  const [lng, lat] = matches[0].geometry!.coordinates!;
  return [lat, lng];
}

// An organization with exactly one known locality can supply that locality to
// its empty records. Ambiguous organizations keep the empty value for manual review.
export function withOrganizationCities(items: HaideItem[]): HaideItem[] {
  const cities = new Map<string, Map<string, string>>();
  for (const item of items)
    if (item.city.trim()) {
      const group =
        cities.get(item.organization_id) ?? new Map<string, string>();
      group.set(normalizeLocation(item.city), item.city);
      cities.set(item.organization_id, group);
    }
  return items.map((item) => {
    const group = cities.get(item.organization_id);
    return !item.city.trim() && group?.size === 1
      ? { ...item, city: [...group.values()][0] }
      : item;
  });
}
