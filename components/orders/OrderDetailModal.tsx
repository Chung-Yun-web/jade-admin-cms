import React, { useState, useEffect } from "react";
import { 
  X, 
  Package, 
  CreditCard, 
  ShieldCheck, 
  Store,
  Truck,
  Printer,
  CheckCircle2,
  Undo2,
  Save,
  Check,
  Loader2,
  Calendar
} from "lucide-react";
import { Order } from "@/types/order";

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onPrint: (order: Order, type: "INSURED_HOME" | "CVS_STORE") => void;
  onToggleStatus: (order: Order) => Promise<void>;
  onUpdateTrace: (orderNumber: string, trace: string) => Promise<boolean>;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onPrint,
  onToggleStatus,
  onUpdateTrace,
}) => {
  const [traceValue, setTraceValue] = useState<string>("");
  const [isSavingTrace, setIsSavingTrace] = useState<boolean>(false);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState<boolean>(false);

  useEffect(() => {
    if (order) {
      setTraceValue(order.trace || "");
      setIsSaved(false);
    }
  }, [order]);

  if (!order) return null;

  const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
  const isShipped = order.shippingStatus === "SHIPPED";
  const grandTotal = order.amountInfo?.grandTotal || order.totalAmount || 0;
  const shippingFee = order.amountInfo?.shippingFee ?? (isCvs ? 60 : 100);
  const subtotal = order.amountInfo?.subtotal || Math.max(0, grandTotal - shippingFee);

  const receiverName = order.shippingInfo?.receiverName || order.customerInfo?.name || "收件人";
  const receiverPhone = order.shippingInfo?.receiverPhone || order.customerInfo?.phone || "";
  const address = order.shippingInfo?.address || order.customerInfo?.shippingAddress || "";

  const formatDate = (dateStr: string | Date | null | undefined) => {
    if (!dateStr) return "無紀錄";
    try {
      return new Date(dateStr).toLocaleString("zh-TW", { hour12: false });
    } catch {
      return String(dateStr);
    }
  };

  const handleSaveTrace = async () => {
    if (!onUpdateTrace) return;
    setIsSavingTrace(true);
    try {
      const ok = await onUpdateTrace(order.orderNumber, traceValue);
      if (ok) {
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2500);
      }
    } finally {
      setIsSavingTrace(false);
    }
  };

  const handleToggle = async () => {
    setIsTogglingStatus(true);
    try {
      await onToggleStatus(order);
    } finally {
      setIsTogglingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900 font-mono">
                  {order.orderNumber}
                </h3>
                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                    isShipped
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  }`}
                >
                  {isShipped ? "已出貨 (SHIPPED)" : "待出貨 (UNSHIPPED)"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>下單時間：{formatDate(order.createdAt)}</span>
                {order.shippedAt && (
                  <span className="text-emerald-600">· 出貨於：{formatDate(order.shippedAt)}</span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-sm">
          {/* 物流與收件資訊 */}
          <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-gray-200/80 pb-2.5">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-sm">
                {isCvs ? (
                  <Store className="w-4 h-4 text-purple-600" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                )}
                <span>物流與收件資訊 ({isCvs ? "超商純取貨" : "尊榮保值宅配"})</span>
              </div>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                isCvs 
                  ? "bg-purple-50 text-purple-700 border-purple-200" 
                  : "bg-amber-50 text-amber-700 border-amber-200"
              }`}>
                {order.shippingInfo?.methodName || (isCvs ? "超商純取貨" : "保值宅配")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block mb-0.5">收件人姓名</span>
                <span className="font-semibold text-gray-800 text-sm">{receiverName}</span>
              </div>
              <div>
                <span className="text-gray-400 block mb-0.5">聯絡電話</span>
                <span className="font-mono text-gray-800 font-medium text-sm">{receiverPhone || "未提供電話"}</span>
              </div>
              {order.customerInfo?.email && (
                <div className="sm:col-span-2">
                  <span className="text-gray-400 block mb-0.5">顧客 Email</span>
                  <span className="text-gray-700 font-mono">{order.customerInfo.email}</span>
                </div>
              )}

              {/* 門市或地址 */}
              {isCvs ? (
                <div className="sm:col-span-2 bg-purple-50/50 border border-purple-100 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-purple-900 text-sm">
                      {order.shippingInfo?.storeName || "超商指定門市"}
                    </span>
                    {order.shippingInfo?.storeId && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-mono font-semibold">
                        門市店號: {order.shippingInfo.storeId}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-600 mt-1">
                    {order.shippingInfo?.storeAddress || "（請參閱門市系統資料）"}
                  </div>
                </div>
              ) : (
                <div className="sm:col-span-2 bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                  <span className="text-gray-400 block text-xs mb-0.5">宅配配送地址</span>
                  <span className="font-medium text-gray-800">
                    {address || "（未填寫地址）"}
                  </span>
                  <div className="text-xs text-amber-700 mt-1 font-medium">
                    ★ 巧鈺好飾高額全保價 · 專人親交本人簽收
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 購買商品明細 */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 font-semibold text-xs text-gray-700 flex justify-between">
              <span>購買飾品明細 ({order.items?.length || 0} 件)</span>
              <span>單價 × 數量</span>
            </div>
            <div className="divide-y divide-gray-100">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-gray-50/50">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-mono font-bold text-xs">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                      {item.spec && (
                        <span className="inline-block mt-0.5 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          款式規格: {item.spec}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-gray-900">
                      NT$ {(item.price || 0).toLocaleString()} × {item.quantity || 1}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">
                      小計 NT$ {((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 付款與金額明細 */}
          <div className="bg-gray-50/70 border border-gray-200 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold text-gray-800 text-sm border-b border-gray-200 pb-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>付款與金額明細</span>
              </div>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-xs">
                已全額付款 (PAID)
              </span>
            </div>
            <div className="flex justify-between text-gray-600 pt-1">
              <span>商品小計</span>
              <span className="font-mono font-semibold">NT$ {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>物流運費</span>
              <span className="font-mono font-semibold">NT$ {shippingFee.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2">
              <span>應付與實付總額</span>
              <span className="font-mono text-emerald-600">NT$ {grandTotal.toLocaleString()}</span>
            </div>
            {order.paymentInfo?.tradeNo && (
              <div className="text-[11px] text-gray-400 pt-1 font-mono">
                金流交易序號: {order.paymentInfo.tradeNo}
              </div>
            )}
          </div>

          {/* 物流追蹤單號 (Trace) 填寫維護區 */}
          <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-bold text-gray-800">
              🚚 物流追蹤單號 (Trace Number)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={traceValue}
                onChange={(e) => setTraceValue(e.target.value)}
                placeholder="請輸入黑貓 / 宅配通 / 超商交寄單號..."
                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleSaveTrace}
                disabled={isSavingTrace}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs ${
                  isSaved
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                }`}
              >
                {isSavingTrace ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isSaved ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaved ? "已成功儲存" : "儲存單號"}</span>
              </button>
            </div>
            <p className="text-[11px] text-gray-500">
              儲存後顧客可於前台查詢該訂單即時包裹動態。
            </p>
          </div>
        </div>

        {/* Footer 操作列 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          {/* 左側：狀態切換按鍵 */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isTogglingStatus}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors shadow-xs ${
              isShipped
                ? "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                : "bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
            }`}
          >
            {isTogglingStatus ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isShipped ? (
              <Undo2 className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>{isShipped ? "復原為待出貨" : "標記為已出貨 (並連動售出庫存)"}</span>
          </button>

          {/* 右側：列印與關閉按鍵 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(order, isCvs ? "CVS_STORE" : "INSURED_HOME")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs transition-colors ${
                isCvs
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>列印{isCvs ? "超商標籤" : "保價託運單"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
