import { test } from "node:test";
import assert from "node:assert/strict";
import { withPublicHaideContacts } from "../src/modules/haide/contacts";
import type { HaideItem } from "../src/modules/haide/catalog";
const item: HaideItem = {
  type: "experience",
  id: "1",
  organization_id: "7",
  name: "Atelier",
  name_en: "Workshop",
  description: "",
  description_en: "",
  city: "Orhei",
  latitude: 47.3,
  longitude: 28.8,
  images: [],
  price: 100,
  currency: "MDL",
  bookable: true,
  url: "https://haide.md/ro/experiences/atelier",
};
const api = "https://api.haide.md/api/";
const detail = (phone: string | null, id = 7) => ({
  data: {
    id: 1,
    phone: "private-number",
    guesthouse: { id, public_phone: phone, phone: "private-number" },
  },
});
test("Legacy Haide exports gain only the public host contact from the correct public route", async () => {
  const [result] = await withPublicHaideContacts(
    [item],
    api,
    new Map(),
    async (url) => {
      assert.equal(
        url.href,
        "https://api.haide.md/api/v1/public/experiences/1",
      );
      return detail("+37369123456");
    },
  );
  assert.equal(result.phone, "+37369123456");
  assert.equal(result.whatsapp, "+37369123456");
});
test("Explicit source contacts and removals do not call the compatibility endpoint", async () => {
  const source = { ...item, phone: null, whatsapp: null };
  const [result] = await withPublicHaideContacts(
    [source],
    api,
    new Map(),
    async () => {
      throw new Error("Must not call");
    },
  );
  assert.deepEqual(result, source);
});
test("An outage preserves known contacts, while an explicit public removal clears them", async () => {
  const previous = new Map([
    [
      "experience:1",
      { ...item, phone: "+37369123456", whatsapp: "+37369123456" },
    ],
  ]);
  const [kept] = await withPublicHaideContacts(
    [item],
    api,
    previous,
    async () => {
      throw new Error("Offline");
    },
  );
  assert.equal(kept.whatsapp, "+37369123456");
  const [removed] = await withPublicHaideContacts(
    [item],
    api,
    previous,
    async () => detail(null),
  );
  assert.equal(removed.whatsapp, null);
});
test("Mismatched organizations and private-only contacts cannot create a WhatsApp link", async () => {
  for (const response of [
    detail("+37369123456", 8),
    { data: { id: 1, guesthouse: { id: 7, phone: "+37369123456" } } },
  ]) {
    const [result] = await withPublicHaideContacts(
      [item],
      api,
      new Map(),
      async () => response,
    );
    assert.equal(result.whatsapp, undefined);
  }
});
