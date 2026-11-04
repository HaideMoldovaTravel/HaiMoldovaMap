import { test } from "node:test";
import assert from "node:assert/strict";
import { initialFields } from "../src/modules/catalog/templates";
import { validateValues } from "../src/modules/catalog/schema";
import {
  simpleExperienceFields,
  validateSimpleExperience,
} from "../src/modules/catalog/simple-experience";
import { catalogDecision } from "../src/modules/catalog/cleanup";
import { placeSubcategories } from "../src/features/places/exploration";
import { filterPlaces, places } from "../src/features/places/data";
import { haidePlace } from "../src/modules/haide/catalog";
import { bookingActions } from "../src/components/explore/booking-bar";
const complete = {
  name: "Atelier",
  description: "Modelăm lut",
  min_people: 1,
  max_people: 10,
  village: "Chișinău",
  latitude: 47.02,
  longitude: 28.83,
  price: 0,
  hours: "09:00–18:00",
  phone: "+37369123456",
  gallery: Array.from(
    { length: 4 },
    (_, i) => `a0000000-0000-4000-8000-00000000000${i}`,
  ),
};
test("Compact form submits the eight requested sections without hidden region or custom requirements", () => {
  const fields = simpleExperienceFields([
    ...initialFields("experience"),
    {
      id: "extra",
      label: "Admin field",
      labelEn: "",
      type: "text",
      group: "details",
      required: true,
      public: true,
      help: "",
      options: [],
    },
  ]);
  assert.doesNotThrow(() => validateValues(fields, complete, true));
  assert.doesNotThrow(() => validateSimpleExperience(complete, true));
  assert.deepEqual(validateValues(fields, {}, false), {});
  assert.doesNotThrow(() => validateSimpleExperience({}, false));
  for (const key of [
    "phone",
    "hours",
    "min_people",
    "max_people",
    "price",
    "latitude",
    "village",
  ]) {
    const partial: Record<string, unknown> = { ...complete };
    delete partial[key];
    assert.throws(() => validateValues(fields, partial, true));
  }
});
test("Compact submissions enforce participant bounds and four or five photos, including drafts", () => {
  for (const value of [0, -1, 1.5])
    assert.throws(() =>
      validateSimpleExperience({ ...complete, min_people: value }, false),
    );
  assert.throws(() =>
    validateSimpleExperience({ ...complete, min_people: 11 }, true),
  );
  assert.throws(() =>
    validateSimpleExperience(
      { ...complete, gallery: complete.gallery.slice(0, 3) },
      true,
    ),
  );
  assert.throws(() =>
    validateSimpleExperience(
      { ...complete, gallery: [...complete.gallery, ...complete.gallery] },
      false,
    ),
  );
});
test("Reviewed cleanup preserves accommodation and tasting activities, archives landmarks and corrects mixed categories", () => {
  const row = {
    id: "any",
    demo: false,
    category_id: "hotels",
    kind: "location",
  };
  assert.equal(catalogDecision(row).action, "keep");
  assert.equal(
    catalogDecision({ ...row, category_id: "monuments" }).action,
    "archive",
  );
  assert.equal(
    catalogDecision({ ...row, id: "vtb-196", category_id: "food" }).category,
    "stay",
  );
  assert.equal(
    catalogDecision({
      ...row,
      id: "import-6ce0434692b90410e09b",
      category_id: "wine-bars",
    }).category,
    "experience",
  );
  assert.equal(
    catalogDecision({ ...row, category_id: "unknown" }).action,
    "keep",
  );
});
test("Subcategory choices filter actual activities, including legacy and explicit classifications", () => {
  assert.ok(
    placeSubcategories({ ...places[0], category: "winery" }).includes(
      "food-wine",
    ),
  );
  assert.ok(
    placeSubcategories({ ...places[0], name: "Atelier de olărit" }).includes(
      "craft-traditions",
    ),
  );
  assert.deepEqual(
    placeSubcategories({ ...places[0], subcategories: ["on-the-water"] }),
    ["on-the-water"],
  );
});
test("Removing the budget control does not hide experiences priced above 2000", () => {
  assert.equal(
    filterPlaces(
      [{ ...places[0], price: 5000 }],
      {
        query: "",
        category: "all",
        region: "all",
        minRating: 0,
        maxPrice: Number.POSITIVE_INFINITY,
        savedOnly: false,
      },
      [],
    ).length,
    1,
  );
});
test("Haide public phone and WhatsApp appear alongside online booking; missing contacts are not fabricated", () => {
  const item = {
    type: "experience" as const,
    id: "1",
    organization_id: "1",
    name: "Atelier",
    name_en: "Workshop",
    description: "Olărit",
    description_en: "Pottery",
    city: "Orhei",
    latitude: 47.38,
    longitude: 28.82,
    images: [],
    price: 100,
    currency: "MDL",
    bookable: true,
    url: "https://haide.md/ro/experiences/atelier",
  };
  const place = haidePlace(
    { ...item, phone: "+37369123456", whatsapp: "+37369123456" },
    "experience",
  )!;
  const actions = bookingActions(place.contactFields!, (text) => text);
  assert.deepEqual(
    actions.map((action) => action.id),
    ["booking_url", "phone", "whatsapp"],
  );
  assert.equal(actions[2].href, "https://wa.me/37369123456");
  assert.deepEqual(
    bookingActions(
      haidePlace(item, "experience")!.contactFields!,
      (text) => text,
    ).map((a) => a.id),
    ["booking_url"],
  );
});

test("Public compact submission stays compact for owners, admins, moderators and users", async () => {
  const { listingFormMode } =
    await import("../src/modules/catalog/simple-experience");
  for (const role of ["owner", "admin", "moderator", "user"]) {
    assert.equal(listingFormMode("experience", role, "simple"), "simple");
    assert.doesNotThrow(() =>
      validateValues(
        simpleExperienceFields(initialFields("experience")),
        complete,
        true,
      ),
    );
  }
  for (const role of ["owner", "admin", "moderator"])
    assert.equal(listingFormMode("experience", role, "full"), "full");
  assert.equal(listingFormMode("experience", "user", "full"), "simple");
  assert.equal(listingFormMode("location", "owner", "simple"), "full");
});
