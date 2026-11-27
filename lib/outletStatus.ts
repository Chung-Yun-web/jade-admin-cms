import { Db, ObjectId } from "mongodb";
import { OutletStatus } from "@/types/outlet";
import { generatePromoCode } from "@/lib/utils";

export const VALID_OUTLET_STATUSES: readonly OutletStatus[] = [
  "available",
  "reserved",
  "sold",
  "archived",
] as const;

/**
 * 將傳入的狀態字串（不分大小寫，例如 "RESERVED" 或 "reserved"）標準化為 OutletStatus。
 * 若非合法狀態則回傳 undefined。
 */
export function normalizeOutletStatusInput(value: unknown): OutletStatus | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if ((VALID_OUTLET_STATUSES as readonly string[]).includes(normalized)) {
    return normalized as OutletStatus;
  }
  return undefined;
}

export interface ExistingOutletStatusSnapshot {
  status?: string;
  isSocialPromo?: boolean;
  promoCode?: string;
}

export interface ResolvedOutletStatusFields {
  status: OutletStatus;
  isSocialPromo: boolean;
  promoCode: string;
  reservedUntil: null;
}

/**
 * Outlet「販售狀態」與「社團特惠保留」單一真實來源（Single Source of Truth）雙向連動正規化：
 *
 * - 當最終狀態為 `reserved`：
 *   強制 `isSocialPromo = true`，保留既有或自動產生專屬 `promoCode`，並清除 `reservedUntil = null`。
 * - 當最終狀態為 `available` / `sold` / `archived`：
 *   強制 `isSocialPromo = false`，清空 `promoCode = ""`，並清除 `reservedUntil = null`。
 */
export function resolveOutletStatusFields(params: {
  status?: unknown;
  isSocialPromo?: unknown;
  promoCode?: unknown;
  existing?: ExistingOutletStatusSnapshot | null;
}): ResolvedOutletStatusFields {
  const { existing } = params;
  const incomingStatus = normalizeOutletStatusInput(params.status);
  const hasIncomingStatus = incomingStatus !== undefined;
  const hasIncomingPromoFlag = typeof params.isSocialPromo === "boolean";
  const incomingIsSocialPromo = hasIncomingPromoFlag
    ? (params.isSocialPromo as boolean)
    : undefined;
  const incomingPromoCode =
    typeof params.promoCode === "string" ? params.promoCode.trim() : undefined;

  const existingStatus = normalizeOutletStatusInput(existing?.status) ?? "available";
  const existingIsSocialPromo = Boolean(existing?.isSocialPromo);
  const existingPromoCode = (existing?.promoCode || "").trim();

  let finalStatus: OutletStatus;

  if (hasIncomingStatus) {
    if (incomingStatus === "reserved") {
      // 若原已處於社團特惠保留，且本次僅將 isSocialPromo 切為 false（未切換狀態）-> 恢復為現貨可售
      if (
        existingStatus === "reserved" &&
        existingIsSocialPromo &&
        incomingIsSocialPromo === false
      ) {
        finalStatus = "available";
      } else {
        finalStatus = "reserved";
      }
    } else {
      // incomingStatus 為 available / sold / archived
      // 若原本非社團特惠保留，但本次明確開啟 isSocialPromo = true 且狀態維持原值 -> 同步切換為 reserved
      if (
        incomingIsSocialPromo === true &&
        !existingIsSocialPromo &&
        incomingStatus === existingStatus
      ) {
        finalStatus = "reserved";
      } else {
        finalStatus = incomingStatus;
      }
    }
  } else if (hasIncomingPromoFlag) {
    if (incomingIsSocialPromo) {
      finalStatus = "reserved";
    } else {
      finalStatus = existingStatus === "reserved" ? "available" : existingStatus;
    }
  } else {
    finalStatus = existingStatus;
  }

  if (finalStatus === "reserved") {
    const promoCode = incomingPromoCode || existingPromoCode || generatePromoCode();
    return {
      status: "reserved",
      isSocialPromo: true,
      promoCode,
      reservedUntil: null,
    };
  }

  return {
    status: finalStatus,
    isSocialPromo: false,
    promoCode: "",
    reservedUntil: null,
  };
}

/**
 * 嚴格驗證是否為 24 位元十六進位 MongoDB ObjectId 字串，
 * 避免 12 字元的 slug（例如 "outlet-np001"）被 ObjectId.isValid 誤判。
 */
export function isHexObjectId(value: string): boolean {
  return /^[a-fA-F0-9]{24}$/.test(value) && ObjectId.isValid(value);
}

export interface OrderItemOutletLookupInput {
  productId?: unknown;
  outletId?: unknown;
  slug?: unknown;
  id?: unknown;
}

/**
 * 依據訂單或購物車品項中的識別欄位，安全查找對應的 Outlet 文件（不觸碰 products 集合）。
 */
