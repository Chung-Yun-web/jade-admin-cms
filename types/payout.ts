export interface BankInfo {
  bankCodeName: string;
  accountNumber: string;
}

export interface PayoutOrderItemProduct {
  name: string;
  quantity: number;
  price: number;
}

export interface PayoutOrderItem {
  orderNumber: string;
  subtotal: number;
  rewardAmount: number;
  items?: PayoutOrderItemProduct[];
}

export interface PayoutClaim {
  _id: string;
  claimId: string;
  userId: string;
  userEmail: string;
  userName?: string;
  orderNumbers: string[];
  orders: PayoutOrderItem[];
  totalRewardAmount: number;
  rewardRate: number;
  bankInfo: BankInfo;
  status: "審核中" | "已撥款" | "已退回" | string;
  appliedAt: string | Date;
  processedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  adminNote?: string;
}

export interface PayoutStats {
  pendingCount: number;
  pendingAmount: number;
  completedCount: number;
  completedAmount: number;
  totalCount: number;
  totalAmount: number;
}
