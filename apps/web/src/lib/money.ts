import { formatUsdt } from "@xs-share/shared";

export function displayUsdt(amountMicros: number, fractionDigits = 2) {
  return `${formatUsdt(amountMicros, fractionDigits)} USDT`;
}

export function usdtToMicros(amountUsdt: number) {
  return Math.round(amountUsdt * 1_000_000);
}
