ALTER TABLE "users" ADD COLUMN "notify_email" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "telegram_chat_id" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_telegram" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_email_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "joins" ADD COLUMN "proof_fingerprint" varchar(128);--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "last_scanned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD COLUMN "last_activity_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE "uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"object_key" varchar(512) NOT NULL,
	"content_type" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"public_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uploads_object_key_uidx" ON "uploads" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "uploads_user_idx" ON "uploads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "joins_proof_fingerprint_idx" ON "joins" USING btree ("proof_fingerprint");--> statement-breakpoint
CREATE INDEX "deposit_addresses_last_scanned_idx" ON "deposit_addresses" USING btree ("last_scanned_at");--> statement-breakpoint
CREATE INDEX "withdrawals_status_created_idx" ON "withdrawals" USING btree ("status","created_at");
