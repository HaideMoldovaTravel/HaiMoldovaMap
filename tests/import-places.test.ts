import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCoordinates,
  parseCsv,
  parseEmails,
  parseLinks,
  parsePhones,
} from "../scripts/import-places";

test("parses decimal and DMS coordinates, rejects places outside Moldova", () => {
  assert.deepEqual(
    parseCoordinates("47.03067318815532, 28.84927128688886"),
    [47.03067318815532, 28.84927128688886],
  );
  assert.deepEqual(
    parseCoordinates("47.0298°N 28.8254°E\n"),
    [47.0298, 28.8254],
  );
  const [lat, lng] = parseCoordinates("47°1′9.5″N 28°49′20″E")!;
  assert.ok(Math.abs(lat - 47.01931) < 1e-4 && Math.abs(lng - 28.82222) < 1e-4);
  assert.equal(parseCoordinates(""), null);
  assert.equal(parseCoordinates("40.1, 20.2"), null);
});

test("normalizes the phone formats used in the survey", () => {
  assert.deepEqual(parsePhones("(+373) 69103182"), ["+373 69103182"]);
  assert.deepEqual(parsePhones("373 (69) 154-999, coliba@mail.ru"), [
    "+373 69154999",
  ]);
  assert.deepEqual(parsePhones("(373) 60069707"), ["+373 60069707"]);
  assert.deepEqual(parsePhones("(+373) 22 274 606 , (+373) 69 108 848"), [
    "+373 22274606",
    "+373 69108848",
  ]);
  assert.deepEqual(parsePhones("(+380) 637700867"), ["+380637700867"]);
  assert.deepEqual(parsePhones("mdyardsale@gmail.com"), []);
  assert.deepEqual(parseEmails("info@portmall.md, (+373)78889966"), [
    "info@portmall.md",
  ]);
});

test("splits website and social links and unwraps Google redirects", () => {
  assert.deepEqual(
    parseLinks(
      "https://www.instagram.com/cafe_baba_neagra/, https://babaneagra.md/",
    ),
    {
      instagram: "https://www.instagram.com/cafe_baba_neagra/",
      website: "https://babaneagra.md/",
    },
  );
  assert.deepEqual(parseLinks("https://www.facebook.com/skyland.md/,"), {
    facebook: "https://www.facebook.com/skyland.md/",
  });
  assert.equal(
    parseLinks("google.com/url?url=https%3A%2F%2Fall.accor.com%2Fhotel")
      .website,
    "https://all.accor.com/hotel",
  );
});

test("CSV parser keeps quoted commas and newlines", () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","line\nbreak"\n'), [
    ["a", "b"],
    ["x, y", "line\nbreak"],
  ]);
});
