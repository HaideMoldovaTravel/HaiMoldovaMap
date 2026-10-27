ALTER TABLE "assets" ADD COLUMN "purpose" text DEFAULT 'listing' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "alt_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "icon_asset_id" text;--> statement-breakpoint
ALTER TABLE "admin_invitations" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_icon_asset_id_assets_id_fk" FOREIGN KEY ("icon_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;