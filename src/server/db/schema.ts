import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
  bigint,
  geometry,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";
import type { ContentField, ContentValues } from "@/modules/catalog/schema";
import type { IntegrationSettings } from "@/modules/integrations/settings";
const time = (name: string) => timestamp(name, { withTimezone: true });
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  createdAt: time("created_at").notNull().defaultNow(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: time("access_token_expires_at"),
    refreshTokenExpiresAt: time("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: time("expires_at").notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").unique(),
  count: integer("count"),
  lastRequest: bigint("last_request", { mode: "number" }),
});
export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  nameEn: text("name_en").notNull(),
  color: text("color").notNull(),
  kind: text("kind").notNull(),
  active: boolean("active").notNull().default(true),
  order: integer("sort_order").notNull().default(0),
  description: text("description").notNull().default(""),
  iconAssetId: text("icon_asset_id").references(() => assets.id),
});
export const templates = pgTable(
  "templates",
  {
    id: text("id").primaryKey(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    version: integer("version").notNull(),
    fields: jsonb("fields").$type<ContentField[]>().notNull(),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("template_version_idx").on(t.categoryId, t.version)],
);
export const listings = pgTable(
  "listings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id),
    kind: text("kind").notNull(),
    publishedRevisionId: text("published_revision_id"),
    status: text("status").notNull().default("unpublished"),
    demo: boolean("demo").notNull().default(false),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [index("listings_owner_idx").on(t.ownerId)],
);
export const revisions = pgTable(
  "listing_revisions",
  {
    id: text("id").primaryKey(),
    listingId: text("listing_id")
      .notNull()
      .references(() => listings.id),
    authorId: text("author_id")
      .notNull()
      .references(() => user.id),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    templateId: text("template_id")
      .notNull()
      .references(() => templates.id),
    values: jsonb("values").$type<ContentValues>().notNull(),
    point: geometry("point", { type: "point", mode: "xy", srid: 4326 }),
    parentLocationId: text("parent_location_id").references(() => listings.id),
    status: text("status").notNull().default("draft"),
    feedback: text("feedback"),
    reviewedBy: text("reviewed_by").references(() => user.id),
    reviewedAt: time("reviewed_at"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("revision_listing_idx").on(t.listingId),
    index("revision_status_idx").on(t.status),
    index("revision_point_idx").using("gist", t.point),
  ],
);
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => user.id),
  key: text("object_key").notNull().unique(),
  filename: text("filename").notNull(),
  purpose: text("purpose").notNull().default("listing"),
  altText: text("alt_text").notNull().default(""),
  archivedAt: time("archived_at"),
  size: integer("size").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const invitations = pgTable("admin_invitations", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  role: text("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: text("invited_by")
    .notNull()
    .references(() => user.id),
  acceptedAt: time("accepted_at"),
  revokedAt: time("revoked_at"),
  expiresAt: time("expires_at").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const audit = pgTable("audit_log", {
  id: text("id").primaryKey(),
  actorId: text("actor_id").references(() => user.id),
  action: text("action").notNull(),
  resourceId: text("resource_id").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const mailOutbox = pgTable(
  "mail_outbox",
  {
    id: text("id").primaryKey(),
    to: text("recipient").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: time("available_at").notNull().defaultNow(),
    lockedAt: time("locked_at"),
    sentAt: time("sent_at"),
    error: text("last_error"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [index("mail_pending_idx").on(t.status, t.availableAt)],
);
export const partnerIntegrations = pgTable(
  "partner_integrations",
  {
    id: text("id").primaryKey(),
    // Public identifier in the iframe URL; rotating it breaks old snippets.
    publicKey: text("public_key").notNull().unique(),
    title: text("title").notNull(),
    partnerName: text("partner_name").notNull().default(""),
    contactEmail: text("contact_email").notNull().default(""),
    notes: text("notes").notNull().default(""),
    domains: jsonb("domains").$type<string[]>().notNull(),
    allowSubdomains: boolean("allow_subdomains").notNull().default(false),
    status: text("status").notNull().default("active"),
    settings: jsonb("settings").$type<IntegrationSettings>().notNull(),
    version: integer("version").notNull().default(1),
    createdBy: text("created_by").references(() => user.id),
    createdAt: time("created_at").notNull().defaultNow(),
    updatedAt: time("updated_at").notNull().defaultNow(),
    lastSeenAt: time("last_seen_at"),
  },
  (t) => [index("integration_status_idx").on(t.status)],
);
export const integrationStats = pgTable(
  "partner_integration_stats",
  {
    integrationId: text("integration_id")
      .notNull()
      .references(() => partnerIntegrations.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    host: text("host").notNull(),
    allowed: boolean("allowed").notNull(),
    count: integer("count").notNull().default(0),
    lastAt: time("last_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.integrationId, t.day, t.host, t.allowed] })],
);
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const notificationOutbox = pgTable(
  "notification_outbox",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull().default("telegram"),
    // "send" posts a new message; "edit" updates the message sent for refId.
    kind: text("kind").notNull().default("send"),
    refId: text("ref_id"),
    payload: jsonb("payload")
      .$type<{ text: string; buttonUrl?: string; buttonText?: string }>()
      .notNull(),
    externalId: text("external_id"),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    availableAt: time("available_at").notNull().defaultNow(),
    lockedAt: time("locked_at"),
    sentAt: time("sent_at"),
    error: text("last_error"),
    createdAt: time("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("notification_pending_idx").on(t.status, t.availableAt),
    index("notification_ref_idx").on(t.refId),
  ],
);

// Read-only mirrors; no account credentials or reservation data are imported.
export const haideCatalog = pgTable("haide_catalog", {
  id: text("id").primaryKey(),
  payload: jsonb("payload")
    .$type<import("@/modules/haide/catalog").HaideItem>()
    .notNull(),
  contentHash: text("content_hash").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  visible: boolean("visible").notNull().default(false),
  suppressed: boolean("suppressed").notNull().default(false),
  issue: text("issue"),
  lastSeenRunId: text("last_seen_run_id").notNull(),
  updatedAt: time("updated_at").notNull().defaultNow(),
});
export const haideSyncRuns = pgTable("haide_sync_runs", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  trigger: text("trigger").notNull(),
  actorId: text("actor_id").references(() => user.id),
  imported: integer("imported").notNull().default(0),
  hidden: integer("hidden").notNull().default(0),
  issues: integer("issues").notNull().default(0),
  error: text("error"),
  startedAt: time("started_at").notNull().defaultNow(),
  finishedAt: time("finished_at"),
});
