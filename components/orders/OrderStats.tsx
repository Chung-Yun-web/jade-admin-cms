import React from "react";
import { Package, ShieldCheck, Store, CheckCircle, DollarSign } from "lucide-react";
import { OrderStatsData } from "@/types/order";

interface OrderStatsProps {
  stats: OrderStatsData;
}

export const OrderStats: React.FC<OrderStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* 1. 待出貨訂單 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:border-emerald-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">待出貨訂單</span>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Package className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold text-emerald-600 font-mono">
            {stats.unshippedCount} <span className="text-sm font-normal text-gray-400">筆</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">待列印出貨單與交寄</p>
        </div>
      </div>

      {/* 2. 待出貨保價總額 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:border-amber-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">待出貨保價總額</span>
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold text-amber-600 font-mono">
            NT$ {stats.unshippedTotal.toLocaleString()}
          </div>
          <p className="text-xs text-gray-400 mt-1">已完成付款全額保價</p>
        </div>
      </div>

      {/* 3. 物流方式分佈 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:border-indigo-200 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">物流方式分佈</span>
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex items-center gap-3 font-mono text-sm">
            <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-100 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> 宅配 {stats.insuredHomeCount}
            </span>
            <span className="inline-flex items-center gap-1 text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-100 font-bold">
              <Store className="w-3.5 h-3.5" /> 超商 {stats.cvsCount}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">保值宅配單 / 超商取貨貼紙</p>
        </div>
      </div>

      {/* 4. 歷史已出貨 */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between hover:border-gray-300 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">歷史已出貨</span>
          <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-4">
          <div className="text-3xl font-bold text-gray-800 font-mono">
            {stats.shippedCount} <span className="text-sm font-normal text-gray-400">筆</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">含物流追蹤單號紀錄</p>
        </div>
      </div>
    </div>
  );
};
