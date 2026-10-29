import React, { useState } from "react";
import { 
  X, 
  Building2, 
  CreditCard, 
  Copy, 
  Check, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ShoppingBag, 
  DollarSign, 
  User, 
  Calendar,
  FileText
} from "lucide-react";
import { PayoutClaim } from "@/types/payout";

interface PayoutDetailModalProps {
  claim: PayoutClaim | null;
  onClose: () => void;
  onApprove: (claimId: string, note?: string) => Promise<void>;
  onReject?: (claimId: string, note?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const PayoutDetailModal: React.FC<PayoutDetailModalProps> = ({
  claim,
  onClose,
  onApprove,
  onReject,
  isSubmitting = false,
}) => {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [note, setNote] = useState<string>("");
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);

  if (!claim) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const isPending = claim.status === "審核中" || claim.status === "pending";
  const isApproved = claim.status === "已撥款" || claim.status === "approved";

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden my-auto border border-stone-200">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-900 tracking-wide">
                  回饋撥款提領詳情
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isApproved
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : isPending
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-gray-100 text-gray-700 border border-gray-200"
                }`}>
                  {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                  {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                  <span>{claim.status}</span>
                </span>
              </div>
              <span className="text-xs text-gray-500 font-mono">
                申請單號：{claim.claimId}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 金融撥款資料重點卡 (Bank Info Highlight) */}
          <div className="bg-gradient-to-br from-emerald-900 via-stone-900 to-[#0B251A] text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-400 font-semibold block mb-1">
                  PAYOUT AMOUNT ｜ 應撥款回饋總額
                </span>
                <div className="text-3xl font-extrabold text-white tracking-wide">
                  NT$ {claim.totalRewardAmount.toLocaleString()}
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-xl px-4 py-2 self-start sm:self-auto text-right">
                <span className="text-[11px] text-stone-300 block">回饋計算比例</span>
                <span className="text-sm font-semibold text-emerald-300">{claim.rewardRate}%</span>
              </div>
            </div>

            {/* 銀行帳號資訊與一鍵複製 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between text-xs text-stone-300 mb-1">
                  <span className="flex items-center gap-1.5 font-light">
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    撥款金融機構
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(claim.bankInfo.bankCodeName, "bank")}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-white transition-colors"
                  >
                    {copiedField === "bank" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>複製</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-sm font-medium text-white tracking-wide">
                  {claim.bankInfo.bankCodeName}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                <div className="flex items-center justify-between text-xs text-stone-300 mb-1">
                  <span className="flex items-center gap-1.5 font-light">
                    <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                    匯款帳號
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(claim.bankInfo.accountNumber, "account")}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-white transition-colors"
                  >
                    {copiedField === "account" ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>已複製</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>複製</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-sm font-mono font-medium text-white tracking-wider">
                  {claim.bankInfo.accountNumber}
                </div>
              </div>
            </div>
          </div>

          {/* 會員基本資料與時間紀錄 */}
          <div className="bg-stone-50 rounded-xl p-4 border border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-1">申請會員</span>
              <span className="font-semibold text-gray-800 text-sm">
                {claim.userName || "未填寫姓名"}
              </span>
              <span className="text-gray-500 block font-mono text-[11px] mt-0.5">
                {claim.userEmail}
              </span>
            </div>
            <div>
              <span className="text-gray-400 block mb-1">申請時間</span>
              <span className="text-gray-700 font-medium">
                {new Date(claim.appliedAt).toLocaleString("zh-TW", { hour12: false })}
              </span>
              {claim.processedAt && (
                <div className="mt-1">
                  <span className="text-gray-400 block text-[11px]">撥款完成時間</span>
                  <span className="text-emerald-700 font-medium">
                    {new Date(claim.processedAt).toLocaleString("zh-TW", { hour12: false })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 包含的訂單與商品明細 (Order Breakdown) */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-gray-500" />
              <span>申請折抵訂單明細（共 {claim.orders?.length || claim.orderNumbers?.length || 0} 筆）</span>
            </h4>

            <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
              {claim.orders && claim.orders.length > 0 ? (
                claim.orders.map((order, idx) => (
                  <div key={idx} className="p-4 bg-white hover:bg-stone-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-gray-800">
                          {order.orderNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(order.orderNumber, `order-${idx}`)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="複製訂單編號"
                        >
                          {copiedField === `order-${idx}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-xs text-gray-600 space-x-3">
                        <span>商品小計：<strong className="text-gray-800">NT$ {order.subtotal.toLocaleString()}</strong></span>
                        <span>回饋金額：<strong className="text-emerald-700 font-semibold">NT$ {order.rewardAmount.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    {/* 商品項目 */}
                    {order.items && order.items.length > 0 && (
                      <div className="space-y-1 pl-2 border-l-2 border-stone-200">
                        {order.items.map((item, itIdx) => (
                          <div key={itIdx} className="text-xs text-gray-500 flex justify-between">
                            <span>{item.name} x{item.quantity}</span>
                            <span>NT$ {(item.price * item.quantity).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-xs text-gray-500">
                  包含訂單編號：{claim.orderNumbers.join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* 審核撥款備註 (Admin Note) */}
          {isPending && (
            <div className="space-y-2">
              <label htmlFor="adminNote" className="block text-xs font-medium text-gray-700">
                審核或撥款備註（可選填，例如轉帳交易序號或出金說明）：
              </label>
              <input
                id="adminNote"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：已由玉山銀行網銀轉帳，交易序號 987654321"
                className="w-full text-xs border border-gray-300 rounded-lg p-2.5 focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600"
              />
            </div>
          )}

          {claim.adminNote && !isPending && (
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-xs">
              <span className="text-gray-400 block mb-0.5">撥款備註紀錄：</span>
              <span className="text-gray-800 font-medium">{claim.adminNote}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            關閉
          </button>

          {isPending && (
            <div className="flex items-center gap-3">
              {onReject && (
                showRejectConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">確定退回？</span>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onReject(claim.claimId, note)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
                    >
                      確認退回
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRejectConfirm(false)}
                      className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRejectConfirm(true)}
                    className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    退回申請
                  </button>
                )
              )}

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => onApprove(claim.claimId, note)}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSubmitting ? "撥款處理中..." : "確認撥款完成"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
