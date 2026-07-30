export type AdminTab =
  | "overview"
  | "withdrawals"
  | "disputes"
  | "deposits"
  | "users"
  | "tasks"
  | "config";

export type AdminConfig = {
  platformFeeRateBps: number;
  referralEnabled: boolean;
  referralEarnRateBps: number;
  referralPublishRateBps: number;
  minDepositMicros: number;
  minWithdrawMicros: number;
  withdrawNetworkFeeMicros: number;
  trc20Confirmations: number;
  chainAdapter: string;
};

export type AdminOverview = {
  pendingWithdrawals: number;
  pendingWithdrawalAmountMicros: number;
  openDisputes: number;
  todayDeposits: number;
  todayDepositAmountMicros: number;
  activeTasks: number;
  totalUsers: number;
  chainAdapter: string;
};

export type AdminDepositRow = {
  id: string;
  userId: string;
  userName: string | null;
  amountMicros: number;
  status: string;
  txHash: string;
  address: string;
  confirmations: number;
  requiredConfirmations: number;
  createdAt: string;
};

export type AdminWithdrawalRow = {
  id: string;
  userId: string;
  userName: string | null;
  amountMicros: number;
  networkFeeMicros: number;
  netPayoutMicros: number;
  toAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
};

export type AdminDisputeRow = {
  id: string;
  status: string;
  reason: string;
  joinId: string;
  taskId: string | null;
  taskTitle: string | null;
  earnerName: string | null;
  publisherName: string | null;
  openedByName: string | null;
  joinStatus: string | null;
};

export type AdminUserRow = {
  id: string;
  displayName: string;
  role: string;
  bannedAt: string | null;
  referralEnabled?: boolean;
};

export type AdminTaskRow = {
  id: string;
  title: string;
  status: string;
};

export type AdminData = {
  overview: AdminOverview;
  config: AdminConfig;
  deposits: AdminDepositRow[];
  withdrawals: AdminWithdrawalRow[];
  users: AdminUserRow[];
  tasks: AdminTaskRow[];
  disputes: AdminDisputeRow[];
  currentUserId: string;
};
