import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
if (
  process.env.APP_ENV === "production" ||
  process.env.MAIL_TRANSPORT !== "mailpit"
)
  throw new Error(
    "Integration tests require a local development environment with Mailpit.",
  );
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Integration tests are restricted to localhost.");
const mailpit = process.env.TEST_MAILPIT_URL ?? "http://localhost:8025";
class Client {
  cookie = "";
  async request(path: string, body?: unknown, method?: string) {
    const response = await fetch(`${base}${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: {
        Origin: base,
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(body === undefined || body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      redirect: "manual",
    });
    const cookies = response.headers.getSetCookie();
    if (cookies.length)
      this.cookie = cookies.map((v) => v.split(";")[0]).join("; ");
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: response.status, data };
  }
  async post(path: string, body: unknown) {
    return this.request(`/api/platform/${path}`, body);
  }
  async get(path: string) {
    return this.request(`/api/platform/${path}`);
  }
}
async function verifyEmail(email: string) {
  for (let i = 0; i < 25; i++) {
    const inbox = await (await fetch(`${mailpit}/api/v1/messages`)).json();
    const messages = inbox.messages ?? [];
    const message = messages.find(
      (m: { To: { Address: string }[]; Subject: string }) =>
        m.To.some((t) => t.Address === email) && m.Subject.includes("Confirmă"),
    );
    if (message) {
      const detail = await (
        await fetch(`${mailpit}/api/v1/message/${message.ID}`)
      ).json();
      const link = (detail.HTML as string)
        .match(/href="([^"]*verify-email[^"]*)"/)?.[1]
        ?.replaceAll("&amp;", "&");
      assert.ok(link, "Verification email has a usable link");
      const response = await fetch(link, { redirect: "manual" });
      assert.ok([200, 302, 303].includes(response.status));
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error("Verification email was not delivered to Mailpit.");
}
async function register(label: string) {
  const client = new Client();
  const email = `integration-${label}-${randomUUID()}@example.test`;
  const password = `Integration-${randomUUID()}`;
  const signup = await client.request("/api/auth/sign-up/email", {
    name: `Integration ${label}`,
    email,
    password,
    role: "owner",
  });
  assert.equal(signup.status, 200, JSON.stringify(signup.data));
  const denied = await client.request("/api/auth/sign-in/email", {
    email,
    password,
  });
  assert.equal(denied.status, 403, "Unverified users cannot sign in");
  await verifyEmail(email);
  const login = await client.request("/api/auth/sign-in/email", {
    email,
    password,
  });
  assert.equal(login.status, 200, JSON.stringify(login.data));
  return { client, email };
}
console.log("Testing Docker stack, authentication and email verification…");
const admin = new Client();
const login = await admin.request("/api/auth/sign-in/email", {
  email: process.env.ADMIN_EMAIL,
  password: process.env.ADMIN_PASSWORD,
});
assert.equal(login.status, 200, JSON.stringify(login.data));
const anon = new Client();
const { client: a, email: aEmail } = await register("a");
const { client: b } = await register("b");
assert.equal(
  (await a.get("session")).data.actor.role,
  "user",
  "Public signup cannot grant owner role",
);
assert.equal(
  (await a.post("invitations", { email: aEmail, role: "admin" })).status,
  403,
);
assert.equal((await anon.post("listings", {})).status, 401);
assert.equal(
  (await a.get("dashboard?scope=admin")).status,
  403,
  "Public users cannot request the administrative data scope",
);
const config = (await a.get("config")).data;
assert.equal(config.length, 6);
const template = config.find(
  (c: { id: string }) => c.id === "experience",
).template;
const values = {
  name: "Integration experience",
  description: "A verified integration test experience.",
  region: "Centru",
  village: "Chișinău",
  latitude: 47.0245,
  longitude: 28.8353,
  phone: "+37369123456",
  whatsapp: "+37369123456",
  viber: "+37369123456",
  facebook: "https://facebook.com/example",
  internal_notes: "PRIVATE-INTEGRATION-NOTE",
  price_mode: "La cerere",
};
const form = new FormData();
form.append(
  "file",
  new Blob(
    [
      new Uint8Array(
        await sharp({
          create: { width: 4, height: 4, channels: 3, background: "#17332d" },
        })
          .png()
          .toBuffer(),
      ),
    ],
    { type: "image/png" },
  ),
  "test.png",
);
const upload = await a.request("/api/platform/upload", form);
assert.equal(upload.status, 201, JSON.stringify(upload.data));
const assetId = upload.data.id;
assert.equal(
  (await anon.request(`/api/media/${assetId}`)).status,
  404,
  "Unapproved images are private",
);
const saved = await a.post("listings", {
  categoryId: "experience",
  templateId: template.id,
  values: { ...values, gallery: [assetId] },
});
assert.equal(saved.status, 201, JSON.stringify(saved.data));
const { listingId, revisionId } = saved.data;
assert.equal(
  (await b.get("dashboard")).data.items.some(
    (i: { listing: { id: string } }) => i.listing.id === listingId,
  ),
  false,
);
assert.equal(
  (await b.post(`submit/${revisionId}`, {})).status,
  404,
  "Other users cannot submit private drafts",
);
assert.equal((await a.post(`submit/${revisionId}`, {})).status, 200);
assert.equal(
  (
    await a.post("listings", {
      listingId,
      baseRevisionId: revisionId,
      categoryId: "experience",
      templateId: template.id,
      values,
    })
  ).status,
  409,
  "Submitted revisions cannot be replaced while in review",
);
assert.equal(
  (await anon.get("public")).data.some(
    (p: { id: string }) => p.id === listingId,
  ),
  false,
);
assert.equal(
  (await a.post(`moderate/${revisionId}`, { decision: "approve" })).status,
  403,
);
const decisions = await Promise.all([
  admin.post(`moderate/${revisionId}`, { decision: "approve" }),
  admin.post(`moderate/${revisionId}`, { decision: "approve" }),
]);
assert.deepEqual(
  decisions.map((r) => r.status).sort(),
  [200, 409],
  "Concurrent approvals are serialized",
);
const published = (await anon.get("public")).data.find(
  (p: { id: string }) => p.id === listingId,
);
assert.equal(published.contacts.whatsapp, values.whatsapp);
assert.equal(published.contacts.facebook, values.facebook);
assert.ok(!JSON.stringify(published).includes("PRIVATE-INTEGRATION-NOTE"));
assert.equal(published.priceMode, "La cerere");
assert.equal((await anon.request(`/api/media/${assetId}`)).status, 200);
console.log(
  "Testing schema changes, publication isolation and media withdrawal…",
);
const phoneFieldId = `extra_phone_${randomUUID().slice(0, 8)}`;
const galleryFieldId = `extra_gallery_${randomUUID().slice(0, 8)}`;
const nextFields = [
  ...template.fields,
  {
    id: phoneFieldId,
    label: "Telefon secundar",
    labelEn: "Second phone",
    type: "phone",
    group: "contacts",
    required: false,
    public: true,
    help: "",
    options: [],
  },
];
nextFields.push({
  id: galleryFieldId,
  label: "Fotografii suplimentare",
  labelEn: "Extra photos",
  type: "gallery",
  group: "media",
  required: false,
  public: true,
  help: "",
  options: [],
});
const templateResult = await admin.post("templates/experience", {
  baseTemplateId: template.id,
  fields: nextFields,
});
assert.equal(templateResult.status, 200, JSON.stringify(templateResult.data));
const nextTemplateId = templateResult.data.id;
assert.equal(
  (
    await b.post("listings", {
      categoryId: "experience",
      templateId: nextTemplateId,
      values: { ...values, [galleryFieldId]: [assetId] },
    })
  ).status,
  403,
  "Custom galleries cannot publish another user's private files",
);
const edited = await a.post("listings", {
  listingId,
  baseRevisionId: revisionId,
  categoryId: "experience",
  templateId: nextTemplateId,
  values: {
    ...values,
    name: "Updated integration experience",
    [phoneFieldId]: "+37368123456",
    [galleryFieldId]: [assetId],
    gallery: [assetId],
  },
});
assert.equal(edited.status, 201, JSON.stringify(edited.data));
assert.equal(
  (await anon.get("public")).data.find(
    (p: { id: string }) => p.id === listingId,
  ).name,
  values.name,
  "Draft changes must not affect the published revision",
);
assert.equal(
  (await a.post(`submit/${edited.data.revisionId}`, {})).status,
  200,
);
assert.equal(
  (
    await admin.post(`moderate/${edited.data.revisionId}`, {
      decision: "approve",
    })
  ).status,
  200,
);
const updated = (await anon.get("public")).data.find(
  (p: { id: string }) => p.id === listingId,
);
assert.equal(updated.name, "Updated integration experience");
assert.equal(updated.contacts[phoneFieldId], "+37368123456");
assert.deepEqual(
  updated.details.find((f: { id: string }) => f.id === galleryFieldId).value,
  [`/api/media/${assetId}`],
);
const hidden = await admin.post("templates/experience", {
  baseTemplateId: nextTemplateId,
  fields: nextFields.map((f) =>
    f.id === phoneFieldId ? { ...f, public: false } : f,
  ),
});
assert.equal(hidden.status, 200);
assert.equal(
  (await anon.get("public")).data.find(
    (p: { id: string }) => p.id === listingId,
  ).contacts[phoneFieldId],
  undefined,
  "Privacy restrictions also apply to already-published content",
);
const archivedTemplate = await admin.post("templates/experience", {
  baseTemplateId: hidden.data.id,
  fields: template.fields,
});
assert.equal(archivedTemplate.status, 200);
assert.equal(
  (await anon.get("public")).data.find(
    (p: { id: string }) => p.id === listingId,
  ).contacts[phoneFieldId],
  undefined,
  "Archiving a private field must not expose historical values",
);
assert.equal(
  (
    await admin.post("templates/experience", {
      baseTemplateId: archivedTemplate.data.id,
      fields: nextFields,
    })
  ).status,
  400,
  "A private field cannot be reintroduced as public after archiving",
);
assert.equal((await admin.post(`suspend/${listingId}`, {})).status, 200);
assert.equal(
  (await anon.get("public")).data.some(
    (p: { id: string }) => p.id === listingId,
  ),
  false,
);
assert.equal(
  (await anon.request(`/api/media/${assetId}`)).status,
  404,
  "Withdrawal removes anonymous image access immediately",
);
console.log(
  "Testing dashboard routes, category icons and recoverable archives…",
);
assert.equal((await a.get("admin")).status, 403);
const adminData = (await admin.get("admin")).data;
assert.ok(!JSON.stringify(adminData).includes("tokenHash"));
for (const path of [
  "/admin",
  "/admin/categories/add",
  "/admin/team",
  "/admin/team/invite",
  "/admin/forms/winery",
  "/admin/locations",
  "/admin/experiences",
  "/admin/media",
  "/admin/users",
  "/admin/settings",
]) {
  assert.equal((await admin.request(path)).status, 200, path);
}
const services = await admin.get("admin-status");
assert.equal(services.status, 200);
assert.equal(services.data.database, true);
assert.equal(services.data.storage, true);
assert.equal(
  (await a.request("/api/platform/upload?purpose=category-icon", form)).status,
  403,
);
const icon = await admin.request(
  "/api/platform/upload?purpose=category-icon",
  form,
);
assert.equal(icon.status, 201);
const winery = adminData.config.find((c: { id: string }) => c.id === "winery");
const originalCategory = {
  id: winery.id,
  name: winery.name,
  nameEn: winery.nameEn,
  color: winery.color,
  kind: winery.kind,
  active: winery.active,
  order: winery.order,
  description: winery.description,
  iconAssetId: winery.iconAssetId,
};
try {
  assert.equal(
    (await admin.post("categories", { ...originalCategory, create: true }))
      .status,
    409,
  );
  assert.equal(
    (
      await admin.post("categories", {
        ...originalCategory,
        iconAssetId: icon.data.id,
      })
    ).status,
    200,
  );
  assert.equal((await anon.request(`/api/media/${icon.data.id}`)).status, 200);
  assert.equal(
    (await admin.post(`media-archive/${icon.data.id}`, {})).status,
    409,
  );
  assert.equal(
    (
      await admin.post("categories", {
        ...originalCategory,
        iconAssetId: icon.data.id,
        active: false,
      })
    ).status,
    200,
  );
  assert.equal((await anon.request(`/api/media/${icon.data.id}`)).status, 404);
} finally {
  assert.equal((await admin.post("categories", originalCategory)).status, 200);
}
assert.equal(
  (
    await admin.post(`media-update/${icon.data.id}`, {
      filename: "Test icon",
      altText: "Test alternative text",
    })
  ).status,
  200,
);
assert.equal(
  (await admin.post(`media-archive/${icon.data.id}`, {})).status,
  200,
);
assert.equal((await admin.request(`/api/media/${icon.data.id}`)).status, 404);
assert.equal(
  (await admin.post(`media-restore/${icon.data.id}`, {})).status,
  200,
);
assert.equal((await admin.request(`/api/media/${icon.data.id}`)).status, 200);
assert.equal(
  (await admin.post(`media-archive/${assetId}`, {})).status,
  409,
  "Historical references protect media",
);
assert.equal(
  (await admin.post(`archive-listing/${listingId}`, {})).status,
  200,
);
assert.equal(
  (await anon.get("public")).data.some(
    (p: { id: string }) => p.id === listingId,
  ),
  false,
);
assert.equal(
  (await admin.post(`restore-listing/${listingId}`, {})).status,
  200,
);
assert.equal(
  (await anon.get("public")).data.some(
    (p: { id: string }) => p.id === listingId,
  ),
  true,
);
assert.equal((await admin.post(`suspend/${listingId}`, {})).status, 200);
assert.equal(
  (await admin.post("invitations", { email: aEmail, role: "moderator" }))
    .status,
  200,
);
const toCancel = (await admin.get("admin")).data.invitations.find(
  (i: { email: string; revokedAt: string | null }) =>
    i.email === aEmail && !i.revokedAt,
);
assert.equal(
  (await admin.post(`invitation-cancel/${toCancel.id}`, {})).status,
  200,
);
assert.equal(
  (await admin.post(`invitation-resend/${toCancel.id}`, {})).status,
  409,
);

console.log("Testing administrator invitations and access revocation…");
assert.equal(
  (await admin.post("invitations", { email: aEmail, role: "admin" })).status,
  200,
);
let inviteToken = "";
for (let attempt = 0; attempt < 20; attempt++) {
  const inbox = await (await fetch(`${mailpit}/api/v1/messages`)).json();
  const message = inbox.messages.find(
    (m: { To: { Address: string }[]; Subject: string }) =>
      m.To.some((t) => t.Address === aEmail) && m.Subject.includes("Invitație"),
  );
  if (message) {
    const detail = await (
      await fetch(`${mailpit}/api/v1/message/${message.ID}`)
    ).json();
    inviteToken = detail.HTML.match(/\/invitatie\/([a-f0-9]{64})/)?.[1] ?? "";
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 700));
}
assert.ok(inviteToken, "Invitation email was delivered");
const invitation = (await admin.get("admin")).data.invitations.find(
  (i: { email: string; revokedAt: string | null }) =>
    i.email === aEmail && !i.revokedAt,
);
assert.equal(
  (await admin.post(`invitation-resend/${invitation.id}`, {})).status,
  200,
);
assert.equal(
  (await a.post(`accept-invite/${inviteToken}`, {})).status,
  400,
  "Resending invalidates the old invitation token",
);
const previousToken = inviteToken;
for (let attempt = 0; attempt < 25; attempt++) {
  const inbox = await (await fetch(`${mailpit}/api/v1/messages`)).json();
  for (const message of inbox.messages.filter(
    (m: { To: { Address: string }[]; Subject: string }) =>
      m.To.some((t) => t.Address === aEmail) && m.Subject.includes("Invitație"),
  )) {
    const detail = await (
      await fetch(`${mailpit}/api/v1/message/${message.ID}`)
    ).json();
    const token = detail.HTML.match(/\/invitatie\/([a-f0-9]{64})/)?.[1];
    if (token && token !== previousToken) {
      // Cancelled invitations also arrive by email; only the current token can be accepted.
      const accepted = await a.post(`accept-invite/${token}`, {});
      if (accepted.status === 200) {
        inviteToken = token;
        break;
      }
    }
  }
  if (inviteToken !== previousToken) break;
  await new Promise((resolve) => setTimeout(resolve, 700));
}
assert.notEqual(
  inviteToken,
  previousToken,
  "Replacement invitation delivered and accepted",
);
assert.equal(
  (await b.post(`accept-invite/${inviteToken}`, {})).status,
  400,
  "An invitation is bound to the exact verified email",
);
assert.equal((await a.get("session")).data.actor.role, "admin");
assert.equal((await a.get("session")).data.actor.role, "admin");
assert.equal((await a.post("admin-health", {})).status, 200);
const myActor = (await a.get("session")).data.actor;
assert.ok(
  (await a.get("dashboard")).data.items.every(
    (item: { listing: { ownerId: string } }) =>
      item.listing.ownerId === myActor.id,
  ),
  "The personal account remains scoped to own content for administrators",
);
assert.ok(
  (await a.get("dashboard?scope=admin")).data.items.some(
    (item: { listing: { demo: boolean } }) => item.listing.demo,
  ),
  "The administration screen has the separate administrative scope",
);
assert.equal(
  (await a.post(`accept-invite/${inviteToken}`, {})).status,
  400,
  "Invitation tokens are single-use",
);
const invitedId = (await a.get("session")).data.actor.id;
assert.equal((await admin.post(`revoke/${invitedId}`, {})).status, 200);
assert.equal(
  (await a.get("dashboard")).status,
  401,
  "Revocation immediately invalidates active sessions",
);
console.log(
  "Integration checks passed: verified signup, permission boundaries, MinIO media, dynamic fields, moderation, concurrency and publication isolation.",
);
