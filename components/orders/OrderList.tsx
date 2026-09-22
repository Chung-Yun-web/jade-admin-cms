import React, { useState } from "react";
import { 
  Printer, 
  Eye, 
  CheckCircle2, 
  Undo2, 
  Store, 
  ShieldCheck, 
  Truck, 
  Search, 
  Calendar,
  AlertCircle,
  Send,
  Check,
  Loader2
} from "lucide-react";
import { Order } from "@/types/order";

interface OrderListProps {
  orders: Order[];
  currentTab: "UNSHIPPED" | "SHIPPED" | "ALL";
  onTabChange: (tab: "UNSHIPPED" | "SHIPPED" | "ALL") => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectOrder: (order: Order) => void;
  onPrintOrder: (order: Order, type?: "INSURED_HOME" | "CVS_STORE") => void;
  onToggleStatus: (order: Order) => Promise<void>;
  onUpdateTrace: (orderNumber: string, trace: string) => Promise<boolean>;
  isLoading: boolean;
}

export const OrderList: React.FC<OrderListProps> = ({
  orders,
  currentTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  onSelectOrder,
  onPrintOrder,
  onToggleStatus,
  onUpdateTrace,
  isLoading,
}) => {
  const [traceInputs, setTraceInputs] = useState<Record<string, string>>({});
  const [savingTrace, setSavingTrace] = useState<Record<string, boolean>>({});
  const [savedTraceFeedback, setSavedTraceFeedback] = useState<Record<string, boolean>>({});

  const handleTraceChange = (orderNumber: string, value: string) => {
    setTraceInputs((prev) => ({
      ...prev,
      [orderNumber]: value,
    }));
  };

  const handleSaveTrace = async (orderNumber: string) => {
    const value = traceInputs[orderNumber] !== undefined ? traceInputs[orderNumber] : "";
    setSavingTrace((prev) => ({ ...prev, [orderNumber]: true }));
    try {
      const ok = await onUpdateTrace(orderNumber, value);
      if (ok) {
        setSavedTraceFeedback((prev) => ({ ...prev, [orderNumber]: true }));
        setTimeout(() => {
          setSavedTraceFeedback((prev) => ({ ...prev, [orderNumber]: false }));
        }, 2500);
      }
    } finally {
      setSavingTrace((prev) => ({ ...prev, [orderNumber]: false }));
    }
  };

  const getLogisticsBadge = (order: Order) => {
    const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
    const isInsured = order.shippingInfo?.method === "INSURED_HOME";

    if (isCvs) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
          <Store className="w-3 h-3 text-purple-600" />
          <span>超商純取貨</span>
        </span>
      );
    }

    if (isInsured) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          <ShieldCheck className="w-3 h-3 text-amber-600" />
          <span>尊榮保價宅配</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
        <Truck className="w-3 h-3 text-blue-600" />
        <span>一般宅配</span>
      </span>
    );
  };

  const formatDate = (dateStr: string | Date) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    } catch {
      return String(dateStr);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Table Control Bar */}
      <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/70">
        {/* 子分頁標籤 Tabs */}
        <div className="flex items-center gap-1 bg-gray-200/70 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onTabChange("UNSHIPPED")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              currentTab === "UNSHIPPED"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            待出貨 (需列印)
          </button>
          <button
            type="button"
            onClick={() => onTabChange("SHIPPED")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              currentTab === "SHIPPED"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            已出貨紀錄 (物流單號)
          </button>
          <button
            type="button"
            onClick={() => onTabChange("ALL")}
            className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              currentTab === "ALL"
                ? "bg-white text-indigo-700 shadow-xs"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            全部已付款訂單
          </button>
        </div>

        {/* 搜尋框 Search Box */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="搜尋訂單編號、顧客姓名、電話、超商門市、物流單號..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg pl-9 pr-8 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 訂單資料表格 Orders Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left text-xs">
          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">訂單編號 / 下單時間</th>
              <th className="py-3 px-4">收件貴賓 / 電話</th>
              <th className="py-3 px-4">物流方式</th>
              <th className="py-3 px-4">配送門市 / 地址</th>
              <th className="py-3 px-4 text-right">訂單保價總額</th>
              <th className="py-3 px-4 text-center">出貨狀態</th>
              {currentTab === "SHIPPED" && (
                <th className="py-3 px-4 min-w-[210px]">物流追蹤單號 (Trace)</th>
              )}
              <th className="py-3 px-4 text-center">出貨操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={currentTab === "SHIPPED" ? 8 : 7} className="text-center py-12 text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-7 h-7 animate-spin text-indigo-500" />
                    <span>正在自 MongoDB 資料庫讀取訂單...</span>
                  </div>
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={currentTab === "SHIPPED" ? 8 : 7} className="text-center py-12 text-gray-500">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">查無符合條件的訂單</span>
                    <span className="text-xs text-gray-400">
                      {searchQuery ? "請嘗試更改搜尋關鍵字" : "目前暫無符合此狀態之訂單"}
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
                const isShipped = order.shippingStatus === "SHIPPED";
                const grandTotal = order.amountInfo?.grandTotal || order.totalAmount || 0;
                const receiverName = order.shippingInfo?.receiverName || order.customerInfo?.name || "收件人";
                const receiverPhone = order.shippingInfo?.receiverPhone || order.customerInfo?.phone || "";
                const currentTrace = traceInputs[order.orderNumber] !== undefined ? traceInputs[order.orderNumber] : (order.trace || "");
                const isSaving = savingTrace[order.orderNumber];
                const isSaved = savedTraceFeedback[order.orderNumber];

                return (
                  <tr
                    key={order._id || order.orderNumber}
                    className="hover:bg-gray-50/80 transition-colors group"
                  >
                    {/* 訂單編號 / 下單時間 */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {order.orderNumber}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span>{formatDate(order.createdAt)}</span>
                      </div>
                    </td>

                    {/* 收件貴賓 / 電話 */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-semibold text-gray-900">{receiverName}</div>
                      <div className="text-gray-500 font-mono text-[11px]">{receiverPhone || "未提供電話"}</div>
                    </td>

                    {/* 物流方式 */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {getLogisticsBadge(order)}
                    </td>

                    {/* 配送門市 / 地址 */}
                    <td className="py-3.5 px-4 max-w-xs">
                      {isCvs ? (
                        <div>
                          <div className="font-bold text-purple-900 flex items-center gap-1">
                            <span>{order.shippingInfo?.storeName || "超商指定門市"}</span>
                            {order.shippingInfo?.storeId && (
                              <span className="text-[10px] bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 text-purple-700 font-mono">
                                店號: {order.shippingInfo.storeId}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate mt-0.5" title={order.shippingInfo?.storeAddress}>
                            {order.shippingInfo?.storeAddress || "（未提供門市地址）"}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-800 font-medium truncate" title={order.shippingInfo?.address || order.customerInfo?.shippingAddress}>
                            {order.shippingInfo?.address || order.customerInfo?.shippingAddress || "（未提供宅配地址）"}
                          </div>
                          <div className="text-[10px] text-amber-600 font-medium mt-0.5">保價專人親交簽收</div>
                        </div>
                      )}
                    </td>

                    {/* 訂單保價總額 */}
                    <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                      <div className="font-bold text-emerald-600 text-sm">
                        NT$ {grandTotal.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {order.items?.length || 1} 件飾品 · 含運
                      </div>
                    </td>

                    {/* 出貨狀態 */}
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      {isShipped ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> 已出貨
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                          待出貨
                        </span>
                      )}
                    </td>

                    {/* 物流追蹤單號輸入框 (已出貨分頁專屬) */}
                    {currentTab === "SHIPPED" && (
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="鍵入物流追蹤單號..."
                            value={currentTrace}
                            onChange={(e) => handleTraceChange(order.orderNumber, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveTrace(order.orderNumber);
                            }}
                            className="bg-white border border-gray-300 rounded px-2.5 py-1 text-xs text-gray-900 font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-36 sm:w-40"
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveTrace(order.orderNumber)}
                            disabled={isSaving}
                            className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 transition-all shadow-xs ${
                              isSaved
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300"
                            }`}
                            title="儲存物流單號至 MongoDB"
                          >
                            {isSaving ? (
                              <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                            ) : isSaved ? (
                              <Check className="w-3 h-3 text-white" />
                            ) : (
                              <Send className="w-3 h-3 text-indigo-600" />
                            )}
                            <span>{isSaved ? "已存" : "儲存"}</span>
                          </button>
                        </div>
                      </td>
                    )}

                    {/* 出貨操作 */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* 預覽與列印按鈕 */}
                        <button
                          type="button"
                          onClick={() => onPrintOrder(order, isCvs ? "CVS_STORE" : "INSURED_HOME")}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold shadow-xs transition-all ${
                            isCvs
                              ? "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                              : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200"
                          }`}
                          title={`列印巧鈺好飾${isCvs ? "超商純取貨貼紙" : "尊榮保價託運單"}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>列印{isCvs ? "超商標籤" : "保價託運單"}</span>
                        </button>

                        {/* 查看詳細資訊按鈕 */}
                        <button
                          type="button"
                          onClick={() => onSelectOrder(order)}
                          className="p-1.5 rounded bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-indigo-600 border border-gray-200 transition-colors"
                          title="查看完整訂單內容與商品明細"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* 狀態手動切換按鈕 */}
                        <button
                          type="button"
                          onClick={() => onToggleStatus(order)}
                          className={`p-1.5 rounded border transition-colors ${
                            isShipped
                              ? "bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-amber-600 border-gray-200"
                              : "bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200"
                          }`}
                          title={isShipped ? "復原為待出貨" : "標記為已出貨 (並連動售出庫存)"}
                        >
                          {isShipped ? <Undo2 className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
