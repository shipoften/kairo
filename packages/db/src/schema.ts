import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  bigint,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    avatarUrl: text("avatar_url"),
    preferredLocale: varchar("preferred_locale", { length: 8 })
      .notNull()
      .default("en"),
    preferredMode: varchar("preferred_mode", { length: 16 })
      .notNull()
      .default("earn"),
    role: varchar("role", { length: 16 }).notNull().default("user"),
    inviteCode: varchar("invite_code", { length: 16 }).notNull(),
    invitedByUserId: uuid("invited_by_user_id"),
    referralEnabled: boolean("referral_enabled").notNull().default(true),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_invite_code_uidx").on(table.inviteCode),
    index("users_invited_by_idx").on(table.invitedByUserId),
  ],
);

export const authIdentities = pgTable(
  "auth_identities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerUserId: varchar("provider_user_id", { length: 191 }).notNull(),
    profileJson: jsonb("profile_json"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("auth_identities_provider_uidx").on(
      table.provider,
      table.providerUserId,
    ),
    index("auth_identities_user_idx").on(table.userId),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uidx").on(table.tokenHash),
    index("sessions_user_idx").on(table.userId),
  ],
);

export const platformConfigs = pgTable("platform_configs", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publisherId: uuid("publisher_id")
      .notNull()
      .references(() => users.id),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description").notNull().default(""),
    type: varchar("type", { length: 32 }).notNull(),
    targetUrl: text("target_url"),
    unitPriceMicros: bigint("unit_price_micros", { mode: "number" }).notNull(),
    currency: varchar("currency", { length: 8 }).notNull().default("USDT"),
    totalQuota: integer("total_quota").notNull(),
    remainingQuota: integer("remaining_quota").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("draft"),
    languageTag: varchar("language_tag", { length: 8 }).notNull().default("en"),
    submitDeadlineHours: integer("submit_deadline_hours").notNull().default(72),
    reviewDeadlineHours: integer("review_deadline_hours").notNull().default(72),
    allowResubmit: boolean("allow_resubmit").notNull().default(true),
    proofSchema: jsonb("proof_schema").notNull().default({}),
    frozenMicros: bigint("frozen_micros", { mode: "number" }).notNull().default(0),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("tasks_status_idx").on(table.status),
    index("tasks_publisher_idx").on(table.publisherId),
  ],
);

export const joins = pgTable(
  "joins",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id),
    earnerId: uuid("earner_id")
      .notNull()
      .references(() => users.id),
    status: varchar("status", { length: 32 }).notNull().default("joined"),
    proofPayload: jsonb("proof_payload"),
    rejectReason: text("reject_reason"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    submitDeadlineAt: timestamp("submit_deadline_at", { withTimezone: true }),
    reviewDeadlineAt: timestamp("review_deadline_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("joins_task_idx").on(table.taskId),
    index("joins_earner_idx").on(table.earnerId),
    uniqueIndex("joins_task_earner_active_uidx").on(table.taskId, table.earnerId),
  ],
);

export const walletAccounts = pgTable(
  "wallet_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    availableMicros: bigint("available_micros", { mode: "number" })
      .notNull()
      .default(0),
    frozenMicros: bigint("frozen_micros", { mode: "number" })
      .notNull()
      .default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("wallet_accounts_user_idx").on(table.userId)],
);

export const walletLedgers = pgTable(
  "wallet_ledgers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: varchar("type", { length: 32 }).notNull(),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    balanceAfterMicros: bigint("balance_after_micros", { mode: "number" }).notNull(),
    taskId: uuid("task_id"),
    joinId: uuid("join_id"),
    relatedUserId: uuid("related_user_id"),
    depositId: uuid("deposit_id"),
    withdrawalId: uuid("withdrawal_id"),
    txHash: varchar("tx_hash", { length: 128 }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("wallet_ledgers_user_idx").on(table.userId),
    index("wallet_ledgers_type_idx").on(table.type),
  ],
);

export const walletHolds = pgTable(
  "wallet_holds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id)
      .unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    remainingMicros: bigint("remaining_micros", { mode: "number" }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("wallet_holds_user_idx").on(table.userId)],
);

export const depositAddresses = pgTable(
  "deposit_addresses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
      .unique(),
    chain: varchar("chain", { length: 16 }).notNull().default("trc20"),
    address: varchar("address", { length: 64 }).notNull(),
    derivationIndex: integer("derivation_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("deposit_addresses_address_uidx").on(table.address),
    index("deposit_addresses_user_idx").on(table.userId),
  ],
);

export const deposits = pgTable(
  "deposits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    chain: varchar("chain", { length: 16 }).notNull().default("trc20"),
    address: varchar("address", { length: 64 }).notNull(),
    txHash: varchar("tx_hash", { length: 128 }).notNull(),
    fromAddress: varchar("from_address", { length: 64 }),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    confirmations: integer("confirmations").notNull().default(0),
    requiredConfirmations: integer("required_confirmations").notNull().default(20),
    status: varchar("status", { length: 32 }).notNull().default("detecting"),
    note: text("note"),
    creditedAt: timestamp("credited_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("deposits_user_idx").on(table.userId),
    uniqueIndex("deposits_tx_hash_uidx").on(table.txHash),
  ],
);

export const withdrawals = pgTable(
  "withdrawals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    chain: varchar("chain", { length: 16 }).notNull().default("trc20"),
    toAddress: varchar("to_address", { length: 64 }).notNull(),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    networkFeeMicros: bigint("network_fee_micros", { mode: "number" }).notNull(),
    netPayoutMicros: bigint("net_payout_micros", { mode: "number" }).notNull(),
    txHash: varchar("tx_hash", { length: 128 }),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    note: text("note"),
    reviewedByUserId: uuid("reviewed_by_user_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("withdrawals_user_idx").on(table.userId)],
);

export const disputes = pgTable(
  "disputes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    joinId: uuid("join_id")
      .notNull()
      .references(() => joins.id),
    openedByUserId: uuid("opened_by_user_id")
      .notNull()
      .references(() => users.id),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("open"),
    resolutionNote: text("resolution_note"),
    resolvedByUserId: uuid("resolved_by_user_id"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("disputes_join_idx").on(table.joinId)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 64 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    body: text("body").notNull().default(""),
    payload: jsonb("payload"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const referralRewards = pgTable(
  "referral_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => users.id),
    trigger: varchar("trigger", { length: 32 }).notNull(),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    joinId: uuid("join_id"),
    taskId: uuid("task_id"),
    ledgerId: uuid("ledger_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("referral_rewards_inviter_idx").on(table.inviterId),
    index("referral_rewards_invitee_idx").on(table.inviteeId),
  ],
);

export const schema = {
  users,
  authIdentities,
  sessions,
  platformConfigs,
  tasks,
  joins,
  walletAccounts,
  walletLedgers,
  walletHolds,
  depositAddresses,
  deposits,
  withdrawals,
  disputes,
  notifications,
  referralRewards,
};
