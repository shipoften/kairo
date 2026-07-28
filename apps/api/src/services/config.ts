import { eq } from "drizzle-orm";
import { platformConfigs } from "@xs-share/db";
import {
  DEFAULT_PLATFORM_FEE_RATE_BPS,
  DEFAULT_REFERRAL_EARN_RATE_BPS,
  DEFAULT_REFERRAL_PUBLISH_RATE_BPS,
} from "@xs-share/shared";
import { getDb } from "../lib/db";

const KEYS = {
  platformFeeRateBps: "platform_fee_rate_bps",
  referralEnabled: "referral_enabled",
  referralEarnRateBps: "referral_earn_rate_bps",
  referralPublishRateBps: "referral_publish_rate_bps",
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
  ] = await Promise.all([
    getValue(KEYS.platformFeeRateBps, String(DEFAULT_PLATFORM_FEE_RATE_BPS)),
    getValue(KEYS.referralEnabled, "true"),
    getValue(KEYS.referralEarnRateBps, String(DEFAULT_REFERRAL_EARN_RATE_BPS)),
    getValue(
      KEYS.referralPublishRateBps,
      String(DEFAULT_REFERRAL_PUBLISH_RATE_BPS),
    ),
  ]);

  return {
    platformFeeRateBps: Number(platformFeeRateBps),
    referralEnabled: referralEnabled === "true",
    referralEarnRateBps: Number(referralEarnRateBps),
    referralPublishRateBps: Number(referralPublishRateBps),
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
  return getPlatformSettings();
}

export function bpsAmount(baseCents: number, rateBps: number) {
  return Math.floor((baseCents * rateBps) / 10_000);
}
