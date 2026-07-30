import { usdtMicrosToTokenAmount } from "@xs-share/shared";
import { TRON_USDT_CONTRACT } from "./constants";
import { ensureTronMainnet, getTronWeb } from "./tron-web";

const DEFAULT_FEE_LIMIT = 100_000_000;

export async function sendUsdtDepositTransfer(input: {
  toAddress: string;
  amountMicros: number;
  contractAddress?: string;
}): Promise<string> {
  await ensureTronMainnet();
  const tronWeb = getTronWeb();
  if (!tronWeb) {
    throw new Error("TRONLINK_NOT_INSTALLED");
  }

  const contractAddress = input.contractAddress ?? TRON_USDT_CONTRACT;
  const tokenAmount = usdtMicrosToTokenAmount(input.amountMicros);
  const contract = await tronWeb.contract().at(contractAddress);
  const transactionId = await contract
    .transfer(input.toAddress, tokenAmount)
    .send({ feeLimit: DEFAULT_FEE_LIMIT });

  if (!transactionId || typeof transactionId !== "string") {
    throw new Error("TRANSFER_FAILED");
  }
  return transactionId;
}
