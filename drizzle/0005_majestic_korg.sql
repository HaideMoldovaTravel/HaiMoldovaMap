CREATE TABLE "haide_geocode_cache" (
	"key" text PRIMARY KEY NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"precision" text NOT NULL,
	"retry_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "haide_locations" (
	"id" text PRIMARY KEY NOT NULL,
	"query_key" text NOT NULL,
	"latitude" double precision NOT NULL,
	"longitude" double precision NOT NULL,
	"precision" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "haide_locations" ADD CONSTRAINT "haide_locations_id_haide_catalog_id_fk" FOREIGN KEY ("id") REFERENCES "public"."haide_catalog"("id") ON DELETE no action ON UPDATE no action;