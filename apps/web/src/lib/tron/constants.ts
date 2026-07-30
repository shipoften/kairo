import {
  DEFAULT_TRON_USDT_CONTRACT,
  TRON_MAINNET_CHAIN_ID,
} from "@xs-share/shared";

export const TRON_USDT_CONTRACT =
  process.env.NEXT_PUBLIC_TRON_USDT_CONTRACT?.trim() ||
  DEFAULT_TRON_USDT_CONTRACT;

export { TRON_MAINNET_CHAIN_ID };

export const TRONLINK_INSTALL_URL = "https://www.tronlink.org/";
