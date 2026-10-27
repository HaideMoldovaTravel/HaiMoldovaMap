import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initialCategories,
  initialFields,
} from "../src/modules/catalog/templates";
import {
  assertCompatibleFields,
  fieldsSchema,
  publicValues,
  validateValues,
} from "../src/modules/catalog/schema";
import {
  contactHref,
  formatPlacePrice,
} from "../src/features/places/presentation";
import { places } from "../src/features/places/data";
const complete = {
  name: "Atelier",
  description: "Descriere",
  village: "Chișinău",
  region: "Centru",
  latitude: 47.0245,
  longitude: 28.8353,
};
test("All existing categories have valid templates with messaging and social channels", () => {
  assert.equal(initialCategories.length, 6);
  for (const category of initialCategories) {
    const fields = fieldsSchema.parse(initialFields(category.id));
    assert.ok(!fields.some((f) => f.id === "viber"));
    for (const id of [
      "phone",
      "whatsapp",
      "facebook",
      "instagram",
      "tiktok",
      "youtube",
      "telegram",
      "booking_url",
    ])
      assert.ok(
        fields.some((f) => f.id === id),
        `${category.id}: ${id}`,
      );
  }
});
test("Drafts accept incomplete content; submission validates required values and coordinates", () => {
  const fields = initialFields("experience");
  assert.deepEqual(validateValues(fields, {}, false), {});
  assert.throws(() => validateValues(fields, {}, true), /Denumire/);
  assert.deepEqual(validateValues(fields, complete, true), complete);
  assert.throws(
    () => validateValues(fields, { ...complete, latitude: 120 }, true),
    /Latitudine/,
  );
});
test("Content cannot inject ownership or public status, executable URLs or unowned asset paths", () => {
  const fields = initialFields("stay");
  assert.throws(
    () => validateValues(fields, { ...complete, role: "owner" }, true),
    /necunoscut/,
  );
  assert.throws(
    () =>
      validateValues(
        fields,
        { ...complete, website: "javascript:alert(1)" },
        true,
      ),
    /Website/,
  );
  assert.throws(
    () =>
      validateValues(
        fields,
        { ...complete, gallery: ["https://evil.example/image"] },
        true,
      ),
    /Fotografii/,
  );
});
test("Public projection omits private values rather than trusting submitted field names", () => {
  const fields = initialFields("winery");
  const validated = validateValues(
    fields,
    { ...complete, internal_notes: "Confidențial", wine_tours: false },
    true,
  );
  const result = publicValues(fields, validated);
  assert.equal(result.internal_notes, undefined);
  assert.equal(result.wine_tours, false);
});
test("Schema evolution preserves field types, core fields and privacy", () => {
  const fields = initialFields("culture");
  assert.throws(
    () =>
      assertCompatibleFields(
        fields,
        fields.map((f) => (f.id === "phone" ? { ...f, type: "number" } : f)),
      ),
    /tipului/,
  );
  assert.throws(
    () =>
      assertCompatibleFields(
        fields,
        fields.filter((f) => f.id !== "latitude"),
      ),
    /standard/,
  );
  assert.throws(
    () =>
      assertCompatibleFields(
        fields,
        fields.map((f) =>
          f.id === "internal_notes" ? { ...f, public: true } : f,
        ),
      ),
    /intern/,
  );
  assert.equal(
    assertCompatibleFields(fields, [
      ...fields,
      {
        ...fields.find((f) => f.id === "phone")!,
        id: "second_phone",
        label: "Telefon secundar",
      },
    ]).length,
    fields.length + 1,
  );
});
test("Contact links normalize phone numbers and disable Viber", () => {
  assert.equal(
    contactHref("phone", "+373 69 123 456", "whatsapp"),
    "https://wa.me/37369123456",
  );
  assert.equal(contactHref("phone", "+373 69 123 456", "viber"), undefined);
  assert.equal(
    contactHref("phone", "069 123 456", "whatsapp"),
    "https://wa.me/37369123456",
  );
  assert.equal(contactHref("phone", "00373 69 123 456"), "tel:+37369123456");
  assert.equal(contactHref("phone", "invalid"), undefined);
  assert.equal(contactHref("url", "javascript:alert(1)"), undefined);
});
test("Missing price is never presented as free for real listings", () => {
  const t = (value: string) => value;
  assert.equal(
    formatPlacePrice(
      { ...places[0], demo: false, price: 0, priceMode: "La cerere" },
      t,
    ),
    "Preț la cerere",
  );
  assert.equal(
    formatPlacePrice(
      { ...places[0], demo: false, price: 0, priceMode: "Gratuit" },
      t,
    ),
    "Acces liber",
  );
  assert.equal(
    formatPlacePrice(
      {
        ...places[0],
        demo: false,
        price: 40,
        priceMode: "Fix",
        currency: "EUR",
      },
      t,
    ),
    "40 EUR",
  );
});
