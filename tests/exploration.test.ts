import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlaces, places } from "../src/features/places/data";
import {
  initialExperienceFilters,
  isTourAgency,
  matchesExperienceFilters,
  matchesExploreGroup,
} from "../src/features/places/exploration";

test("Experience filters combine the booking mode, any selected subcategory and guest bounds", () => {
  const kayak = places.find((place) => place.id === "kayak")!;
  const filters = {
    ...initialExperienceFilters,
    bookingMode: "group" as const,
    subcategories: ["food-wine", "on-the-water"] as const,
    guests: 3,
  };
  const matches = (place = kayak, guests = filters.guests) =>
    matchesExperienceFilters(place, {
      ...filters,
      subcategories: [...filters.subcategories],
      guests,
    });
  assert.equal(matches(), true);
  assert.equal(matches(kayak, 11), false);
  assert.equal(matches({ ...kayak, minPeople: 4 }), false);
  assert.equal(matches({ ...kayak, minPeople: undefined }), false);
  assert.equal(matches({ ...kayak, bookingMode: "private" }), false);
  assert.equal(matches({ ...kayak, category: "stay" }), false);
});

test("Price ranges work above 2000 MDL and skip unknown and foreign currency prices", () => {
  const base = { ...places[0], demo: false, price: 2500, priceMode: "Fix" };
  const items = [
    base,
    { ...base, id: "unknown", priceMode: "La cerere" },
    { ...base, id: "eur", currency: "EUR" },
    { ...base, id: "cheap", price: 500 },
  ];
  const filters = {
    query: "",
    category: "all",
    region: "all",
    minRating: 0,
    savedOnly: false,
    maxPrice: 3000,
    minPrice: 2000,
  };
  assert.deepEqual(
    filterPlaces(items, filters, []).map((p) => p.id),
    [base.id],
  );
  assert.equal(
    filterPlaces(items, { ...filters, minPrice: 0, maxPrice: Infinity }, [])
      .length,
    4,
  );
});

test("Imported hotels and resorts join stays; wineries remain experiences", () => {
  for (const category of ["stay", "hotels", "resorts"]) {
    assert.equal(matchesExploreGroup({ category }, "stay"), true);
    assert.equal(matchesExploreGroup({ category }, "experience"), false);
  }
  assert.equal(matchesExploreGroup({ category: "winery" }, "experience"), true);
  assert.equal(
    matchesExploreGroup(
      { category: "custom", categoryLabel: "Pensiuni" },
      "stay",
    ),
    true,
  );
});

test("Tour operators are excluded from every public exploration group", () => {
  for (const place of [
    { category: "tour-operators" },
    { category: "custom", categoryLabel: "Agenții de turism" },
  ]) {
    assert.equal(isTourAgency(place), true);
    for (const group of ["all", "experience", "stay"] as const)
      assert.equal(matchesExploreGroup(place, group), false);
  }
});

test("Landmarks, restaurants and shops are excluded unless explicitly published as experiences", () => {
  for (const category of [
    "monuments",
    "museums",
    "food",
    "cafes",
    "shopping",
    "nature",
    "culture",
    "bars",
  ])
    assert.equal(
      matchesExploreGroup({ category, kind: "location" }, "all"),
      false,
    );
  assert.equal(
    matchesExploreGroup(
      { category: "custom", kind: "experience" },
      "experience",
    ),
    true,
  );
});
