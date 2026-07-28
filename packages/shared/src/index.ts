export const APP_NAME = "Kairo";
export const APP_SLOGAN = {
  en: "Publish or earn. One account.",
  zh: "发单或接单，同一个账号。",
} as const;
export const API_PREFIX = "/v1";

export const Locales = {
  en: "en",
  zh: "zh",
} as const;
export type Locale = (typeof Locales)[keyof typeof Locales];

export const WorkMode = {
  publish: "publish",
  earn: "earn",
} as const;
export type WorkMode = (typeof WorkMode)[keyof typeof WorkMode];

export const AuthProvider = {
  x: "x",
  google: "google",
  telegram: "telegram",
  dev: "dev",
} as const;
export type AuthProvider = (typeof AuthProvider)[keyof typeof AuthProvider];

export const UserRole = {
  user: "user",
  admin: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const TaskStatus = {
  draft: "draft",
  recruiting: "recruiting",
  paused: "paused",
  full: "full",
  ended: "ended",
  taken_down: "taken_down",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const JoinStatus = {
  joined: "joined",
  submitted: "submitted",
  approved: "approved",
  rejected: "rejected",
  expired: "expired",
  disputed: "disputed",
} as const;
export type JoinStatus = (typeof JoinStatus)[keyof typeof JoinStatus];

export const TaskType = {
  x_follow: "x_follow",
  x_like: "x_like",
  x_repost: "x_repost",
  x_post: "x_post",
  cpa_register: "cpa_register",
  custom: "custom",
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const Currency = {
  USDT: "USDT",
} as const;
export type Currency = (typeof Currency)[keyof typeof Currency];

export const Chain = {
  TRC20: "trc20",
} as const;
export type Chain = (typeof Chain)[keyof typeof Chain];

export const USDT_DECIMALS = 6;
export const USDT_MICROS_PER_UNIT = 1_000_000;

export function toMicros(amountUsdt: number): number {
  return Math.round(amountUsdt * USDT_MICROS_PER_UNIT);
}

export function fromMicros(amountMicros: number): number {
  return amountMicros / USDT_MICROS_PER_UNIT;
}

export function formatUsdt(amountMicros: number, fractionDigits = 2): string {
  return fromMicros(amountMicros).toFixed(fractionDigits);
}

export const MIN_DEPOSIT_MICROS = 10_000_000;
export const MIN_WITHDRAW_MICROS = 20_000_000;
export const WITHDRAW_NETWORK_FEE_MICROS = 1_000_000;
export const TRC20_CONFIRMATIONS = 20;

export const LedgerType = {
  deposit: "deposit",
  freeze: "freeze",
  unfreeze: "unfreeze",
  commission: "commission",
  withdraw: "withdraw",
  withdraw_fee: "withdraw_fee",
  withdraw_refund: "withdraw_refund",
  platform_fee: "platform_fee",
  referral_reward: "referral_reward",
} as const;
export type LedgerType = (typeof LedgerType)[keyof typeof LedgerType];

export const DepositStatus = {
  detecting: "detecting",
  confirming: "confirming",
  confirmed: "confirmed",
  ignored: "ignored",
} as const;
export type DepositStatus = (typeof DepositStatus)[keyof typeof DepositStatus];

export const WithdrawalStatus = {
  pending: "pending",
  approved: "approved",
  paid: "paid",
  rejected: "rejected",
} as const;
export type WithdrawalStatus =
  (typeof WithdrawalStatus)[keyof typeof WithdrawalStatus];

export const DisputeStatus = {
  open: "open",
  resolved_approve: "resolved_approve",
  resolved_reject: "resolved_reject",
  closed: "closed",
} as const;
export type DisputeStatus = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const ReferralTrigger = {
  earn_settle: "earn_settle",
  publish_fee: "publish_fee",
} as const;
export type ReferralTrigger =
  (typeof ReferralTrigger)[keyof typeof ReferralTrigger];

export const ErrorCode = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  SELF_JOIN_FORBIDDEN: "SELF_JOIN_FORBIDDEN",
  DUPLICATE_JOIN: "DUPLICATE_JOIN",
  QUOTA_FULL: "QUOTA_FULL",
  TASK_NOT_OPEN: "TASK_NOT_OPEN",
  RATE_LIMITED: "RATE_LIMITED",
  SELF_REFERRAL_FORBIDDEN: "SELF_REFERRAL_FORBIDDEN",
  REFERRAL_DISABLED: "REFERRAL_DISABLED",
  INTERNAL: "INTERNAL",
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export type ApiErrorBody = {
  code: ErrorCode;
  message: string;
  messageKey: string;
};

export const DEFAULT_PLATFORM_FEE_RATE_BPS = 0;
export const DEFAULT_REFERRAL_EARN_RATE_BPS = 500;
export const DEFAULT_REFERRAL_PUBLISH_RATE_BPS = 1000;
export const SESSION_COOKIE_NAME = "xs_session";

export const TRONSCAN_TX_URL = "https://tronscan.org/#/transaction";
export const TRONSCAN_ADDRESS_URL = "https://tronscan.org/#/address";

/** Loose TRC20 Base58Check shape check (not full checksum). */
export function isValidTrc20Address(address: string): boolean {
  return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address.trim());
}