export async function findOutletForOrderItem(
  db: Db,
  item: OrderItemOutletLookupInput
) {
  const rawId = String(item.productId ?? item.id ?? "").trim();
  const explicitOutletId = String(item.outletId ?? "").trim();
  const explicitSlug = String(item.slug ?? "").trim().toLowerCase();

  const objectIdCandidates = new Set<string>();
  const slugCandidates = new Set<string>();

  const tryAddObjectId = (val: string) => {
    if (val && isHexObjectId(val)) {
      objectIdCandidates.add(val);
    }
  };

  if (explicitOutletId) {
    tryAddObjectId(explicitOutletId);
  }
  if (explicitSlug) {
    slugCandidates.add(explicitSlug);
  }

  if (rawId) {
    tryAddObjectId(rawId);
    slugCandidates.add(rawId.toLowerCase());

    // 支援 "outlet-<id/slug>"、"outlet_<id/slug>"、"outlet:<id/slug>" 等前綴格式
    const prefixMatch = rawId.match(/^outlet[-_:](.+)$/i);
    if (prefixMatch && prefixMatch[1]) {
      const stripped = prefixMatch[1].trim();
      tryAddObjectId(stripped);
      slugCandidates.add(stripped.toLowerCase());
    }

    // 支援 "<objectId>-<spec>" 格式
    const dashIndex = rawId.indexOf("-");
    if (dashIndex !== -1) {
      const beforeDash = rawId.substring(0, dashIndex).trim();
      tryAddObjectId(beforeDash);
    }
  }

  const orClauses: Record<string, unknown>[] = [];
  if (objectIdCandidates.size > 0) {
    orClauses.push({
      _id: { $in: Array.from(objectIdCandidates).map((id) => new ObjectId(id)) },
    });
  }
  if (slugCandidates.size > 0) {
    orClauses.push({
      slug: { $in: Array.from(slugCandidates) },
    });
  }

  if (orClauses.length === 0) {
    return null;
  }

  return await db.collection("outlets").findOne({ $or: orClauses });
}

/**
 * 建立 Outlet 轉為已售出 (sold) 時的安全更新指令：
 * - 同步關閉社團特惠保留 (`isSocialPromo: false`)
 * - 清空驗證碼 (`promoCode: ""`)
 * - 清除 20 分鐘鎖定與保留過期時間 (`reservedUntil: null`, `$unset: reservedAt / lockedUntil`)
 * - 嚴格僅針對狀態與保留欄位使用 `$set`，絕不覆蓋或清空 `images` / `imageUrl` 或其他商品欄位。
 */
export function buildOutletSoldUpdate(now: Date = new Date()) {
  return {
    $set: {
      status: "sold" as const,
      isSocialPromo: false,
      promoCode: "",
      reservedUntil: null,
      updatedAt: now,
    },
    $unset: {
      reservedAt: "",
      lockedUntil: "",
    },
  };
}

/**
 * 將訂單明細中所有對應的 Outlet 單品標記為已售出 (sold)，
 * 並同步清除保留開關、驗證碼及 20 分鐘鎖定參數，同時完整保護圖片與商品資料不被覆蓋。
 */
export async function markOutletsAsSoldForOrderItems(
  db: Db,
  items: OrderItemOutletLookupInput[]
): Promise<string[]> {
  const updatedIds: string[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return updatedIds;
  }

  const processedIds = new Set<string>();

  for (const item of items) {
    const outletDoc = await findOutletForOrderItem(db, item);
    if (!outletDoc?._id) continue;

    const idStr = String(outletDoc._id);
    if (processedIds.has(idStr)) continue;
    processedIds.add(idStr);

    await db
      .collection("outlets")
      .updateOne({ _id: outletDoc._id }, buildOutletSoldUpdate(new Date()));

    updatedIds.push(idStr);
    console.log(
      `[Outlet Sync] Outlet "${outletDoc.title}" (${idStr}) marked as sold (reservation & lock cleared, images preserved).`
    );
  }

  return updatedIds;
}

/**
 * 線上付款結帳建立待付款訂單時，僅針對目前為 `available` 的 Outlet 單品加上 20 分鐘暫時鎖定。
 * 嚴格使用局部 `$set`，不覆蓋 `images` / `imageUrl`，也不破壞既有的社團特惠保留狀態。
 */
export async function lockAvailableOutletsForPendingCheckout(
  db: Db,
  items: OrderItemOutletLookupInput[],
  lockMinutes: number = 20
): Promise<string[]> {
  const lockedIds: string[] = [];
  if (!Array.isArray(items) || items.length === 0) {
    return lockedIds;
  }

  const now = new Date();
  const reservedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
  const processedIds = new Set<string>();

  for (const item of items) {
    const outletDoc = await findOutletForOrderItem(db, item);
    if (!outletDoc?._id) continue;

    const idStr = String(outletDoc._id);
    if (processedIds.has(idStr)) continue;
    processedIds.add(idStr);

    // 僅鎖定目前狀態為 available 且非社團特惠保留的單品
    if (outletDoc.status === "available" && !outletDoc.isSocialPromo) {
      const res = await db.collection("outlets").updateOne(
        { _id: outletDoc._id, status: "available", isSocialPromo: { $ne: true } },
        {
          $set: {
            status: "reserved",
            reservedUntil,
            updatedAt: now,
          },
        }
      );
      if (res.modifiedCount > 0) {
        lockedIds.push(idStr);
      }
    }
  }

  return lockedIds;
}
