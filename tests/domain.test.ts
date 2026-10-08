import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPlaces, places } from "../src/features/places/data";
import { parseCoordinates } from "../src/features/map/validation";
import {
  formatDistance,
  formatDuration,
  maneuverLabel,
} from "../src/features/map/client";
import type { PlaceFilters } from "../src/features/places/types";
const filters: PlaceFilters = {
  query: "",
  category: "all",
  region: "all",
  minRating: 0,
  maxPrice: 2000,
  savedOnly: false,
};
test("Search finds Romanian place names without diacritics", () => {
  assert.equal(
    filterPlaces(places, { ...filters, query: "chisinau" }, []).length,
    2,
  );
  assert.equal(
    filterPlaces(places, { ...filters, query: "  Milestii Mici " }, [])[0]?.id,
    "milesti",
  );
});
test("Category, region, rating and budget filters combine", () => {
  assert.deepEqual(
    filterPlaces(
      places,
      {
        ...filters,
        category: "winery",
        region: "Centru",
        minRating: 4.8,
        maxPrice: 400,
      },
      [],
    ).map((p) => p.id),
    ["asconi"],
  );
});
test("Free locations stay available when budget is zero", () => {
  assert.deepEqual(
    filterPlaces(places, { ...filters, maxPrice: 0 }, []).map((p) => p.id),
    ["orhei", "saharna"],
  );
});
test("Saved-only view respects the saved collection", () => {
  assert.deepEqual(
    filterPlaces(places, { ...filters, savedOnly: true }, [
      "purcari",
      "codru",
    ]).map((p) => p.id),
    ["purcari", "codru"],
  );
  assert.equal(
    filterPlaces(places, { ...filters, savedOnly: true }, []).length,
    0,
  );
});
test("Route coordinates reject malformed and out-of-range inputs", () => {
  for (const value of [
    null,
    "",
    "91,28",
    "47,181",
    "NaN,28",
    "47,28,2",
    "47;28",
    "47,28?foo=bar",
  ])
    assert.equal(parseCoordinates(value), null);
  assert.deepEqual(parseCoordinates("47.0245,28.8353"), [47.0245, 28.8353]);
});
test("Route presentation handles distances, durations and roundabout exits", () => {
  assert.equal(formatDistance(14555.4), "14.6 km");
  assert.equal(formatDuration(1078.4), "18 min");
  assert.equal(formatDuration(7200), "2 h 0 min");
  assert.equal(
    maneuverLabel({ name: "M2", maneuver: { type: "roundabout", exit: 2 } }),
    "La sensul giratoriu, ia ieșirea 2 spre M2",
  );
  assert.equal(
    maneuverLabel({ name: "M2", maneuver: { type: "exit roundabout" } }),
    "Ieși din sensul giratoriu pe M2",
  );
});
