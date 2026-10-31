import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generatePromoCode(prefix: string = "SP"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

/**
 * 取得前台品牌官網的 Base URL
 * 優先順序:
 * 1. NEXT_PUBLIC_FRONTEND_URL (如: https://jade-brand-site.vercel.app)
 * 2. FRONTEND_URL
 * 3. NEXT_PUBLIC_BRAND_SITE_URL
 * 4. NEXT_PUBLIC_SITE_URL
 * 5. 預設正式前台網址: https://jade-brand-site.vercel.app
 */
export function getFrontendBaseUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_FRONTEND_URL ||
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_BRAND_SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/$/, "");
    if (!/^https?:\/\//i.test(clean)) {
      clean = `https://${clean}`;
    }
    return clean;
  }

  return "https://jade-brand-site.vercel.app";
}

export interface PromoDirectUrlParams {
  type: "outlet" | "product";
  slug?: string;
  productId?: string;
  specName?: string;
  promoCode?: string;
}

/**
 * 建立社團特惠前台專屬直達連結
 * - Outlet: /outlet?slug=...&promo=...
 * - Product: /product?id=...&spec=...&promo=...
 */
export function buildPromoDirectUrl(params: PromoDirectUrlParams): string {
  const baseUrl = getFrontendBaseUrl();
  const promo = (params.promoCode || "").trim();

  if (params.type === "outlet") {
    const slug = encodeURIComponent(params.slug || "");
    const promoParam = promo ? `&promo=${encodeURIComponent(promo)}` : "";
    return `${baseUrl}/outlet?slug=${slug}${promoParam}`;
  } else {
    const query = new URLSearchParams();
    if (params.productId) {
      query.set("id", params.productId);
    }
    if (params.specName) {
      query.set("spec", params.specName);
    }
    if (promo) {
      query.set("promo", promo);
    }
    const qs = query.toString();
    return `${baseUrl}/product${qs ? `?${qs}` : ""}`;
  }
}


