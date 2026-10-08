import { test } from "node:test";
import assert from "node:assert/strict";
import { messages } from "../src/features/i18n/messages";
import { translate } from "../src/features/i18n/translate";
import { places, filterPlaces } from "../src/features/places/data";
import { localizePlace } from "../src/features/places/localization";
import { mockContacts } from "../src/features/places/contacts";
import { maneuverLabel, formatDuration } from "../src/features/map/client";
test("Every interface message has both English and Russian translations", () => {
  for (const [key, value] of Object.entries(messages)) {
    assert.ok(value.en.trim(), `${key}: EN missing`);
    assert.ok(value.ru.trim(), `${key}: RU missing`);
    assert.ok(!value.en.includes("undefined"));
    assert.ok(!value.ru.includes("undefined"));
  }
});
test("Interpolation, Romanian fallback, and existing translated errors work", () => {
  assert.equal(
    translate("De la {{price}} MDL", "en", { price: 450 }),
    "From 450 MDL",
  );
  assert.equal(
    translate("De la {{price}} MDL", "ru", { price: 450 }),
    "От 450 MDL",
  );
  assert.equal(
    translate("From {{price}} MDL", "ro", { price: 450 }),
    "De la 450 MDL",
  );
  assert.equal(translate("Unknown brand", "en"), "Unknown brand");
});
test("All places have translated descriptions without changing filter values or coordinates", () => {
  for (const locale of ["en", "ru"] as const) {
    for (const place of places) {
      const localized = localizePlace(place, locale);
      assert.notEqual(localized.description, place.description);
      assert.equal(localized.region, place.region);
      assert.deepEqual(localized.coordinates, place.coordinates);
      assert.equal(localized.id, place.id);
    }
    assert.equal(
      filterPlaces(
        places.map((p) => localizePlace(p, locale)),
        {
          query: "",
          category: "winery",
          region: "Sud",
          minRating: 4.8,
          maxPrice: 2000,
          savedOnly: false,
        },
        [],
      ).length,
      1,
    );
  }
});
test("Demo contact details exist for every place", () => {
  for (const place of places) {
    assert.ok(mockContacts[place.id].website.endsWith(".example"));
    assert.ok(mockContacts[place.id].email.endsWith(".example"));
    assert.ok(mockContacts[place.id].phone);
    assert.equal(mockContacts[place.id].demo, true);
  }
});
test("Route instructions and duration localize into Russian and English", () => {
  assert.equal(
    maneuverLabel(
      { name: "M2", maneuver: { type: "turn", modifier: "left" } },
      "en",
    ),
    "Turn left onto M2",
  );
  assert.equal(
    maneuverLabel(
      { name: "M2", maneuver: { type: "turn", modifier: "left" } },
      "ru",
    ),
    "Поверните налево на M2",
  );
  assert.equal(formatDuration(1078.4, "ru"), "18 мин");
});
