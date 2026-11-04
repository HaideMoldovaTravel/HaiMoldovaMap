import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  vtbAssetId,
  vtbDecisionsSchema,
  vtbDuplicate,
  vtbPhones,
  vtbSnapshotSchema,
  vtbValues,
  type VtbRecord,
} from "../src/modules/vtb/catalog";
import { initialFields } from "../src/modules/catalog/templates";
import { validateValues } from "../src/modules/catalog/schema";
import { contactHref } from "../src/features/places/presentation";

const snapshot = vtbSnapshotSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../data/vtb/2026-10-30/catalog.json", import.meta.url),
      "utf8",
    ),
  ),
);
const record = (id: string): VtbRecord =>
  structuredClone(snapshot.records.find((r) => r.id === id)!);

test("VTB inventory keeps distinct identities and map-only scope", () => {
  assert.equal(snapshot.records.length, snapshot.discovered);
  assert.throws(() =>
    vtbSnapshotSchema.parse({ ...snapshot, complete: false }),
  );
  const altered = record("vtb-188");
  altered.source_url = "https://www.implicareplus.org/vtb/location/999/";
  assert.throws(() =>
    vtbSnapshotSchema.parse({ ...snapshot, discovered: 1, records: [altered] }),
  );
  assert.throws(() =>
    vtbDecisionsSchema.parse({
      snapshot_sha256: "a".repeat(64),
      publication_scope: "haide",
      sync_to_haide: true,
      decisions: [],
    }),
  );
});

test("booking phones are taken from reservation instructions when source contact has a typo", () => {
  assert.deepEqual(vtbPhones("+373679134013"), []);
  const values = vtbValues(record("vtb-127"), "experience");
  assert.equal(values.phone, "+37367913401");
  assert.equal(values.whatsapp, values.phone);
  assert.equal(contactHref("phone", String(values.phone)), "tel:+37367913401");
  assert.equal(
    contactHref("phone", String(values.whatsapp), "whatsapp"),
    "https://wa.me/37367913401",
  );
  assert.ok(!("booking_url" in values));
  assert.ok(!("haide_url" in values));
});

test("normalizes known phone formats without inventing a malformed number", () => {
  assert.deepEqual(vtbPhones("+ 37368984448"), ["+37368984448"]);
  assert.deepEqual(vtbPhones("+373069692953"), ["+37369692953"]);
  assert.deepEqual(vtbPhones("067820644"), ["+37367820644"]);
  assert.deepEqual(vtbPhones("‪+447795334474‬"), ["+447795334474"]);
  assert.deepEqual(vtbPhones("6265538277"), []);
});

test("all selected experiences have direct contacts and pass the existing form validation", () => {
  for (const source of snapshot.records.filter(
    (r) => r.recommendation.bucket === "experience",
  )) {
    const values = vtbValues(source, "experience");
    assert.ok(values.phone, source.name);
    assert.ok(values.whatsapp, source.name);
    assert.equal(values.price_mode, "La cerere");
    assert.ok(!("duration" in values));
    assert.ok(!("price" in values));
    assert.ok(!("haide_url" in values));
    validateValues(initialFields("experience"), values, true);
  }
});

test("missing coordinates and reservation contacts block publication", () => {
  assert.throws(() => vtbValues(record("vtb-214"), "location"), /Coordonate/);
  const source = record("vtb-188");
  source.contact_text = "";
  source.fields["Sfat / Logistic"] = "";
  assert.throws(() => vtbValues(source, "experience"), /telefon/);
});

test("known contradictory source prices and seasons stay out of published descriptions", () => {
  const lavender = record("vtb-156");
  assert.match(lavender.fields["Meniu/ Servicii"], /80/);
  assert.doesNotMatch(
    String(vtbValues(lavender, "location").description),
    /80 lei|peșteră/,
  );
  const garden = vtbValues(record("vtb-136"), "location");
  assert.match(String(garden.description), /programul se confirmă telefonic/);
  assert.doesNotMatch(String(garden.description), /mai–septembrie|mai-iunie/);
});

test("exact nearby duplicates are detected without conflating experience and location", () => {
  const source = record("vtb-188");
  const candidate = {
    id: "existing",
    name: source.name,
    kind: "experience",
    latitude: source.coordinates!.latitude,
    longitude: source.coordinates!.longitude,
    village: source.locality,
  };
  assert.equal(vtbDuplicate(source, "experience", [candidate])?.id, "existing");
  assert.equal(vtbDuplicate(source, "location", [candidate]), undefined);
  assert.equal(
    vtbDuplicate(source, "experience", [{ ...candidate, latitude: 48 }]),
    undefined,
  );
});

test("asset identifiers are repeatable valid UUIDs for safe reruns", () => {
  const id = vtbAssetId("a".repeat(64));
  assert.equal(id, vtbAssetId("a".repeat(64)));
  assert.match(
    id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.notEqual(id, vtbAssetId("b".repeat(64)));
});
