CREATE TABLE "auth_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_user_id" varchar(191) NOT NULL,
	"profile_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deposit_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chain" varchar(16) DEFAULT 'trc20' NOT NULL,
	"address" varchar(64) NOT NULL,
	"derivation_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_addresses_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chain" varchar(16) DEFAULT 'trc20' NOT NULL,
	"address" varchar(64) NOT NULL,
	"tx_hash" varchar(128) NOT NULL,
	"from_address" varchar(64),
	"amount_micros" bigint NOT NULL,
	"confirmations" integer DEFAULT 0 NOT NULL,
	"required_confirmations" integer DEFAULT 20 NOT NULL,
	"status" varchar(32) DEFAULT 'detecting' NOT NULL,
	"note" text,
	"credited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"join_id" uuid NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(32) DEFAULT 'open' NOT NULL,
	"resolution_note" text,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "joins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"earner_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'joined' NOT NULL,
	"proof_payload" jsonb,
	"reject_reason" text,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"submit_deadline_at" timestamp with time zone,
	"review_deadline_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_configs_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "referral_rewards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inviter_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"trigger" varchar(32) NOT NULL,
	"amount_micros" bigint NOT NULL,
	"join_id" uuid,
	"task_id" uuid,
	"ledger_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publisher_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" varchar(32) NOT NULL,
	"target_url" text,
	"unit_price_micros" bigint NOT NULL,
	"currency" varchar(8) DEFAULT 'USDT' NOT NULL,
	"total_quota" integer NOT NULL,
	"remaining_quota" integer NOT NULL,
	"status" varchar(32) DEFAULT 'draft' NOT NULL,
	"language_tag" varchar(8) DEFAULT 'en' NOT NULL,
	"submit_deadline_hours" integer DEFAULT 72 NOT NULL,
	"review_deadline_hours" integer DEFAULT 72 NOT NULL,
	"allow_resubmit" boolean DEFAULT true NOT NULL,
	"proof_schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"frozen_micros" bigint DEFAULT 0 NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"avatar_url" text,
	"preferred_locale" varchar(8) DEFAULT 'en' NOT NULL,
	"preferred_mode" varchar(16) DEFAULT 'earn' NOT NULL,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"invite_code" varchar(16) NOT NULL,
	"invited_by_user_id" uuid,
	"referral_enabled" boolean DEFAULT true NOT NULL,
	"banned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"available_micros" bigint DEFAULT 0 NOT NULL,
	"frozen_micros" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_accounts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_micros" bigint NOT NULL,
	"remaining_micros" bigint NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_holds_task_id_unique" UNIQUE("task_id")
);
--> statement-breakpoint
CREATE TABLE "wallet_ledgers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(32) NOT NULL,
	"amount_micros" bigint NOT NULL,
	"balance_after_micros" bigint NOT NULL,
	"task_id" uuid,
	"join_id" uuid,
	"related_user_id" uuid,
	"deposit_id" uuid,
	"withdrawal_id" uuid,
	"tx_hash" varchar(128),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "withdrawals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chain" varchar(16) DEFAULT 'trc20' NOT NULL,
	"to_address" varchar(64) NOT NULL,
	"amount_micros" bigint NOT NULL,
	"network_fee_micros" bigint NOT NULL,
	"net_payout_micros" bigint NOT NULL,
	"tx_hash" varchar(128),
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"note" text,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_addresses" ADD CONSTRAINT "deposit_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_join_id_joins_id_fk" FOREIGN KEY ("join_id") REFERENCES "public"."joins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "joins" ADD CONSTRAINT "joins_earner_id_users_id_fk" FOREIGN KEY ("earner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_rewards" ADD CONSTRAINT "referral_rewards_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_publisher_id_users_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_holds" ADD CONSTRAINT "wallet_holds_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_ledgers" ADD CONSTRAINT "wallet_ledgers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_identities_provider_uidx" ON "auth_identities" USING btree ("provider","provider_user_id");--> statement-breakpoint
CREATE INDEX "auth_identities_user_idx" ON "auth_identities" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposit_addresses_address_uidx" ON "deposit_addresses" USING btree ("address");--> statement-breakpoint
CREATE INDEX "deposit_addresses_user_idx" ON "deposit_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "deposits_user_idx" ON "deposits" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deposits_tx_hash_uidx" ON "deposits" USING btree ("tx_hash");--> statement-breakpoint
CREATE INDEX "disputes_join_idx" ON "disputes" USING btree ("join_id");--> statement-breakpoint
CREATE INDEX "joins_task_idx" ON "joins" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "joins_earner_idx" ON "joins" USING btree ("earner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "joins_task_earner_active_uidx" ON "joins" USING btree ("task_id","earner_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "referral_rewards_inviter_idx" ON "referral_rewards" USING btree ("inviter_id");--> statement-breakpoint
CREATE INDEX "referral_rewards_invitee_idx" ON "referral_rewards" USING btree ("invitee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_uidx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_publisher_idx" ON "tasks" USING btree ("publisher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_invite_code_uidx" ON "users" USING btree ("invite_code");--> statement-breakpoint
CREATE INDEX "users_invited_by_idx" ON "users" USING btree ("invited_by_user_id");--> statement-breakpoint
CREATE INDEX "wallet_accounts_user_idx" ON "wallet_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_holds_user_idx" ON "wallet_holds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_ledgers_user_idx" ON "wallet_ledgers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wallet_ledgers_type_idx" ON "wallet_ledgers" USING btree ("type");--> statement-breakpoint
CREATE INDEX "withdrawals_user_idx" ON "withdrawals" USING btree ("user_id");