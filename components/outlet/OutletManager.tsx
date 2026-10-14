"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Plus,
  Search,
  ArrowUpDown,
  Check,
  AlertTriangle,
  Trash2,
  Edit3,
  Clock,
  Sparkles,
  GripVertical,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { OutletItem, OutletStatus } from "@/types/outlet";
import { getImageUrl } from "@/lib/image";
import { OutletModal } from "./OutletModal";

// Sortable Row Item for Drag and Drop
interface SortableOutletRowProps {
  item: OutletItem;
  index: number;
  onEdit: (item: OutletItem) => void;
  onDelete: (item: OutletItem) => void;
  onQuickStatusChange: (item: OutletItem, newStatus: OutletStatus) => void;
  isSorting: boolean;
}

const SortableOutletRow: React.FC<SortableOutletRowProps> = ({
  item,
  index,
  onEdit,
  onDelete,
  onQuickStatusChange,
  isSorting,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item._id || item.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const discountPercent =
    item.originalPrice && item.price && item.originalPrice > item.price
      ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
      : null;

  // Status Badge Helper
  const renderStatusBadge = (status: OutletStatus) => {
    switch (status) {
      case "available":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            現貨可售
          </span>
        );
      case "reserved":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <Clock className="w-3 h-3 mr-1 text-amber-600" />
            預訂保留
          </span>
        );
      case "sold":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
            已售出
          </span>
        );
      case "archived":
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
            已下架封存
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`hover:bg-gray-50/80 transition-colors ${
        item.status === "archived" ? "bg-gray-50/50 opacity-75" : "bg-white"
      }`}
    >
      {/* Drag handle or index */}
      <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-500 w-12">
        {isSorting ? (
          <button
            {...attributes}
            {...listeners}
            className="p-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing hover:bg-gray-100 rounded"
            title="按住拖曳排序"
          >
            <GripVertical className="w-4 h-4" />
          </button>
        ) : (
          <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
        )}
      </td>

      {/* Product Image & Title */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex items-center space-x-3">
          <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
            <img
              src={getImageUrl(item.images?.[0])}
              alt={item.title}
              className="w-full h-full object-cover"
            />
            {item.images && item.images.length > 1 && (
              <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl font-bold">
                +{item.images.length - 1}
              </span>
            )}
          </div>
          <div className="min-w-0 max-w-xs sm:max-w-sm">
            <p className="text-sm font-bold text-gray-900 truncate" title={item.title}>
              {item.title}
            </p>
            <p className="text-xs text-gray-500 font-mono truncate">{item.slug}</p>
            {item.sourceNote && (
              <span className="inline-block mt-1 text-[11px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100 truncate max-w-full">
                {item.sourceNote}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Material */}
      <td className="px-4 py-4 text-xs text-gray-600 max-w-[180px] hidden md:table-cell">
        <span className="line-clamp-2" title={item.material || "-"}>
          {item.material || "-"}
        </span>
      </td>

      {/* Pricing */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-emerald-700">
            NT$ {item.price.toLocaleString()}
          </span>
          {item.originalPrice ? (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="line-through">NT$ {item.originalPrice.toLocaleString()}</span>
              {discountPercent !== null && discountPercent > 0 && (
                <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-1 rounded">
                  -{discountPercent}%
                </span>
              )}
            </div>
          ) : null}
        </div>
      </td>

      {/* Status & Reserved info */}
      <td className="px-4 py-4 whitespace-nowrap">
        <div className="space-y-1">
          {renderStatusBadge(item.status)}
          {item.status === "reserved" && item.reservedUntil && (
            <p className="text-[10px] text-amber-700 flex items-center gap-0.5" title={new Date(item.reservedUntil).toLocaleString()}>
              <Clock className="w-3 h-3" />
              <span>保留至: {new Date(item.reservedUntil).toLocaleDateString()}</span>
            </p>
          )}
        </div>
      </td>

      {/* Quick Status Selector */}
      <td className="px-4 py-4 whitespace-nowrap text-xs">
        <select
          value={item.status}
          onChange={(e) => onQuickStatusChange(item, e.target.value as OutletStatus)}
          className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-700 bg-white hover:border-gray-300 focus:ring-1 focus:ring-emerald-500"
        >
          <option value="available">現貨可售</option>
          <option value="reserved">預訂保留</option>
          <option value="sold">已售出</option>
          <option value="archived">下架封存</option>
        </select>
      </td>

      {/* Actions */}
      <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 rounded-md transition-colors"
            title="編輯此單品"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item)}
            className="p-1.5 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors"
            title="刪除此單品"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

export const OutletManager: React.FC = () => {
  const [outlets, setOutlets] = useState<OutletItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  // Sorting Mode State
  const [isSortingMode, setIsSortingMode] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<Partial<OutletItem> | null>(null);

  // Delete Confirmation State
  const [deletingOutlet, setDeletingOutlet] = useState<OutletItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Seed State
  const [isSeeding, setIsSeeding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch Outlets
  const fetchOutlets = async () => {
    try {
      const res = await fetch("/api/admin/outlets");
      const data = await res.json();
      if (data.success) {
        setOutlets(data.outlets || []);
      } else {
        alert("載入 Outlet 資料失敗: " + (data.message || ""));
      }
    } catch (err: unknown) {
      console.error("載入 Outlet 錯誤:", err);
      alert("載入 Outlet 發生錯誤！");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    async function loadInitial() {
      try {
        const res = await fetch("/api/admin/outlets");
        const data = await res.json();
        if (!ignore && data.success) {
          setOutlets(data.outlets || []);
        }
      } catch (err: unknown) {
        console.error("載入 Outlet 錯誤:", err);
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }
    loadInitial();
    return () => {
      ignore = true;
    };
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = outlets.length;
    const available = outlets.filter((o) => o.status === "available").length;
    const reserved = outlets.filter((o) => o.status === "reserved").length;
    const sold = outlets.filter((o) => o.status === "sold").length;
    const archived = outlets.filter((o) => o.status === "archived").length;
    return { total, available, reserved, sold, archived };
  }, [outlets]);

  // Filtered List
  const filteredOutlets = useMemo(() => {
    return outlets.filter((item) => {
      // 1. Archived toggle
      if (!showArchived && item.status === "archived" && filterStatus !== "archived") {
        return false;
      }

      // 2. Status tab filter
      if (filterStatus !== "ALL" && item.status !== filterStatus) {
        return false;
      }

      // 3. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(q);
        const matchesSlug = item.slug?.toLowerCase().includes(q);
        const matchesMaterial = item.material?.toLowerCase().includes(q);
        const matchesSource = item.sourceNote?.toLowerCase().includes(q);
        return matchesTitle || matchesSlug || matchesMaterial || matchesSource;
      }

      return true;
    });
  }, [outlets, filterStatus, searchQuery, showArchived]);

  // Drag and Drop End handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = outlets.findIndex((o) => (o._id || o.slug) === active.id);
    const newIndex = outlets.findIndex((o) => (o._id || o.slug) === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const reordered = arrayMove(outlets, oldIndex, newIndex).map((item, idx) => ({
        ...item,
        sortOrder: idx,
      }));
      setOutlets(reordered);
    }
  };

  // Save Reordered Order
  const handleSaveOrder = async () => {
    setIsSavingOrder(true);
    try {
      const orders = outlets.map((o, idx) => ({
        id: o._id,
        sortOrder: idx,
      }));

      const res = await fetch("/api/admin/outlets/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });

      const data = await res.json();
      if (data.success) {
        alert("Outlet 商品排序已成功儲存！");
        setIsSortingMode(false);
        fetchOutlets();
      } else {
        alert("排序儲存失敗: " + (data.message || ""));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      alert("儲存排序出錯：" + message);
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Quick Status Change
  const handleQuickStatusChange = async (item: OutletItem, newStatus: OutletStatus) => {
    try {
      const res = await fetch("/api/admin/outlets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _id: item._id,
          status: newStatus,
          title: item.title,
          slug: item.slug,
          price: item.price,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOutlets((prev) =>
          prev.map((o) => (o._id === item._id ? { ...o, status: newStatus } : o))
        );
      } else {
        alert("更新狀態失敗: " + (data.message || ""));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      alert("更新狀態時發生錯誤：" + message);
    }
  };

  // Save Modal (Create / Update)
  const handleSaveOutlet = async (formData: Partial<OutletItem>): Promise<boolean> => {
    const isEdit = Boolean(formData._id);
    try {
      const res = await fetch("/api/admin/outlets", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (data.success) {
        alert(isEdit ? "Outlet 商品已成功更新！" : "Outlet 商品已成功建立！");
        fetchOutlets();
        return true;
      } else {
        alert(`儲存失敗: ${data.message || "未知原因"}`);
        return false;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      alert("儲存 Outlet 出錯：" + message);
      return false;
    }
  };

  // Delete
  const handleConfirmDelete = async () => {
    if (!deletingOutlet || !deletingOutlet._id) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/outlets?id=${deletingOutlet._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        alert("Outlet 商品已成功刪除！");
        setDeletingOutlet(null);
        fetchOutlets();
      } else {
        alert("刪除失敗: " + (data.message || ""));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      alert("刪除商品時發生錯誤：" + message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Trigger Seed / Import sample data
  const handleSeedData = async () => {
    if (!confirm("確定要從現有的 Product 集合中挑選 6 件特色翡翠商品作為 Outlet 初始測試資料嗎？")) {
      return;
    }
    setIsSeeding(true);
    try {
      const res = await fetch("/api/admin/outlets/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || "成功匯入測試資料！");
        fetchOutlets();
      } else {
        alert(data.message || "匯入失敗");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "未知錯誤";
      alert("匯入測試資料出錯：" + message);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 1. Header & Stats Section */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-xs border border-gray-100 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            全部特賣商品
          </span>
          <span className="text-3xl font-extrabold text-gray-900 mt-2">{stats.total}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-emerald-100 flex flex-col justify-between">
          <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            現貨可售 (available)
          </span>
          <span className="text-3xl font-extrabold text-emerald-600 mt-2">{stats.available}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-amber-100 flex flex-col justify-between">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            預訂保留 (reserved)
          </span>
          <span className="text-3xl font-extrabold text-amber-600 mt-2">{stats.reserved}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-gray-100 flex flex-col justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            已售出 (sold)
          </span>
          <span className="text-3xl font-extrabold text-gray-600 mt-2">{stats.sold}</span>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-xs border border-rose-100 flex flex-col justify-between col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
            已下架封存 (archived)
          </span>
          <span className="text-3xl font-extrabold text-rose-600 mt-2">{stats.archived}</span>
        </div>
      </div>

      {/* 2. Action Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl shadow-xs border border-gray-200/80 flex flex-col lg:flex-row gap-4 justify-between items-stretch lg:items-center">
        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center flex-1">
          {/* Search Box */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="搜尋標題、Slug、材質、來源..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium space-x-1 overflow-x-auto">
            {[
              { key: "ALL", label: "全部" },
              { key: "available", label: "現貨" },
              { key: "reserved", label: "預訂中" },
              { key: "sold", label: "已售出" },
              { key: "archived", label: "已封存" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilterStatus(tab.key)}
                className={`px-3 py-1.5 rounded-md whitespace-nowrap transition-colors ${
                  filterStatus === tab.key
                    ? "bg-white text-emerald-800 font-bold shadow-2xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Show Archived Checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600 select-none px-1">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 accent-emerald-600"
            />
            <span>顯示已封存項目</span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-end">
          {/* Seed Button if empty or desired */}
          {outlets.length === 0 && (
            <button
              onClick={handleSeedData}
              disabled={isSeeding}
              className="px-3 py-2 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>匯入初始特賣資料</span>
            </button>
          )}

          {/* Reorder Button */}
          {outlets.length > 1 && (
            isSortingMode ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsSortingMode(false);
                    fetchOutlets();
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  取消排序
                </button>
                <button
                  onClick={handleSaveOrder}
                  disabled={isSavingOrder}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>儲存新排序</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsSortingMode(true)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>調整自訂排序</span>
              </button>
            )
          )}

          {/* Add New Outlet Item Button */}
          <button
            onClick={() => {
              setEditingOutlet(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>新增 Outlet 單品</span>
          </button>
        </div>
      </div>

      {/* Sorting Banner Tip */}
      {isSortingMode && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-indigo-600 animate-bounce" />
            <span>
              已啟用自訂排序模式：請透過最左側拖曳把手 <GripVertical className="inline w-3.5 h-3.5" /> 上下拖曳商品以排列順序，調整完畢後請點擊右上角「儲存新排序」。
            </span>
          </div>
        </div>
      )}

      {/* 3. Outlet Table List */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200/80 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <span className="ml-3 text-sm text-gray-500 font-medium">正在載入 Outlet 商品資料...</span>
          </div>
        ) : filteredOutlets.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="inline-flex p-4 rounded-full bg-emerald-50 text-emerald-600">
              <Sparkles className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-gray-800">
              {outlets.length === 0 ? "目前尚無 Outlet 特賣商品" : "找不到符合篩選條件的商品"}
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {outlets.length === 0
                ? "您可以點擊上方「新增 Outlet 單品」自訂特賣項目，或點擊「匯入初始特賣資料」從現有商品集合一鍵建立示範資料。"
                : "請嘗試切換狀態篩選標籤或清除搜尋關鍵字。"}
            </p>
            {outlets.length === 0 && (
              <div className="pt-2">
                <button
                  onClick={handleSeedData}
                  disabled={isSeeding}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs inline-flex items-center gap-1.5"
                >
                  {isSeeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>立即匯入 6 筆初始特賣商品</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50/75 text-gray-600 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">{isSortingMode ? "拖曳" : "序號"}</th>
                    <th className="px-4 py-3 text-left">商品資訊 (名稱 / Slug / 來源)</th>
                    <th className="px-4 py-3 text-left hidden md:table-cell">規格材質說明</th>
                    <th className="px-4 py-3 text-left">特惠價格 / 原價</th>
                    <th className="px-4 py-3 text-left">販售狀態</th>
                    <th className="px-4 py-3 text-left">快速切換狀態</th>
                    <th className="px-4 py-3 text-right">管理操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  <SortableContext
                    items={filteredOutlets.map((o) => o._id || o.slug)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredOutlets.map((item, index) => (
                      <SortableOutletRow
                        key={item._id || item.slug}
                        item={item}
                        index={index}
                        isSorting={isSortingMode}
                        onEdit={(target) => {
                          setEditingOutlet(target);
                          setIsModalOpen(true);
                        }}
                        onDelete={(target) => setDeletingOutlet(target)}
                        onQuickStatusChange={handleQuickStatusChange}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          </div>
        )}
      </div>

      {/* 4. Edit/Create Modal (Keyed by target ID or 'create' to cleanly reinitialize state) */}
      {isModalOpen && (
        <OutletModal
          key={editingOutlet?._id || "create"}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingOutlet(null);
          }}
          outlet={editingOutlet}
          onSave={handleSaveOutlet}
        />
      )}

      {/* 5. Delete Confirmation Modal */}
      {deletingOutlet && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-5 border border-gray-100">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">確認刪除 Outlet 商品？</h3>
                <p className="text-xs text-gray-500">此動作將永久移除該特賣單品，無法復原。</p>
              </div>
            </div>

            <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs space-y-1.5">
              <p className="text-gray-900 font-bold">{deletingOutlet.title}</p>
              <p className="text-gray-500 font-mono">Slug: {deletingOutlet.slug}</p>
              <p className="text-emerald-700 font-semibold">
                特惠售價：NT$ {deletingOutlet.price.toLocaleString()}
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingOutlet(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>確認永久刪除</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
