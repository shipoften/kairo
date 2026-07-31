import { eq } from "drizzle-orm";
import { platformConfigs } from "@xs-share/db";
import {
  DEFAULT_PLATFORM_FEE_RATE_BPS,
  DEFAULT_REFERRAL_EARN_RATE_BPS,
  DEFAULT_REFERRAL_PUBLISH_RATE_BPS,
  ERC20_CONFIRMATIONS,
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
  erc20Confirmations: "erc20_confirmations",
  textModelBaseUrl: "text_model_base_url",
  textModelApiKey: "text_model_api_key",
  textModelName: "text_model_name",
} as const;

async function getValue(key: string, fallback: string) {
  const db = getDb();
  const row = await db.query.platformConfigs.findFirst({
    where: eq(platformConfigs.key, key),
  });
  return row?.value ?? fallback;
}

function maskSecret(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "****";
  return `${"*".repeat(Math.min(trimmed.length - 4, 12))}${trimmed.slice(-4)}`;
}

export async function getTextModelSettings() {
  const [baseUrl, apiKey, model] = await Promise.all([
    getValue(KEYS.textModelBaseUrl, ""),
    getValue(KEYS.textModelApiKey, ""),
    getValue(KEYS.textModelName, ""),
  ]);
  return {
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    model: model.trim(),
  };
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
    erc20Confirmations,
    textModel,
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
    getValue(KEYS.erc20Confirmations, String(ERC20_CONFIRMATIONS)),
    getTextModelSettings(),
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
    erc20Confirmations: Number(erc20Confirmations),
    textModelBaseUrl: textModel.baseUrl,
    textModelApiKeyConfigured: Boolean(textModel.apiKey),
    textModelApiKeyMasked: textModel.apiKey
      ? maskSecret(textModel.apiKey)
      : "",
    textModelName: textModel.model,
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
  erc20Confirmations?: number;
  textModelBaseUrl?: string;
  textModelApiKey?: string;
  textModelName?: string;
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
  if (input.erc20Confirmations !== undefined) {
    await setPlatformSetting(
      KEYS.erc20Confirmations,
      String(input.erc20Confirmations),
    );
  }
  if (input.textModelBaseUrl !== undefined) {
    await setPlatformSetting(
      KEYS.textModelBaseUrl,
      input.textModelBaseUrl.trim(),
    );
  }
  if (input.textModelApiKey !== undefined) {
    const nextKey = input.textModelApiKey.trim();
    if (nextKey) {
      await setPlatformSetting(KEYS.textModelApiKey, nextKey);
    }
  }
  if (input.textModelName !== undefined) {
    await setPlatformSetting(KEYS.textModelName, input.textModelName.trim());
  }
  return getPlatformSettings();
}

export function bpsAmount(baseMicros: number, rateBps: number) {
  return Math.floor((baseMicros * rateBps) / 10_000);
}
