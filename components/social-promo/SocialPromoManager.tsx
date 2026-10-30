"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Gift,
  Search,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ShoppingBag,
  Layers,
  AlertCircle,
  Tag,
  CheckCircle2,
  Clock,
  ArrowRight
} from "lucide-react";
import { getImageUrl } from "@/lib/image";

export interface SocialPromoItem {
  id: string;
  type: "product" | "outlet";
  sourceId: string;
  productId?: string;
  variantIndex?: number;
  slug?: string;
  title: string;
  variantName: string;
  price: number;
  originalPrice?: number;
  image: string;
  status: "available" | "reserved" | "sold" | "archived" | string;
  isSocialPromo: boolean;
  promoCode: string;
  directPath: string;
  fullUrl: string;
  updatedAt: string | Date;
}

interface SocialPromoStats {
  totalCount: number;
  productCount: number;
  outletCount: number;
  reservedCount: number;
  soldCount: number;
  availableCount: number;
}

interface SocialPromoManagerProps {
  onNavigateToProduct?: (productId: string) => void;
  onNavigateToOutlet?: (outletId: string) => void;
}

export function SocialPromoManager({
  onNavigateToProduct,
  onNavigateToOutlet,
}: SocialPromoManagerProps) {
  const [items, setItems] = useState<SocialPromoItem[]>([]);
  const [stats, setStats] = useState<SocialPromoStats>({
    totalCount: 0,
    productCount: 0,
    outletCount: 0,
    reservedCount: 0,
    soldCount: 0,
    availableCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "product" | "outlet">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPromoItems = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/social-promos");
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        if (data.stats) {
          setStats(data.stats);
        }
      } else {
        console.error("載入社團特惠清單失敗:", data.message);
      }
    } catch (err) {
      console.error("載入社團特惠清單發生錯誤:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromoItems();
  }, []);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Type filter
      if (typeFilter !== "all" && item.type !== typeFilter) {
        return false;
      }
      // Status filter
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchTitle = item.title?.toLowerCase().includes(query);
        const matchVariant = item.variantName?.toLowerCase().includes(query);
        const matchCode = item.promoCode?.toLowerCase().includes(query);
        const matchSlug = item.slug?.toLowerCase().includes(query);
        if (!matchTitle && !matchVariant && !matchCode && !matchSlug) {
          return false;
        }
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, searchQuery]);

  // Copy helper
  const handleCopy = async (text: string, key: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    } catch (err) {
      console.error("複製失敗:", err);
    }
  };

  // Quick Release action
  const handleReleasePromo = async (item: SocialPromoItem) => {
    const confirmMessage = `確定要解除「${item.title} (${item.variantName})」的社團特惠保留嗎？\n\n解除後：\n- 該品項狀態將恢復為「現貨可售 (available)」\n- 專屬驗證碼將會被清空`;
    if (!window.confirm(confirmMessage)) return;

    setActionLoadingId(item.id);
    try {
      const res = await fetch("/api/admin/social-promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          sourceId: item.sourceId,
          variantIndex: item.variantIndex,
          action: "release",
        }),
      });
      const data = await res.json();
      if (data.success) {
        // Refetch or update locally
        await fetchPromoItems();
      } else {
        alert("操作失敗: " + (data.message || "未知錯誤"));
      }
    } catch (err: any) {
      alert("操作時發生錯誤: " + (err.message || "未知錯誤"));
    } finally {
      setActionLoadingId(null);
    }
  };

  // Quick Regenerate PromoCode
  const handleRegenerateCode = async (item: SocialPromoItem) => {
    if (!window.confirm(`確定要為「${item.title}」重新產生一組新的驗證碼嗎？`)) return;

    setActionLoadingId(item.id);
    try {
      const res = await fetch("/api/admin/social-promos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          sourceId: item.sourceId,
          variantIndex: item.variantIndex,
          action: "regenerateCode",
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchPromoItems();
      } else {
        alert("重新產生失敗: " + (data.message || "未知錯誤"));
      }
    } catch (err: any) {
      alert("操作出錯: " + (err.message || "未知錯誤"));
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Title Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-stone-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-200 border border-purple-400/30 text-xs font-semibold mb-3">
              <Gift className="w-3.5 h-3.5 text-purple-300" />
              <span>行銷推廣專屬中心</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-wider">
              社團特惠長效保留與管理
            </h1>
            <p className="text-sm text-stone-300 mt-2 max-w-2xl leading-relaxed">
              集中檢視所有啟用「社團特惠長效保留」的常規商品規格與 Outlet
              特賣品。品項將保持保留狀態不受 20 分鐘過期機制影響，便於產生專屬網址並一鍵發布至社群平台！
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchPromoItems}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 active:bg-white/30 border border-white/20 rounded-xl text-sm font-medium transition-all backdrop-blur-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              <span>重新整理清單</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">特惠品項總數</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900 font-mono">
            {stats.totalCount}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">全館已設定之社團特惠</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">長效保留中</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-700 font-mono">
            {stats.reservedCount}
          </div>
          <span className="text-[11px] text-amber-600/80 mt-1 block">保留供社友專屬下單</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">常規商品規格</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-900 font-mono">
            {stats.productCount}
          </div>
          <span className="text-[11px] text-indigo-500 mt-1 block">來自四大系列商品變體</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Outlet 特賣單品</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-800 font-mono">
            {stats.outletCount}
          </div>
          <span className="text-[11px] text-emerald-600 mt-1 block">來自 Outlet 孤品出清</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">已售出數量</span>
            <div className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-700 font-mono">
            {stats.soldCount}
          </div>
          <span className="text-[11px] text-gray-400 mt-1 block">特惠已成功被認購</span>
        </div>
      </div>

      {/* 3. Filter & Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="搜尋商品名稱、規格描述、專屬驗證碼 (Promo Code)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            />
          </div>

          {/* Type Tabs */}
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 text-xs font-medium">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                typeFilter === "all"
                  ? "bg-white text-gray-900 shadow-2xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              全部 ({items.length})
            </button>
            <button
              onClick={() => setTypeFilter("product")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                typeFilter === "product"
                  ? "bg-white text-indigo-700 shadow-2xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              常規商品 ({items.filter((i) => i.type === "product").length})
            </button>
            <button
              onClick={() => setTypeFilter("outlet")}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                typeFilter === "outlet"
                  ? "bg-white text-emerald-800 shadow-2xs font-semibold"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Outlet特賣 ({items.filter((i) => i.type === "outlet").length})
            </button>
          </div>

          {/* Status Select */}
          <div className="w-full md:w-44">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
            >
              <option value="all">全部狀態</option>
              <option value="reserved">🟡 長效保留中 (reserved)</option>
              <option value="sold">⚪ 已售出 (sold)</option>
              <option value="available">🟢 現貨可售 (available)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. Table of Social Promo Items */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-2xs overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-gray-400 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-600" />
            <p className="text-sm">正在載入社團特惠商品清單...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-16 px-4 text-center max-w-md mx-auto space-y-3">
            <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
              <Gift className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-800">
              {searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "找不到符合條件的社團特惠商品"
                : "目前尚無任何啟用社團特惠的商品"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              請至「商品編輯」各規格或「Outlet編輯」彈窗中，勾選【啟用社團特惠保留】開關，系統即會自動將該品項設為長效保留並產生專屬行銷驗證碼！
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3.5 w-14 text-center">序號</th>
                  <th className="px-4 py-3.5 min-w-[220px]">商品與規格資訊</th>
                  <th className="px-4 py-3.5 min-w-[120px]">特惠售價</th>
                  <th className="px-4 py-3.5 min-w-[130px]">保留狀態</th>
                  <th className="px-4 py-3.5 min-w-[160px]">專屬驗證碼</th>
                  <th className="px-4 py-3.5 min-w-[240px]">專屬前台直達連結</th>
                  <th className="px-4 py-3.5 text-right min-w-[140px]">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredItems.map((item, index) => {
                  const codeCopyKey = `code_${item.id}`;
                  const linkCopyKey = `link_${item.id}`;
                  const isActionLoading = actionLoadingId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-purple-50/40 transition-colors"
                    >
                      {/* Index */}
                      <td className="px-4 py-3.5 text-center text-xs font-mono text-gray-400">
                        {index + 1}
                      </td>

                      {/* Item Preview & Info */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 overflow-hidden shrink-0">
                            <img
                              src={getImageUrl(item.image)}
                              alt={item.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/logo.png";
                              }}
                            />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              {item.type === "product" ? (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <Layers className="w-2.5 h-2.5" />
                                  常規商品
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <ShoppingBag className="w-2.5 h-2.5" />
                                  Outlet特賣
                                </span>
                              )}
                            </div>
                            <div className="font-semibold text-gray-900 text-sm line-clamp-1">
                              {item.title}
                            </div>
                            <div className="text-xs text-gray-500 font-medium">
                              規格：<span className="text-stone-800">{item.variantName}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="text-sm font-bold text-gray-900 font-mono">
                          NT$ {Number(item.price).toLocaleString()}
                        </div>
                        {item.originalPrice && item.originalPrice > item.price && (
                          <div className="text-[11px] text-gray-400 line-through font-mono">
                            NT$ {Number(item.originalPrice).toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {item.status === "reserved" ? (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
                              社團特惠保留中
                            </span>
                            <span className="block text-[10px] text-purple-700/80">
                              長效鎖定（不限時）
                            </span>
                          </div>
                        ) : item.status === "sold" ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
                            已售出
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            現貨可售
                          </span>
                        )}
                      </td>

                      {/* Promo Code & Copy */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-purple-50 text-purple-900 px-2.5 py-1 rounded-md border border-purple-200 tracking-wider select-all">
                            {item.promoCode || "無驗證碼"}
                          </span>
                          {item.promoCode && (
                            <button
                              type="button"
                              onClick={() => handleCopy(item.promoCode, codeCopyKey)}
                              title="一鍵複製驗證碼"
                              className="p-1.5 bg-gray-100 hover:bg-purple-100 text-gray-600 hover:text-purple-700 rounded-md transition-colors cursor-pointer"
                            >
                              {copiedKey === codeCopyKey ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {copiedKey === codeCopyKey && (
                          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">
                            ✓ 驗證碼已複製到剪貼簿！
                          </span>
                        )}
                      </td>

                      {/* Direct Link & Copy */}
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5 max-w-[280px]">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              readOnly
                              value={item.fullUrl}
                              className="text-xs font-mono bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-600 w-full truncate select-all focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleCopy(item.fullUrl, linkCopyKey)}
                              title="一鍵複製直達連結"
                              className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs font-medium flex items-center gap-1 shrink-0 transition-colors shadow-2xs cursor-pointer"
                            >
                              {copiedKey === linkCopyKey ? (
                                <>
                                  <Check className="w-3 h-3 text-white" />
                                  <span>已複製</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>複製</span>
                                </>
                              )}
                            </button>
                            <a
                              href={item.fullUrl}
                              target="_blank"
                              rel="noreferrer"
                              title="新分頁預覽"
                              className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors shrink-0"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          </div>
                          {copiedKey === linkCopyKey && (
                            <span className="text-[10px] text-emerald-600 font-medium block">
                              ✓ 直達連結已複製！可直接張貼於社團貼文
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-right text-xs">
                        <div className="flex items-center justify-end gap-2">
                          {item.type === "product" && onNavigateToProduct && (
                            <button
                              type="button"
                              onClick={() => onNavigateToProduct(item.sourceId)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors cursor-pointer"
                            >
                              前往編輯
                            </button>
                          )}
                          {item.type === "outlet" && onNavigateToOutlet && (
                            <button
                              type="button"
                              onClick={() => onNavigateToOutlet(item.sourceId)}
                              className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-medium transition-colors cursor-pointer"
                            >
                              前往編輯
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={() => handleReleasePromo(item)}
                            title="關閉社團特惠保留，恢復為一般現貨"
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded font-medium transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isActionLoading ? "處理中..." : "解除保留"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default SocialPromoManager;
