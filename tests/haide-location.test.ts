import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseGeocode,
  locationKey,
  locatedItem,
  isCityLocation,
} from "../src/modules/haide/location";
import type { HaideItem } from "../src/modules/haide/catalog";
const item = {
  city: "CHisinau",
  address: "",
  latitude: null,
  longitude: null,
} as HaideItem;
const feature = (name: string, value = "city", countrycode = "MD") => ({
  properties: { name, countrycode, osm_key: "place", osm_value: value },
  geometry: { coordinates: [28.83, 47.02] },
});
test("Geocoding selects the settlement, not the administrative region or a similarly named POI", () => {
  assert.deepEqual(
    chooseGeocode(
      {
        features: [
          feature("Chișinău"),
          feature("Municipiul Chișinău", "municipality"),
          feature("Chișinău", "office"),
        ],
      },
      "CHisinau",
      "",
      "city",
    ),
    [47.02, 28.83],
  );
  assert.equal(
    chooseGeocode(
      {
        features: [
          feature("Drochia"),
          { ...feature("Drochia"), geometry: { coordinates: [27, 48] } },
        ],
      },
      "Drochia",
      "",
      "city",
    ),
    null,
  );
  assert.equal(
    chooseGeocode(
      { features: [feature("Chișinău", "city", "RO")] },
      "Chișinău",
      "",
      "city",
    ),
    null,
  );
});
test("Manual pin has priority even after source address or coordinates change", () => {
  const location = {
    latitude: 47.1,
    longitude: 28.9,
    precision: "manual" as const,
    query_key: locationKey(item),
  };
  assert.equal(
    locatedItem(
      { ...item, city: "Drochia", latitude: 48, longitude: 27 },
      location,
    ).latitude,
    47.1,
  );
  assert.equal(isCityLocation(item, location), false);
});
test("Cached city pin is invalidated by an address change and never overrides source coordinates", () => {
  const location = {
    latitude: 47.02,
    longitude: 28.83,
    precision: "city" as const,
    query_key: locationKey(item),
  };
  assert.equal(locatedItem(item, location).latitude, 47.02);
  assert.equal(isCityLocation(item, location), true);
  assert.equal(
    locatedItem({ ...item, address: "new address" }, location).latitude,
    null,
  );
  assert.equal(
    locatedItem({ ...item, latitude: 48, longitude: 27 }, location).latitude,
    48,
  );
  assert.equal(
    isCityLocation({ ...item, latitude: 48, longitude: 27 }, location),
    false,
  );
});
test("A street-only result never enables exact routing; exact address needs a unique house match", () => {
  const result = {
    properties: {
      street: "Strada Test",
      housenumber: "12",
      city: "Chișinău",
      countrycode: "MD",
    },
    geometry: { coordinates: [28.83, 47.02] },
  };
  assert.deepEqual(
    chooseGeocode(
      { features: [result] },
      "Chisinau",
      "Strada Test 12",
      "address",
    ),
    [47.02, 28.83],
  );
  assert.equal(
    chooseGeocode(
      { features: [result] },
      "Chisinau",
      "Strada Test 13",
      "address",
    ),
    null,
  );
});

test("Organization locality inheritance never guesses between different cities", async () => {
  const { withOrganizationCities } =
    await import("../src/modules/haide/location");
  const records = [
    { ...item, organization_id: "1", city: "" },
    { ...item, organization_id: "1", city: "Orhei" },
  ];
  assert.equal(withOrganizationCities(records)[0].city, "Orhei");
  assert.equal(
    withOrganizationCities([
      ...records,
      { ...item, organization_id: "1", city: "Drochia" },
    ])[0].city,
    "",
  );
});

test("Duplicate OSM representations within one town are one locality", () => {
  const a = feature("Orhei");
  const b = { ...feature("Orhei"), geometry: { coordinates: [28.84, 47.03] } };
  assert.deepEqual(
    chooseGeocode({ features: [a, b] }, "Orhei", "", "city"),
    [47.02, 28.83],
  );
});

test("City names take precedence over a namesake village; Dubăsari also matches its OSM Russian name", () => {
  assert.deepEqual(
    chooseGeocode(
      {
        features: [
          feature("Rezina", "town"),
          {
            ...feature("Rezina", "village"),
            geometry: { coordinates: [27.8, 47.2] },
          },
        ],
      },
      "Rezina",
      "",
      "city",
    ),
    [47.02, 28.83],
  );
  assert.deepEqual(
    chooseGeocode({ features: [feature("Дубоссары")] }, "Dubăsari", "", "city"),
    [47.02, 28.83],
  );
});
