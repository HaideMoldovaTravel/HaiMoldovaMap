import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultIntegrationSettings,
  domainsSchema,
  embedCode,
  frameAncestors,
  integrationSettingsSchema,
  normalizeDomain,
  originAllowed,
} from "../src/modules/integrations/settings";
import { publicButtonUrl } from "../src/modules/notifications/telegram";

test("normalizes pasted domains to bare hosts", () => {
  assert.equal(
    normalizeDomain("https://www.Exemplu.md/contact?x=1"),
    "www.exemplu.md",
  );
  assert.equal(normalizeDomain(" exemplu.md "), "exemplu.md");
  assert.equal(normalizeDomain("localhost:5500"), "localhost:5500");
  assert.equal(normalizeDomain("exemplu.md."), "exemplu.md");
  for (const bad of [
    "",
    "*.exemplu.md",
    "javascript:alert(1)",
    "exem plu.md",
    "user:pw@exemplu.md",
    "ftp://exemplu.md",
    "-bad-.md",
  ])
    assert.equal(normalizeDomain(bad), null, bad);
});

test("domain list deduplicates and rejects invalid entries", () => {
  assert.deepEqual(domainsSchema.parse(["exemplu.md", "https://exemplu.md/"]), [
    "exemplu.md",
  ]);
  assert.equal(domainsSchema.safeParse([]).success, false);
  assert.equal(domainsSchema.safeParse(["exemplu.md", "*"]).success, false);
});

test("origin check covers www twin, subdomains only when allowed", () => {
  const domains = ["exemplu.md"];
  assert.ok(originAllowed("https://exemplu.md", domains, false));
  assert.ok(originAllowed("https://www.exemplu.md", domains, false));
  assert.ok(!originAllowed("https://blog.exemplu.md", domains, false));
  assert.ok(originAllowed("https://blog.exemplu.md", domains, true));
  assert.ok(!originAllowed("https://exemplu.md.evil.com", domains, true));
  assert.ok(!originAllowed("https://notexemplu.md", domains, true));
  assert.ok(!originAllowed("https://evil.com", domains, false));
  assert.ok(originAllowed("http://localhost:5500", ["localhost:5500"], false));
  assert.ok(!originAllowed("http://localhost:6000", ["localhost:5500"], false));
});

test("frame-ancestors lists only self and authorized hosts", () => {
  assert.equal(
    frameAncestors(["exemplu.md"], false),
    "'self' exemplu.md www.exemplu.md",
  );
  assert.equal(
    frameAncestors(["www.exemplu.md"], true),
    "'self' www.exemplu.md exemplu.md *.www.exemplu.md",
  );
});

test("settings require a selection when filtering by category or region", () => {
  assert.ok(
    integrationSettingsSchema.safeParse(defaultIntegrationSettings).success,
  );
  const selected = structuredClone(defaultIntegrationSettings);
  selected.content.categoryMode = "selected";
  assert.equal(integrationSettingsSchema.safeParse(selected).success, false);
  selected.content.categoryIds = ["wine"];
  assert.ok(integrationSettingsSchema.safeParse(selected).success);
  const none = structuredClone(defaultIntegrationSettings);
  none.content.kinds = [];
  assert.equal(integrationSettingsSchema.safeParse(none).success, false);
});

test("embed code points to the public key with referrer policy", () => {
  const code = embedCode("https://haimoldova.md/", "abcDEF123_-abcdefgh", 700);
  assert.match(
    code,
    /src="https:\/\/haimoldova\.md\/embed\/abcDEF123_-abcdefgh"/,
  );
  assert.match(code, /height="700"/);
  assert.match(code, /referrerpolicy="strict-origin-when-cross-origin"/);
});

test("Telegram buttons are used only for public URLs", () => {
  assert.equal(publicButtonUrl("http://localhost:3000/admin"), null);
  assert.equal(publicButtonUrl("http://192.168.1.4/admin"), null);
  assert.equal(
    publicButtonUrl("https://haimoldova.md/admin/moderation/1"),
    "https://haimoldova.md/admin/moderation/1",
  );
});
