import { eq } from "drizzle-orm";
import { platformConfigs } from "@xs-share/db";
import {
  DEFAULT_PLATFORM_FEE_RATE_BPS,
  DEFAULT_REFERRAL_EARN_RATE_BPS,
  DEFAULT_REFERRAL_PUBLISH_RATE_BPS,
  MIN_DEPOSIT_MICROS,
  MIN_WITHDRAW_MICROS,
  TRC20_CONFIRMATIONS,
  WITHDRAW_NETWORK_FEE_MICROS,
} from "@xs-share/shared";
import { getDb } from "../lib/db";

const KEYS = {
  platformFeeRateBps: "platform_fee_rate_bps",
  referralEnabled: "referral_enabled",
  referralEarnRateBps: "referral_earn_rate_bps",
  referralPublishRateBps: "referral_publish_rate_bps",
  minDepositMicros: "min_deposit_micros",
  minWithdrawMicros: "min_withdraw_micros",
  withdrawNetworkFeeMicros: "withdraw_network_fee_micros",
  trc20Confirmations: "trc20_confirmations",
} as const;

async function getValue(key: string, fallback: string) {
  const db = getDb();
  const row = await db.query.platformConfigs.findFirst({
    where: eq(platformConfigs.key, key),
  });
  return row?.value ?? fallback;
}

export async function getPlatformSettings() {
  const [
    platformFeeRateBps,
    referralEnabled,
    referralEarnRateBps,
    referralPublishRateBps,
    minDepositMicros,
    minWithdrawMicros,
    withdrawNetworkFeeMicros,
    trc20Confirmations,
  ] = await Promise.all([
    getValue(KEYS.platformFeeRateBps, String(DEFAULT_PLATFORM_FEE_RATE_BPS)),
    getValue(KEYS.referralEnabled, "true"),
    getValue(KEYS.referralEarnRateBps, String(DEFAULT_REFERRAL_EARN_RATE_BPS)),
    getValue(
      KEYS.referralPublishRateBps,
      String(DEFAULT_REFERRAL_PUBLISH_RATE_BPS),
    ),
    getValue(KEYS.minDepositMicros, String(MIN_DEPOSIT_MICROS)),
    getValue(KEYS.minWithdrawMicros, String(MIN_WITHDRAW_MICROS)),
    getValue(
      KEYS.withdrawNetworkFeeMicros,
      String(WITHDRAW_NETWORK_FEE_MICROS),
    ),
    getValue(KEYS.trc20Confirmations, String(TRC20_CONFIRMATIONS)),
  ]);

  return {
    platformFeeRateBps: Number(platformFeeRateBps),
    referralEnabled: referralEnabled === "true",
    referralEarnRateBps: Number(referralEarnRateBps),
    referralPublishRateBps: Number(referralPublishRateBps),
    minDepositMicros: Number(minDepositMicros),
    minWithdrawMicros: Number(minWithdrawMicros),
    withdrawNetworkFeeMicros: Number(withdrawNetworkFeeMicros),
    trc20Confirmations: Number(trc20Confirmations),
  };
}

export async function setPlatformSetting(key: string, value: string) {
  const db = getDb();
  const existing = await db.query.platformConfigs.findFirst({
    where: eq(platformConfigs.key, key),
  });
  if (existing) {
    await db
      .update(platformConfigs)
      .set({ value, updatedAt: new Date() })
      .where(eq(platformConfigs.id, existing.id));
    return;
  }
  await db.insert(platformConfigs).values({ key, value });
}

export async function updatePlatformSettings(input: {
  platformFeeRateBps?: number;
  referralEnabled?: boolean;
  referralEarnRateBps?: number;
  referralPublishRateBps?: number;
  minDepositMicros?: number;
  minWithdrawMicros?: number;
  withdrawNetworkFeeMicros?: number;
  trc20Confirmations?: number;
}) {
  if (input.platformFeeRateBps !== undefined) {
    await setPlatformSetting(
      KEYS.platformFeeRateBps,
      String(input.platformFeeRateBps),
    );
  }
  if (input.referralEnabled !== undefined) {
    await setPlatformSetting(
      KEYS.referralEnabled,
      input.referralEnabled ? "true" : "false",
    );
  }
  if (input.referralEarnRateBps !== undefined) {
    await setPlatformSetting(
      KEYS.referralEarnRateBps,
      String(input.referralEarnRateBps),
    );
  }
  if (input.referralPublishRateBps !== undefined) {
    await setPlatformSetting(
      KEYS.referralPublishRateBps,
      String(input.referralPublishRateBps),
    );
  }
  if (input.minDepositMicros !== undefined) {
    await setPlatformSetting(
      KEYS.minDepositMicros,
      String(input.minDepositMicros),
    );
  }
  if (input.minWithdrawMicros !== undefined) {
    await setPlatformSetting(
      KEYS.minWithdrawMicros,
      String(input.minWithdrawMicros),
    );
  }
  if (input.withdrawNetworkFeeMicros !== undefined) {
    await setPlatformSetting(
      KEYS.withdrawNetworkFeeMicros,
      String(input.withdrawNetworkFeeMicros),
    );
  }
  if (input.trc20Confirmations !== undefined) {
    await setPlatformSetting(
      KEYS.trc20Confirmations,
      String(input.trc20Confirmations),
    );
  }
  return getPlatformSettings();
}

export function bpsAmount(baseMicros: number, rateBps: number) {
  return Math.floor((baseMicros * rateBps) / 10_000);
}
