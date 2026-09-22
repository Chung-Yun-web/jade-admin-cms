export interface OrderItem {
  productId?: string;
  name: string;
  price?: number;
  quantity?: number;
  spec?: string;
  image?: string;
}

export interface CustomerInfo {
  name: string;
  email?: string;
  phone: string;
  shippingAddress: string;
}

export interface AmountInfo {
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
}

export interface ShippingInfo {
  method: 'INSURED_HOME' | 'CVS_STORE' | 'STANDARD_HOME' | string;
  methodName?: string;
  receiverName: string;
  receiverPhone: string;
  address?: string;
  storeId?: string;
  storeName?: string;
  storeAddress?: string;
}

export interface PaymentInfo {
  provider?: string;
  status?: 'PAID' | 'UNPAID' | 'FAILED' | string;
  tradeNo?: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  userId?: string | null;
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'failed' | string;
  customerInfo: CustomerInfo;
  items: OrderItem[];
  isGuest?: boolean;
  amountInfo?: AmountInfo;
  shippingInfo?: ShippingInfo;
  paymentInfo?: PaymentInfo;
  shippingStatus?: 'UNSHIPPED' | 'SHIPPED' | 'CANCELLED' | string;
  trace?: string | null;
  shippedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
}

export interface OrderStatsData {
  unshippedCount: number;
  unshippedTotal: number;
  insuredHomeCount: number;
  cvsCount: number;
  shippedCount: number;
}

export interface SenderInfo {
  name: string;
  phone: string;
  address: string;
  postcode?: string;
}
