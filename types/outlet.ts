export type OutletStatus = "available" | "reserved" | "sold" | "archived";

export interface OutletItem {
  _id?: string;
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  images: string[];
  material?: string;
  sourceNote?: string;
  description?: string;
  status: OutletStatus;
  reservedUntil?: string | Date | null;
  sortOrder: number;
  isSocialPromo?: boolean;
  promoCode?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

