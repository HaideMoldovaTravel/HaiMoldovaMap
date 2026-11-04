ALTER TABLE "listing_revisions" ADD COLUMN "form_mode" text DEFAULT 'full' NOT NULL;
--> statement-breakpoint
-- Preserve the compact validation already used for non-administrative authors.
UPDATE "listing_revisions" AS r
SET "form_mode" = 'simple'
FROM "listings" AS l, "user" AS u
WHERE r."listing_id" = l."id"
  AND r."author_id" = u."id"
  AND l."kind" = 'experience'
  AND u."role" = 'user';
