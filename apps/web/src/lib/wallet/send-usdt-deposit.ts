"use client";

import { Chain, usdtMicrosToTokenAmount } from "@xs-share/shared";
import {
  createWalletClient,
  custom,
  encodeFunctionData,
  type Hex,
} from "viem";
import { mainnet, sepolia } from "viem/chains";
import { sendUsdtDepositTransfer as sendTronUsdtTransfer } from "@/lib/tron/usdt-transfer";
import {
  getExpectedEvmChainId,
  getUsdtContractAddress,
} from "./appkit-config";
import { getClientChainEnv } from "./chain-env";

const ERC20_TRANSFER_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export async function sendUsdtDeposit(input: {
  chain: string;
  toAddress: string;
  amountMicros: number;
  fromAddress?: string;
}): Promise<string> {
  if (input.chain === Chain.ERC20) {
    return sendErc20UsdtTransfer(input);
  }
  return sendTronUsdtTransfer({
    toAddress: input.toAddress,
    amountMicros: input.amountMicros,
  });
}

async function sendErc20UsdtTransfer(input: {
  toAddress: string;
  amountMicros: number;
  fromAddress?: string;
}): Promise<string> {
  const ethereum = (
    window as Window & {
      ethereum?: {
        request: (args: {
          method: string;
          params?: unknown[];
        }) => Promise<unknown>;
      };
    }
  ).ethereum;
  if (!ethereum) {
    throw new Error("WALLET_NOT_INSTALLED");
  }

  const expectedChainId = getExpectedEvmChainId();
  const chainIdHex = (await ethereum.request({
    method: "eth_chainId",
  })) as string;
  const currentChainId = Number.parseInt(chainIdHex, 16);
  if (currentChainId !== expectedChainId) {
    throw new Error("WRONG_NETWORK");
  }

  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];
  const account = (input.fromAddress || accounts[0]) as Hex | undefined;
  if (!account) {
    throw new Error("WALLET_NOT_READY");
  }

  const chain =
    getClientChainEnv() === "testnet" || expectedChainId === 11155111
      ? sepolia
      : mainnet;
  const client = createWalletClient({
    account,
    chain,
    transport: custom(ethereum),
  });

  try {
    const hash = await client.sendTransaction({
      to: getUsdtContractAddress(Chain.ERC20) as Hex,
      data: encodeFunctionData({
        abi: ERC20_TRANSFER_ABI,
        functionName: "transfer",
        args: [
          input.toAddress as Hex,
          BigInt(usdtMicrosToTokenAmount(input.amountMicros)),
        ],
      }),
    });
    return hash;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes("reject")
    ) {
      throw error;
    }
    throw new Error("TRANSFER_FAILED");
  }
}
