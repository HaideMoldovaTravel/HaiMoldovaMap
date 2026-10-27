CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_integration_stats" (
	"integration_id" text NOT NULL,
	"day" date NOT NULL,
	"host" text NOT NULL,
	"allowed" boolean NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partner_integration_stats_integration_id_day_host_allowed_pk" PRIMARY KEY("integration_id","day","host","allowed")
);
--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text DEFAULT 'telegram' NOT NULL,
	"kind" text DEFAULT 'send' NOT NULL,
	"ref_id" text,
	"payload" jsonb NOT NULL,
	"external_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"title" text NOT NULL,
	"partner_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"domains" jsonb NOT NULL,
	"allow_subdomains" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"settings" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "partner_integrations_public_key_unique" UNIQUE("public_key")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_integration_stats" ADD CONSTRAINT "partner_integration_stats_integration_id_partner_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."partner_integrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_integrations" ADD CONSTRAINT "partner_integrations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_pending_idx" ON "notification_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "notification_ref_idx" ON "notification_outbox" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "integration_status_idx" ON "partner_integrations" USING btree ("status");