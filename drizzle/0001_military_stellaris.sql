ALTER TABLE "listing_revisions" ADD COLUMN "point" geometry(point);--> statement-breakpoint
CREATE INDEX "revision_point_idx" ON "listing_revisions" USING gist ("point");
--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "revision_listing_pair_unique" UNIQUE ("listing_id", "id");
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "published_revision_belongs_to_listing" FOREIGN KEY ("id", "published_revision_id") REFERENCES "listing_revisions"("listing_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE UNIQUE INDEX "one_pending_revision_per_listing" ON "listing_revisions" ("listing_id") WHERE "status"='pending';
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "valid_user_role" CHECK ("role" IN ('user','moderator','admin','owner'));
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "valid_listing_status" CHECK ("status" IN ('unpublished','published','suspended','archived'));
--> statement-breakpoint
ALTER TABLE "listing_revisions" ADD CONSTRAINT "valid_revision_status" CHECK ("status" IN ('draft','pending','approved','changes','rejected'));
