import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchHaideSnapshot,
  haideItemSchema,
  haidePlace,
  importIssue,
  type HaideItem,
} from "../src/modules/haide/catalog";
const item: HaideItem = {
  type: "experience",
  id: "1",
  organization_id: "7",
  name: "Atelier",
  name_en: "Workshop",
  description: "Public",
  description_en: "Public",
  city: "Orhei",
  latitude: 47.38,
  longitude: 28.82,
  images: [],
  price: 150,
  currency: "MDL",
  bookable: true,
  url: "https://haide.md/ro/experiences/atelier",
};
const snapshot = "f5c2d43c-44c1-44a8-80ee-ec27b9daea4c";
const page = (items: HaideItem[], extra: object = {}) => ({
  version: 1,
  snapshot,
  page: 1,
  pages: 1,
  total: items.length,
  items,
  ...extra,
});

test("Haide mirrors are real, have stable distinct IDs and use booking links without phone actions", () => {
  const place = haidePlace(item, "experience")!;
  assert.equal(place.demo, false);
  assert.equal(place.contactFields?.[0].id, "booking_url");
  assert.equal(place.contacts?.phone, undefined);
  assert.notEqual(
    place.id,
    haidePlace({ ...item, type: "guesthouse" }, "culture")!.id,
  );
  assert.equal(
    haidePlace({ ...item, bookable: false }, "experience")?.contactFields?.[0]
      .id,
    "haide_url",
  );
});
test("Missing coordinates never create a marker at zero or use fabricated coordinates", () => {
  assert.equal(haidePlace({ ...item, latitude: null }, "experience"), null);
  assert.ok(importIssue({ ...item, latitude: 0, longitude: 0 }));
  assert.equal(
    haidePlace({ ...item, price: null }, "experience")?.priceMode,
    "La cerere",
  );
});
test("Frozen pagination validates completeness, identity and page sequence", async () => {
  const urls: URL[] = [];
  const result = await fetchHaideSnapshot(
    "https://api.haide.md/api/",
    "s".repeat(40),
    "https://haide.md",
    async (url) => {
      urls.push(url);
      return urls.length === 1
        ? page([item], { pages: 2, total: 2 })
        : page([{ ...item, id: "2" }], { page: 2, pages: 2, total: 2 });
    },
  );
  assert.equal(result.length, 2);
  assert.equal(urls[0].pathname, "/api/integrations/map/catalog");
  assert.equal(urls[1].searchParams.get("snapshot"), snapshot);
  for (const invalid of [
    page([item], { total: 2 }),
    page([item, item]),
    page([item], { page: 2 }),
  ])
    await assert.rejects(
      fetchHaideSnapshot(
        "https://api.haide.md/api",
        "s".repeat(40),
        "https://haide.md",
        async () => invalid,
      ),
    );
});
test("Changed snapshots and unavailable pages reject the whole import", async () => {
  let calls = 0;
  await assert.rejects(
    fetchHaideSnapshot(
      "https://api.haide.md/api",
      "s".repeat(40),
      "https://haide.md",
      async () =>
        ++calls === 1
          ? page([item], { pages: 2, total: 2 })
          : page([{ ...item, id: "2" }], {
              page: 2,
              pages: 2,
              total: 2,
              snapshot: "14e58f13-b33c-4f71-a48e-3fbd23e9cd3f",
            }),
    ),
  );
  await assert.rejects(
    fetchHaideSnapshot(
      "https://api.haide.md/api",
      "s".repeat(40),
      "https://haide.md",
      async () => {
        throw new Error("offline");
      },
    ),
  );
});
test("Only safe URLs and expected Haide origin can enter the local mirror", async () => {
  assert.equal(
    haideItemSchema.safeParse({ ...item, images: ["javascript:alert(1)"] })
      .success,
    false,
  );
  await assert.rejects(
    fetchHaideSnapshot(
      "https://api.haide.md/api",
      "s".repeat(40),
      "https://haide.md",
      async () => page([{ ...item, url: "https://evil.example/" }]),
    ),
  );
  await assert.rejects(
    fetchHaideSnapshot(
      "http://api.haide.md/api",
      "s".repeat(40),
      "https://haide.md",
      async () => page([item]),
    ),
  );
});
test("A genuinely empty complete snapshot is valid", async () => {
  assert.deepEqual(
    await fetchHaideSnapshot(
      "https://api.haide.md/api",
      "s".repeat(40),
      "https://haide.md",
      async () => page([]),
    ),
    [],
  );
});
