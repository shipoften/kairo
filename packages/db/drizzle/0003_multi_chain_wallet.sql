ALTER TABLE "deposit_addresses" DROP CONSTRAINT IF EXISTS "deposit_addresses_user_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "deposit_addresses_user_id_unique";--> statement-breakpoint
DROP INDEX IF EXISTS "deposits_tx_hash_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposit_addresses_user_chain_uidx" ON "deposit_addresses" USING btree ("user_id","chain");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "deposits_chain_tx_hash_uidx" ON "deposits" USING btree ("chain","tx_hash");
