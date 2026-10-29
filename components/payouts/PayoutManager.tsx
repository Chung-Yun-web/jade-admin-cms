"use client";

import React, { useState, useEffect } from "react";
import { 
  DollarSign, 
  Search, 
  Clock, 
  CheckCircle2, 
  RotateCw, 
  Copy, 
  Check, 
  Eye, 
  Building2, 
  CreditCard, 
  ShoppingBag, 
  AlertCircle,
  Filter
} from "lucide-react";
import { PayoutClaim, PayoutStats } from "@/types/payout";
import { PayoutDetailModal } from "./PayoutDetailModal";

interface PayoutManagerProps {
  onRefreshGlobalStats?: () => void;
}

export const PayoutManager: React.FC<PayoutManagerProps> = ({ onRefreshGlobalStats }) => {
  const [payouts, setPayouts] = useState<PayoutClaim[]>([]);
  const [stats, setStats] = useState<PayoutStats>({
    pendingCount: 0,
    pendingAmount: 0,
    completedCount: 0,
    completedAmount: 0,
    totalCount: 0,
    totalAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedClaim, setSelectedClaim] = useState<PayoutClaim | null>(null);
  const [confirmApproveClaim, setConfirmApproveClaim] = useState<PayoutClaim | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Fetch payouts list
  const fetchPayouts = async (status = statusFilter, search = searchQuery) => {
    setIsLoading(true);
    try {
      const url = `/api/admin/payouts?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPayouts(data.payouts || []);
        if (data.stats) {
          setStats(data.stats);
        }
        if (onRefreshGlobalStats) {
          onRefreshGlobalStats();
        }
      } else {
        alert("載入回饋撥款紀錄失敗: " + (data.message || ""));
      }
    } catch (err) {
      console.error("載入回饋撥款出錯:", err);
      alert("載入回饋撥款資料時發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts(statusFilter, searchQuery);
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPayouts(statusFilter, searchQuery);
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  };

  // Approve payout
  const handleApprove = async (claimId: string, note?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          action: "approve",
          note: note || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || "撥款確認成功！");
        setSelectedClaim(null);
        setConfirmApproveClaim(null);
        fetchPayouts(statusFilter, searchQuery);
      } else {
        alert("操作失敗: " + (data.message || ""));
      }
    } catch (err) {
      console.error("確認撥款錯誤:", err);
      alert("執行撥款確認時發生錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reject payout
  const handleReject = async (claimId: string, note?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId,
          action: "reject",
          note: note || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        alert(data.message || "提領申請已退回！");
        setSelectedClaim(null);
        fetchPayouts(statusFilter, searchQuery);
      } else {
        alert("退回失敗: " + (data.message || ""));
      }
    } catch (err) {
      console.error("退回申請出錯:", err);
      alert("執行退回時發生錯誤");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 頂部數據統計看板 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* 待審核撥款 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-amber-200/70 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-amber-700">
              待審核提領 (PENDING)
            </span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-700">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-900">
                {stats.pendingCount}
              </span>
              <span className="text-xs text-amber-700">筆申請</span>
            </div>
            <div className="text-sm font-semibold text-amber-700 mt-1">
              應撥款總額：NT$ {stats.pendingAmount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 已撥款完成 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200/70 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-emerald-700">
              已撥款完成 (COMPLETED)
            </span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-900">
                {stats.completedCount}
              </span>
              <span className="text-xs text-emerald-700">筆撥款</span>
            </div>
            <div className="text-sm font-semibold text-emerald-700 mt-1">
              已發放總額：NT$ {stats.completedAmount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* 累計提領紀錄 */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider font-semibold text-stone-500">
              累計申請統計 (TOTAL)
            </span>
            <div className="p-2 bg-stone-100 rounded-xl text-stone-700">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-stone-900">
                {stats.totalCount}
              </span>
              <span className="text-xs text-stone-500">筆紀錄</span>
            </div>
            <div className="text-sm font-medium text-stone-600 mt-1">
              累計總回饋金額：NT$ {stats.totalAmount.toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* 篩選與搜尋工具列 */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* 狀態切換 Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === "ALL"
                ? "bg-white text-stone-900 shadow-sm font-semibold"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            全部 ({stats.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("審核中")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              statusFilter === "審核中"
                ? "bg-amber-600 text-white shadow-sm font-semibold"
                : "text-amber-700 hover:bg-amber-50"
            }`}
          >
            <span>審核中</span>
            {stats.pendingCount > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                statusFilter === "審核中" ? "bg-amber-800 text-white" : "bg-amber-200 text-amber-900"
              }`}>
                {stats.pendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("已撥款")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
              statusFilter === "已撥款"
                ? "bg-emerald-700 text-white shadow-sm font-semibold"
                : "text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <span>已撥款</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
              statusFilter === "已撥款" ? "bg-emerald-900 text-white" : "bg-emerald-100 text-emerald-800"
            }`}>
              {stats.completedCount}
            </span>
          </button>
        </div>

        {/* 搜尋欄位與重新整理 */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋 Email、姓名、單號或帳號..."
              className="w-full text-xs pl-9 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700 focus:border-emerald-700"
            />
          </div>
          <button
            type="submit"
            className="px-3.5 py-2 text-xs bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-medium transition-colors cursor-pointer"
          >
            搜尋
          </button>
          <button
            type="button"
            onClick={() => {
              setSearchQuery("");
              fetchPayouts(statusFilter, "");
            }}
            title="重新整理"
            className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-xl border border-stone-200 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 撥款提領申請表格 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  申請單號
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  申請會員帳號
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  折抵訂單編號
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  回饋總金額
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  撥款銀行與帳號
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  申請時間
                </th>
                <th className="px-6 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  目前狀態
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex justify-center items-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-emerald-700"></div>
                      <span>載入回饋撥款紀錄中...</span>
                    </div>
                  </td>
                </tr>
              ) : payouts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    尚無符合條件的回饋撥款提領申請紀錄。
                  </td>
                </tr>
              ) : (
                payouts.map((claim) => {
                  const isPending = claim.status === "審核中" || claim.status === "pending";
                  const isApproved = claim.status === "已撥款" || claim.status === "approved";

                  return (
                    <tr key={claim._id} className="hover:bg-stone-50/70 transition-colors">
                      {/* 申請單號 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-medium text-gray-800">
                            {claim.claimId}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(claim.claimId, `claim-${claim._id}`)}
                            className="text-gray-400 hover:text-gray-600"
                            title="複製申請單號"
                          >
                            {copiedKey === `claim-${claim._id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 申請會員 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900">
                          {claim.userName || "未設定姓名"}
                        </div>
                        <div className="text-gray-500 font-mono text-[11px]">
                          {claim.userEmail}
                        </div>
                      </td>

                      {/* 包含訂單 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-stone-700">
                            共 {claim.orderNumbers?.length || 0} 筆
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelectedClaim(claim)}
                            className="text-[11px] text-emerald-700 hover:underline"
                          >
                            檢視明細
                          </button>
                        </div>
                        {claim.orderNumbers && claim.orderNumbers.length > 0 && (
                          <div className="text-gray-400 text-[10px] font-mono truncate max-w-[140px] mt-0.5">
                            {claim.orderNumbers.join(", ")}
                          </div>
                        )}
                      </td>

                      {/* 回饋總金額 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-emerald-700">
                          NT$ {claim.totalRewardAmount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          ({claim.rewardRate}% 回饋)
                        </span>
                      </td>

                      {/* 撥款銀行與帳號 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-800 font-medium">
                          {claim.bankInfo.bankCodeName}
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-500 font-mono text-[11px] mt-0.5">
                          <span>{claim.bankInfo.accountNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(claim.bankInfo.accountNumber, `bank-${claim._id}`)}
                            className="text-gray-400 hover:text-emerald-700"
                            title="複製匯款帳號"
                          >
                            {copiedKey === `bank-${claim._id}` ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* 申請時間 */}
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-[11px]">
                        {new Date(claim.appliedAt).toLocaleString("zh-TW", {
                          hour12: false,
                        })}
                      </td>

                      {/* 目前狀態 */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                          isApproved
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : isPending
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-gray-100 text-gray-700 border border-gray-200"
                        }`}>
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isPending && <Clock className="w-3 h-3 text-amber-600" />}
                          <span>{claim.status}</span>
                        </span>
                      </td>

                      {/* 操作 */}
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <button
                          type="button"
                          onClick={() => setSelectedClaim(claim)}
                          className="px-2.5 py-1.5 text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium transition-colors cursor-pointer"
                        >
                          查看明細
                        </button>

                        {isPending && (
                          <button
                            type="button"
                            onClick={() => setConfirmApproveClaim(claim)}
                            className="px-3 py-1.5 text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg font-medium transition-all shadow-sm cursor-pointer"
                          >
                            確認撥款
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 查看明細彈窗 */}
      {selectedClaim && (
        <PayoutDetailModal
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
          onApprove={handleApprove}
          onReject={handleReject}
          isSubmitting={isSubmitting}
        />
      )}

      {/* 確認撥款快速確認 Dialog */}
      {confirmApproveClaim && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-stone-200">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">確認已完成撥款？</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                您即將確認撥款單號 <span className="font-mono font-semibold text-gray-800">{confirmApproveClaim.claimId}</span>。
              </p>
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-left text-xs space-y-1">
                <div>申請會員：<strong>{confirmApproveClaim.userName || confirmApproveClaim.userEmail}</strong></div>
                <div>應撥款金額：<strong className="text-emerald-700 text-sm">NT$ {confirmApproveClaim.totalRewardAmount.toLocaleString()}</strong></div>
                <div>匯款帳號：<span className="font-mono">{confirmApproveClaim.bankInfo.bankCodeName} {confirmApproveClaim.bankInfo.accountNumber}</span></div>
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg text-left">
                ⚠️ 確認後，系統將此單標記為【已撥款】，並連動更新前台包含的 {confirmApproveClaim.orderNumbers.length} 筆訂單為【回饋已撥款】狀態。
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApproveClaim(null)}
                className="px-4 py-2 border rounded-xl text-xs text-gray-600 hover:bg-gray-50 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleApprove(confirmApproveClaim.claimId)}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow-md disabled:opacity-50"
              >
                {isSubmitting ? "更新中..." : "確認撥款"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
