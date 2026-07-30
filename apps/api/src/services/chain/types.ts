export type IncomingUsdtTransfer = {
  txHash: string;
  fromAddress: string;
  toAddress: string;
  amountMicros: number;
  confirmations: number;
  blockTimestamp: Date;
};

export type ChainAdapter = {
  readonly name: string;
  allocateAddress(userId: string, derivationIndex: number): Promise<string>;
  isValidAddress(address: string): boolean;
  getConfirmations(txHash: string): Promise<number>;
  listIncomingUsdt(
    address: string,
    since?: Date,
  ): Promise<IncomingUsdtTransfer[]>;
  getIncomingUsdtByTxHash(
    txHash: string,
    toAddress: string,
  ): Promise<IncomingUsdtTransfer | null>;
  /** Mock/dev only: inject a transfer for testing. */
  injectIncoming?(transfer: IncomingUsdtTransfer): void;
};
