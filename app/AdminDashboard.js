"use client";

import { useState, useEffect } from "react";
import { getImageUrl } from "@/lib/image";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { OrderStats } from "@/components/orders/OrderStats";
import { OrderList } from "@/components/orders/OrderList";
import { OrderDetailModal } from "@/components/orders/OrderDetailModal";
import { PrintPreviewModal } from "@/components/orders/PrintPreviewModal";

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState("products"); // "products" | "crafts" | "orders" | "members"
  const [productsData, setProductsData] = useState({ series: [], products: [] });
  const [craftsData, setCraftsData] = useState({ categories: [], crafts: [] });
  const [membersData, setMembersData] = useState({ members: [], stats: { generalCount: 0, partnerCount: 0, totalMembers: 0, adminRoleCount: 0 } });
  
  // Orders State
  const [orders, setOrders] = useState([]);
  const [ordersStats, setOrdersStats] = useState({
    unshippedCount: 0,
    unshippedTotal: 0,
    insuredHomeCount: 0,
    cvsCount: 0,
    shippedCount: 0,
  });
  const [ordersTab, setOrdersTab] = useState("UNSHIPPED");
  const [ordersSearch, setOrdersSearch] = useState("");
  const [detailOrder, setDetailOrder] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const [printInitialType, setPrintInitialType] = useState("INSURED_HOME");
  const [isOrdersLoading, setIsOrdersLoading] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [isSortingMode, setIsSortingMode] = useState(false);
  
  // Modal States
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingCraft, setEditingCraft] = useState(null);
  const [confirmingMember, setConfirmingMember] = useState(null);
  const [confirmingRoleMember, setConfirmingRoleMember] = useState(null);
  const [editingSeries, setEditingSeries] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingVariantIndex, setUploadingVariantIndex] = useState(null);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadingCraftImage, setUploadingCraftImage] = useState(false);
  const [uploadingSeriesImage, setUploadingSeriesImage] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event, seriesId) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Filter products in this series
    const seriesProducts = productsData.products.filter(
      (p) => String(p.seriesId) === String(seriesId)
    );

    const oldIndex = seriesProducts.findIndex((p) => String(p._id) === String(active.id));
    const newIndex = seriesProducts.findIndex((p) => String(p._id) === String(over.id));

    if (oldIndex !== -1 && newIndex !== -1) {
      const reorderedSeriesProducts = arrayMove(seriesProducts, oldIndex, newIndex);

      // Map back into productsData.products, updating sort_order
      const newProductsList = productsData.products.map((p) => {
        if (String(p.seriesId) === String(seriesId)) {
          const idx = reorderedSeriesProducts.findIndex((rp) => String(rp._id) === String(p._id));
          return {
            ...p,
            sort_order: idx
          };
        }
        return p;
      });

      setProductsData({
        ...productsData,
        products: newProductsList
      });
    }
  };

  const handleSaveProductOrder = async () => {
    setIsSubmitting(true);
    try {
      const orders = productsData.products.map((p) => ({
        id: p._id,
        sort_order: p.sort_order === undefined ? 0 : Number(p.sort_order)
      }));

      const res = await fetch("/api/admin/products/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const data = await res.json();
      if (data.success) {
        alert("款式順序儲存成功！");
        setIsSortingMode(false);
        fetchData();
      } else {
        alert("排序儲存失敗: " + data.message);
      }
    } catch (err) {
      alert("儲存排序時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const moveVariant = (index, direction) => {
    if (!editingProduct || !editingProduct.variants) return;
    const newVariants = [...editingProduct.variants];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newVariants.length) return;

    // Swap elements
    const temp = newVariants[index];
    newVariants[index] = newVariants[targetIndex];
    newVariants[targetIndex] = temp;

    // Reassign sort_order based on new indices
    newVariants.forEach((variant, idx) => {
      variant.sort_order = idx;
    });

    setEditingProduct({
      ...editingProduct,
      variants: newVariants
    });
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === "products") {
        const res = await fetch("/api/admin/products");
        const data = await res.json();
        if (data.success) {
          setProductsData({ series: data.series || [], products: data.products || [] });
        }
      } else if (activeTab === "crafts") {
        const res = await fetch("/api/admin/crafts");
        const data = await res.json();
        if (data.success) {
          setCraftsData({ categories: data.categories || [], crafts: data.crafts || [] });
        }
      } else if (activeTab === "orders") {
        await fetchOrders(ordersTab, ordersSearch);
      } else if (activeTab === "members") {
        const res = await fetch("/api/admin/members");
        const data = await res.json();
        if (data.success) {
          setMembersData({
            members: data.members || [],
            stats: data.stats || { generalCount: 0, partnerCount: 0, totalMembers: 0, adminRoleCount: 0 },
          });
        }
      }
    } catch (err) {
      console.error("載入資料失敗:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOrders = async (tab = ordersTab, query = ordersSearch) => {
    setIsOrdersLoading(true);
    try {
      const res = await fetch(`/api/admin/orders?tab=${tab}&search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
        if (data.stats) {
          setOrdersStats(data.stats);
        }
      } else {
        alert("載入訂單失敗: " + (data.message || ""));
      }
    } catch (err) {
      console.error("載入訂單資料出錯:", err);
    } finally {
      setIsOrdersLoading(false);
    }
  };

  const handleToggleOrderStatus = async (order) => {
    const nextStatus = order.shippingStatus === "SHIPPED" ? "UNSHIPPED" : "SHIPPED";
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: order.orderNumber, shippingStatus: nextStatus }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`訂單 ${order.orderNumber} 狀態已更新為【${nextStatus === "SHIPPED" ? "已出貨 (並連動更新規格庫存為售出)" : "待出貨"}】！`);
        fetchOrders(ordersTab, ordersSearch);
        if (detailOrder && detailOrder.orderNumber === order.orderNumber) {
          setDetailOrder({
            ...detailOrder,
            shippingStatus: nextStatus,
            shippedAt: nextStatus === "SHIPPED" ? new Date().toISOString() : null,
          });
        }
      } else {
        alert(`更新狀態失敗: ${data.message}`);
      }
    } catch (err) {
      console.error("更新訂單狀態錯誤:", err);
      alert("更新訂單狀態時發生錯誤！");
    }
  };

  const handleUpdateOrderTrace = async (orderNumber, trace) => {
    try {
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber, trace }),
      });
      const data = await res.json();
      if (data.success) {
        fetchOrders(ordersTab, ordersSearch);
        if (detailOrder && detailOrder.orderNumber === orderNumber) {
          setDetailOrder({
            ...detailOrder,
            trace: trace,
          });
        }
        return true;
      } else {
        alert(`儲存物流單號失敗: ${data.message}`);
      }
    } catch (err) {
      console.error("儲存物流單號出錯:", err);
      alert("儲存物流單號時發生錯誤！");
    }
    return false;
  };

  const handleOpenPrint = (order, type) => {
    const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
    const targetType = type || (isCvs ? "CVS_STORE" : "INSURED_HOME");
    setPrintInitialType(targetType);
    setPrintOrder(order);
  };

  const handleUpgradeMember = async () => {
    if (!confirmingMember) return;
    const targetStatus = confirmingMember.targetStatus || "partner";
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: confirmingMember._id, member: targetStatus }),
      });
      const data = await res.json();
      if (data.success) {
        alert(targetStatus === "partner" ? "會員已成功升級為商店會員！" : "會員已成功降級為一般會員！");
        setConfirmingMember(null);
        fetchData();
      } else {
        alert(`更新失敗: ${data.message}`);
      }
    } catch (err) {
      alert("更新會員身份時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleChange = async () => {
    if (!confirmingRoleMember) return;
    const targetRole = confirmingRoleMember.targetRole || "admin";
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: confirmingRoleMember._id, role: targetRole }),
      });
      const data = await res.json();
      if (data.success) {
        alert(targetRole === "admin" ? "已成功設定為管理員 (admin)！" : "已成功設定為一般權限 (general)！");
        setConfirmingRoleMember(null);
        fetchData();
      } else {
        alert(`更新失敗: ${data.message}`);
      }
    } catch (err) {
      alert("更新管理員權限時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeriesSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        _id: editingSeries._id,
        name: editingSeries.name,
        description: editingSeries.description,
        image: editingSeries.image,
        tabs: editingSeries.tabs
      };
      const res = await fetch("/api/admin/series", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        alert("系列子題更新成功！");
        setEditingSeries(null);
        fetchData();
      } else {
        alert(`更新失敗: ${data.message}`);
      }
    } catch (err) {
      alert("儲存系列子題時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSeriesImageUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingSeriesImage(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("productId", "series");
    fd.append("variantId", editingSeries?.originalId || "temp");
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.success && d.url) {
        setEditingSeries({ ...editingSeries, image: d.url });
      } else {
        alert("上傳失敗: " + (d.message || ""));
      }
    } catch (err) {
      alert("上傳出錯：" + err.message);
    } finally {
      setUploadingSeriesImage(false);
    }
  };

  const handleMainImageUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingMainImage(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("productId", editingProduct?.originalId || "temp");
    fd.append("variantId", "main");
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.success && d.url) {
        setEditingProduct({ ...editingProduct, image: d.url });
      } else {
        alert("上傳失敗: " + (d.message || ""));
      }
    } catch (err) {
      alert("上傳出錯：" + err.message);
    } finally {
      setUploadingMainImage(false);
    }
  };

  const handleCraftImageUpload = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingCraftImage(true);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("productId", "crafts");
    fd.append("variantId", editingCraft?.id || "temp");
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const d = await res.json();
      if (d.success && d.url) {
        setEditingCraft({ ...editingCraft, image: d.url });
      } else {
        alert("上傳失敗: " + (d.message || ""));
      }
    } catch (err) {
      alert("上傳出錯：" + err.message);
    } finally {
      setUploadingCraftImage(false);
    }
  };

  const handleProductSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isEdit = !!editingProduct._id;
      
      // Clean up product structure for MongoDB compatibility and correctness
      const cleanedProduct = { ...editingProduct };
      
      // Clear out unused fields to avoid column residue
      cleanedProduct.detailImages = [];
      cleanedProduct.policy = null;
      cleanedProduct.category = cleanedProduct.category || null;
      
      // Ensure prices are numbers
      cleanedProduct.basePrice = Number(cleanedProduct.basePrice) || 0;
      
      // Ensure product status is set
      cleanedProduct.status = cleanedProduct.status || "available";

      // Clean variants array
      if (cleanedProduct.variants && Array.isArray(cleanedProduct.variants)) {
        cleanedProduct.variants = cleanedProduct.variants.map((v, idx) => ({
          name: v.name || "",
          price: Number(v.price) || 0,
          image: v.image || "",
          images: Array.isArray(v.images) ? v.images.filter(Boolean) : (v.image ? [v.image] : []),
          status: v.status || "available",
          type: v.type || "ready_made",
          sort_order: v.sort_order === undefined ? idx : Number(v.sort_order),
          custom_notice: v.custom_notice || "",
          ready_made_note: v.ready_made_note || "",
          lead_time_days: v.lead_time_days === undefined ? 10 : Number(v.lead_time_days)
        }));
      } else {
        cleanedProduct.variants = [];
      }
      
      // Ensure craftIds is an array
      if (!Array.isArray(cleanedProduct.craftIds)) {
        cleanedProduct.craftIds = [];
      }

      const res = await fetch("/api/admin/products", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedProduct),
      });
      const data = await res.json();
      if (data.success) {
        alert(isEdit ? "商品更新成功！" : "商品建立成功！");
        setEditingProduct(null);
        fetchData();
      } else {
        alert(`${isEdit ? "更新" : "建立"}失敗: ${data.message}`);
      }
    } catch (err) {
      alert("儲存商品時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCraftSave = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const isEdit = !!editingCraft._id;
      
      // Clean and sanitize the craft object structure for MongoDB compatibility
      const cleanedCraft = {
        ...editingCraft,
        id: (editingCraft.id || "").trim(),
        title: (editingCraft.title || "").trim(),
        summary: (editingCraft.summary || "").trim(),
        icon: (editingCraft.icon || "").trim(),
        image: (editingCraft.image || "").trim(),
        content: (editingCraft.content || "").trim(),
      };

      const res = await fetch("/api/admin/crafts", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanedCraft),
      });
      const data = await res.json();
      if (data.success) {
        alert(isEdit ? "工藝更新成功！" : "工藝建立成功！");
        setEditingCraft(null);
        fetchData();
      } else {
        alert(`${isEdit ? "更新" : "建立"}失敗: ${data.message}`);
      }
    } catch (err) {
      alert("儲存工藝時發生錯誤！");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper helper to filter products without series
  const getUnassociatedProducts = () => {
    const seriesIds = productsData.series.map(s => String(s._id));
    const listToFilter = productsData.products.filter(p => showArchived || p.status !== "archived");
    return listToFilter.filter(p => !p.seriesId || !seriesIds.includes(String(p.seriesId)));
  };

  // Helper to filter crafts without category
  const getUnassociatedCrafts = () => {
    const categoriesList = ["匠心工藝", "精選材質", "風格品味", "器物質感"];
    return craftsData.crafts.filter(c => !c.category || !categoriesList.includes(c.category));
  };

  const unassociatedProducts = getUnassociatedProducts();
  const unassociatedCrafts = getUnassociatedCrafts();

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {/* 1. Header 導覽列 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-xl font-bold text-gray-900 tracking-wide">
                巧鈺好飾 - 後台管理系統
              </span>
            </div>
            <nav className="flex space-x-4">
              <button
                onClick={() => setActiveTab("products")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "products"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                商品編輯
              </button>
              <button
                onClick={() => setActiveTab("crafts")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "crafts"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                工藝編輯
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "orders"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                訂單與出貨管理
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "members"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                會員專區
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : activeTab === "products" ? (
          // 2. 商品編輯頁面
          <div className="space-y-8">
            {/* 顯示下架封存項目與調整排序開關 */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center bg-white p-4 rounded-lg border shadow-sm gap-4">
              <span className="text-sm font-semibold text-gray-700">🔍 商品與系列管理</span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 accent-indigo-600"
                  />
                  <span className="text-sm text-gray-600 select-none">顯示已封存商品 (archived)</span>
                </label>
                
                <div className="h-5 w-[1px] bg-gray-200 hidden sm:block"></div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSortingMode}
                      onChange={(e) => setIsSortingMode(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 select-none">調整款式順序</span>
                  </label>
                  {isSortingMode && (
                    <button
                      onClick={handleSaveProductOrder}
                      disabled={isSubmitting}
                      className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold shadow-sm transition-all"
                    >
                      儲存款式順序
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 提示資料庫為空 */}
            {productsData.series.length === 0 && productsData.products.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center">
                <h3 className="font-bold text-lg">⚠️ 資料庫內無任何商品與系列資料</h3>
                <p className="text-sm mt-2">請確認您已在 VS Code 中成功執行過 `migration.mongodb.js` 遷移腳本以寫入種子資料。</p>
              </div>
            )}

            {/* 渲染各系列商品 */}
            {productsData.series.map((ser) => {
              const matchedProducts = productsData.products
                .filter(
                  (p) => String(p.seriesId) === String(ser._id) && (showArchived || p.status !== "archived")
                )
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
              return (
                <div key={ser._id} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="border-b pb-4 mb-6 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{ser.name}</h2>
                      <p className="text-xs text-gray-500 mt-1">{ser.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingSeries(ser)}
                        className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium"
                      >
                        編輯系列子題
                      </button>
                      <button
                        onClick={() =>
                          setEditingProduct({
                            seriesId: String(ser._id),
                            name: "",
                            originalId: "",
                            category: null,
                            description: "",
                            image: "",
                            basePrice: 0,
                            variants: [],
                            craftIds: [],
                            status: "available"
                          })
                        }
                        className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm"
                      >
                        ＋ 新增商品
                      </button>
                    </div>
                  </div>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, ser._id)}
                  >
                    <SortableContext
                      items={matchedProducts.map((p) => p._id)}
                      strategy={rectSortingStrategy}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {matchedProducts.map((prod) => (
                          <SortableProductCard
                            key={prod._id}
                            prod={prod}
                            isSortingMode={isSortingMode}
                            onEdit={setEditingProduct}
                          />
                        ))}
                        {matchedProducts.length === 0 && (
                          <p className="text-sm text-gray-500 col-span-full">此系列下目前無商品。</p>
                        )}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })}

            {/* 未歸類商品 fallback */}
            {unassociatedProducts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="border-b pb-4 mb-6">
                  <h2 className="text-lg font-bold text-gray-900">未歸類 / 所有商品列表</h2>
                  <p className="text-xs text-gray-500 mt-1">此區塊包含所有未與系列關聯之商品。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {unassociatedProducts.map((prod) => (
                    <div
                      key={prod._id}
                      className="border rounded-lg overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <img
                          src={prod.image || "/images/logo.png"}
                          alt={prod.name}
                          className="w-full h-48 object-cover bg-gray-50"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/logo.png";
                          }}
                        />
                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              prod.status === "available" || !prod.status ? "bg-green-100 text-green-800" :
                              prod.status === "reserved" ? "bg-yellow-100 text-yellow-800" :
                              prod.status === "sold" ? "bg-red-100 text-red-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {prod.status === "available" || !prod.status ? "現貨上架" :
                               prod.status === "reserved" ? "交易保留" :
                               prod.status === "sold" ? "已售出" :
                               "下架封存"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {prod.variants?.length || 0} 個規格
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 line-clamp-1">{prod.name}</h3>
                          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{prod.description}</p>
                          <p className="text-sm font-bold text-indigo-600 mt-3">
                            NT$ {prod.basePrice?.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 border-t flex justify-end">
                        <button
                          onClick={() => setEditingProduct(JSON.parse(JSON.stringify(prod)))}
                          className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium"
                        >
                          編輯商品
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "crafts" ? (
          // 3. 工藝編輯頁面
          <div className="space-y-12">
            {/* 提示資料庫為空 */}
            {craftsData.crafts.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center">
                <h3 className="font-bold text-lg">⚠️ 資料庫內無任何工藝與分類資料</h3>
                <p className="text-sm mt-2">請確認您已在 VS Code 中成功執行過 `migration.mongodb.js` 遷移腳本以寫入工藝資料。</p>
              </div>
            )}

            {/* 嚴格依據 category 欄位進行四大分區排版 */}
            {["匠心工藝", "精選材質", "風格品味", "器物質感"].map((catName) => {
              const matchedCrafts = craftsData.crafts.filter(
                (c) => c.category === catName
              );
              return (
                <div key={catName} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="border-b pb-4 mb-6 flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">{catName}</h2>
                      <p className="text-xs text-gray-500 mt-1">「{catName}」分區之精選工藝與素材介紹</p>
                    </div>
                    <button
                      onClick={() => {
                        const matchedCategory = craftsData.categories.find(cat => cat.name === catName);
                        setEditingCraft({
                          id: "",
                          title: "",
                          summary: "",
                          icon: "",
                          image: "",
                          content: "",
                          category: catName,
                          categoryId: matchedCategory ? String(matchedCategory._id) : ""
                        });
                      }}
                      className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium shadow-sm"
                    >
                      ＋ 新增工藝
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matchedCrafts.map((craft) => (
                      <div
                        key={craft._id}
                        className="border rounded-lg overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                      >
                        <div>
                          <img
                            src={craft.image || "/images/placeholder-craft.jpg"}
                            alt={craft.title}
                            className="w-full h-44 object-cover bg-gray-50"
                          />
                          <div className="p-5">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded">
                                ID: {craft.id}
                              </span>
                              <span className="text-xs text-gray-400">
                                圖示: {craft.icon}
                              </span>
                            </div>
                            <h3 className="font-bold text-gray-900 text-base">{craft.title}</h3>
                            <p className="text-xs text-gray-500 font-medium mt-1 line-clamp-1">{craft.summary}</p>
                            <p className="text-sm text-gray-600 mt-3 line-clamp-3 leading-relaxed">
                              {craft.content}
                            </p>
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end">
                          <button
                            onClick={() => setEditingCraft(JSON.parse(JSON.stringify(craft)))}
                            className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium"
                          >
                            編輯工藝
                          </button>
                        </div>
                      </div>
                    ))}
                    {matchedCrafts.length === 0 && (
                      <p className="text-sm text-gray-500 col-span-full">此分區下目前無工藝項目。</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 未歸類工藝 fallback */}
            {unassociatedCrafts.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <div className="border-b pb-4 mb-6">
                  <h2 className="text-lg font-bold text-gray-900">未歸類 / 其他工藝項目</h2>
                  <p className="text-xs text-gray-500 mt-1">此區塊包含所有未符合四大分類之工藝項目。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {unassociatedCrafts.map((craft) => (
                    <div
                      key={craft._id}
                      className="border rounded-lg overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div>
                        <img
                          src={craft.image || "/images/placeholder-craft.jpg"}
                          alt={craft.title}
                          className="w-full h-44 object-cover bg-gray-50"
                        />
                        <div className="p-5">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded">
                              ID: {craft.id}
                            </span>
                            <span className="text-xs text-gray-400">
                              分類: {craft.category || "未分類"}
                            </span>
                          </div>
                          <h3 className="font-bold text-gray-900 text-base">{craft.title}</h3>
                          <p className="text-xs text-gray-500 font-medium mt-1 line-clamp-1">{craft.summary}</p>
                          <p className="text-sm text-gray-600 mt-3 line-clamp-3 leading-relaxed">
                            {craft.content}
                          </p>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 border-t flex justify-end">
                        <button
                          onClick={() => setEditingCraft(JSON.parse(JSON.stringify(craft)))}
                          className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium"
                        >
                          編輯工藝
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === "orders" ? (
          // 3. 訂單與出貨管理頁面
          <div className="space-y-8">
            <OrderStats stats={ordersStats} />
            <OrderList
              orders={orders}
              currentTab={ordersTab}
              onTabChange={(tab) => {
                setOrdersTab(tab);
                fetchOrders(tab, ordersSearch);
              }}
              searchQuery={ordersSearch}
              onSearchChange={(q) => {
                setOrdersSearch(q);
                fetchOrders(ordersTab, q);
              }}
              onSelectOrder={(order) => setDetailOrder(order)}
              onPrintOrder={(order, type) => handleOpenPrint(order, type)}
              onToggleStatus={handleToggleOrderStatus}
              onUpdateTrace={handleUpdateOrderTrace}
              isLoading={isOrdersLoading}
            />
          </div>
        ) : (
          // 4. 會員專區頁面
          <div className="space-y-8">
            {/* 上方數據統計區 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-medium text-gray-500">總會員數</span>
                <span className="text-3xl font-bold text-gray-900 mt-2">{membersData.stats.totalMembers}</span>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-medium text-gray-500">一般會員 (general)</span>
                <span className="text-3xl font-bold text-gray-900 mt-2">{membersData.stats.generalCount}</span>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-medium text-gray-500">商店會員 (partner)</span>
                <span className="text-3xl font-bold text-gray-900 mt-2">{membersData.stats.partnerCount}</span>
              </div>
              <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-between">
                <span className="text-sm font-medium text-gray-500">後台管理員 (admin)</span>
                <span className="text-3xl font-bold text-purple-700 mt-2">{membersData.stats.adminRoleCount ?? 0}</span>
              </div>
            </div>

            {/* 下方會員管理表格 */}
            <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
              <div className="px-6 py-4 border-b">
                <h2 className="text-lg font-bold text-gray-900">會員列表管理</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">會員</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">身份 (MEMBER)</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">管理 (ROLE)</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">註冊時間</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">會員身份操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {membersData.members.map((member) => (
                      <tr key={member._id}>
                        <td className="px-6 py-4 whitespace-nowrap flex items-center gap-3">
                          <img
                            src={member.image || "/images/placeholder.jpg"}
                            alt={member.name}
                            className="w-8 h-8 rounded-full bg-gray-100"
                          />
                          <span className="font-medium text-gray-900">{member.name || "未設定姓名"}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">{member.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                            (member.member || "general") === "partner"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                              : "bg-gray-50 text-gray-700 border-gray-100"
                          }`}>
                            {(member.member || "general") === "partner" ? "商店會員" : "一般會員"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                              (member.role || "general") === "admin"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-gray-50 text-gray-700 border-gray-200"
                            }`}>
                              {(member.role || "general") === "admin" ? "管理員 (admin)" : "一般 (general)"}
                            </span>
                            {(member.role || "general") === "admin" ? (
                              <button
                                type="button"
                                onClick={() => setConfirmingRoleMember({ ...member, targetRole: "general" })}
                                className="px-2.5 py-1 text-xs bg-amber-50 text-amber-700 rounded border border-amber-200 hover:bg-amber-100 font-medium transition-colors"
                              >
                                切換為 general
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmingRoleMember({ ...member, targetRole: "admin" })}
                                className="px-2.5 py-1 text-xs bg-purple-50 text-purple-700 rounded border border-purple-200 hover:bg-purple-100 font-medium transition-colors"
                              >
                                切換為 admin
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                          {member.createdAt ? new Date(member.createdAt).toLocaleDateString("zh-TW") : "無紀錄"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                          {(member.member || "general") === "general" ? (
                            <button
                              onClick={() => setConfirmingMember({ ...member, targetStatus: "partner" })}
                              className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium transition-colors"
                            >
                              轉換為商店會員
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmingMember({ ...member, targetStatus: "general" })}
                              className="px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 font-medium transition-colors"
                            >
                              降級為一般會員
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {membersData.members.length === 0 && (
                      <tr>
                        <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                          尚無會員資料。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 會員身分等級切換確認 Modal */}
      {confirmingMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6 animate-scale-up">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-gray-900">確認轉換會員等級？</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                您即將把會員 <span className="font-semibold text-indigo-600">{confirmingMember.name}</span> ({confirmingMember.email}) 的身份等級從{" "}
                <span className="font-medium text-gray-800">
                  {confirmingMember.targetStatus === "partner" ? "一般會員" : "商店會員"}
                </span>{" "}
                轉換為{" "}
                <span className="font-semibold text-emerald-600">
                  {confirmingMember.targetStatus === "partner" ? "商店會員" : "一般會員"}
                </span>。
              </p>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmingMember(null)}
                className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleUpgradeMember}
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-sm font-medium shadow-sm disabled:bg-indigo-400"
              >
                {isSubmitting ? "更新中..." : "確認轉換"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 會員角色 (ROLE) 切換確認 Modal */}
      {confirmingRoleMember && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-6 animate-scale-up">
            <div className="text-center space-y-3">
              <h3 className="text-lg font-bold text-gray-900">確認切換後台管理權限 (ROLE)？</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                您即將把會員 <span className="font-semibold text-indigo-600">{confirmingRoleMember.name}</span> ({confirmingRoleMember.email}) 的管理權限從{" "}
                <span className="font-semibold text-gray-800">
                  {confirmingRoleMember.role === "admin" ? "管理員 (admin)" : "一般 (general)"}
                </span>{" "}
                切換為{" "}
                <span className={`font-semibold ${confirmingRoleMember.targetRole === "admin" ? "text-purple-600" : "text-amber-600"}`}>
                  {confirmingRoleMember.targetRole === "admin" ? "管理員 (admin)" : "一般 (general)"}
                </span>。
              </p>
              {confirmingRoleMember.targetRole === "general" && (
                <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-left">
                  ⚠️ <strong>注意</strong>：切換為 general 後，該帳號將無法登入或操作此後台管理系統。
                </div>
              )}
              {confirmingRoleMember.targetRole === "admin" && (
                <div className="text-xs text-purple-700 bg-purple-50 p-3 rounded-lg border border-purple-200 text-left">
                  💡 <strong>提示</strong>：切換為 admin 後，該帳號將擁有完整後台管理權限（商品、工藝、會員）。
                </div>
              )}
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setConfirmingRoleMember(null)}
                className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 font-medium"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleRoleChange}
                disabled={isSubmitting}
                className={`px-4 py-2 text-white rounded-md text-sm font-medium shadow-sm disabled:opacity-50 ${
                  confirmingRoleMember.targetRole === "admin"
                    ? "bg-purple-600 hover:bg-purple-700"
                    : "bg-amber-600 hover:bg-amber-700"
                }`}
              >
                {isSubmitting ? "更新中..." : "確認切換"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 訂單詳情 Modal */}
      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onPrint={(order, type) => {
            setDetailOrder(null);
            handleOpenPrint(order, type);
          }}
          onToggleStatus={handleToggleOrderStatus}
          onUpdateTrace={handleUpdateOrderTrace}
        />
      )}

      {/* 出貨標籤列印預覽 Modal */}
      {printOrder && (
        <PrintPreviewModal
          order={printOrder}
          initialType={printInitialType}
          onClose={() => setPrintOrder(null)}
          onPrintSuccess={(order) => {
            fetchOrders(ordersTab, ordersSearch);
          }}
        />
      )}

      {/* 5. 商品編輯 Modal */}
      {editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingProduct._id ? "編輯商品詳情" : "新增商品詳情"}
              </h3>
              <button
                onClick={() => setEditingProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleProductSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 基本資訊 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-indigo-500 pl-2">
                  基本資訊
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">商品名稱</label>
                    <input
                      type="text"
                      required
                      value={editingProduct.name || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">原始代碼 / 款式編號 (originalId)</label>
                    <input
                      type="text"
                      required
                      placeholder="原始商品代碼，如 sc3"
                      value={editingProduct.originalId || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, originalId: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">基礎價格 (NT$)</label>
                    <input
                      type="number"
                      required
                      value={editingProduct.basePrice || 0}
                      onChange={(e) => setEditingProduct({ ...editingProduct, basePrice: parseInt(e.target.value) })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">飾品類型分類</label>
                    <select
                      value={editingProduct.category || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value || null })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-800"
                    >
                      <option value="">-- 請選擇分類 --</option>
                      <option value="ring">ring（戒指）</option>
                      <option value="pendant">pendant（吊墜項鍊）</option>
                      <option value="bracelet">bracelet（手鍊/手環）</option>
                      <option value="earring">earring（耳飾）</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">商品描述</label>
                  <textarea
                    rows={3}
                    value={editingProduct.description || ""}
                    onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                    className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      系列關聯 (同步設定 series 與 seriesId)
                    </label>
                    <select
                      value={editingProduct.seriesId || ""}
                      onChange={(e) => {
                        const selectedSeriesId = e.target.value;
                        const matchedSeries = productsData.series.find(
                          (s) => String(s._id) === String(selectedSeriesId)
                        );
                        if (matchedSeries) {
                          setEditingProduct({
                            ...editingProduct,
                            seriesId: selectedSeriesId,
                            series: matchedSeries.name,
                          });
                        }
                      }}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="">-- 請選擇系列 --</option>
                      {productsData.series.map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                      商品狀態 (Status)
                    </label>
                    <select
                      value={editingProduct.status || "available"}
                      onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    >
                      <option value="available">available（現貨上架中）</option>
                      <option value="reserved">reserved（交易保留/鎖定中）</option>
                      <option value="sold">sold（已售出）</option>
                      <option value="archived">archived（下架封存）</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 圖片與路徑設定 */}
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-indigo-500 pl-2">
                  主圖路徑與上傳
                </h4>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">主圖設定 (自動上傳 / 縮圖預覽)</label>
                  {editingProduct.image ? (
                    <div className="flex items-center space-x-4 p-3 border rounded bg-gray-50 mb-2">
                      <img
                        src={editingProduct.image}
                        alt="主圖預覽"
                        className="w-16 h-16 object-cover rounded border bg-white"
                        onError={(e) => { e.target.src = "/placeholder-image.png"; }}
                      />
                      <div className="flex flex-col space-y-1 flex-1 min-w-0">
                        <span className="text-xs text-gray-500 truncate">{editingProduct.image}</span>
                        <label className="inline-block text-center text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 cursor-pointer w-24">
                          {uploadingMainImage ? "上傳中..." : "重新上傳"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingMainImage}
                            className="hidden"
                            onChange={handleMainImageUpload}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-indigo-50 text-gray-400 border-gray-300 mb-2">
                      {uploadingMainImage ? (
                        <span className="text-xs text-indigo-600 animate-pulse font-medium">主圖上傳中...</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span className="text-xs font-bold text-indigo-600">+ 上傳主圖</span>
                          <span className="text-[10px] text-gray-400">點擊選取檔案自動上傳</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingMainImage}
                        className="hidden"
                        onChange={handleMainImageUpload}
                      />
                    </label>
                  )}
                  <div className="mt-2">
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">主圖網址微調 Input</label>
                    <input
                      type="text"
                      value={editingProduct.image || ""}
                      onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 bg-white"
                      placeholder="微調網址路徑..."
                    />
                  </div>
                </div>
              </div>

              {/* 規格品項 */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-indigo-500 pl-2">
                    規格品項陣列 (Variants)
                  </h4>
                  <button
                    type="button"
                    onClick={() => {
                      const currentLength = (editingProduct.variants || []).length;
                      const updatedVariants = [
                        ...(editingProduct.variants || []),
                        {
                          name: "",
                          price: 0,
                          image: "",
                          images: [],
                          type: "ready_made",
                          sort_order: currentLength,
                          custom_notice: "",
                          ready_made_note: "",
                          lead_time_days: 10
                        }
                      ];
                      setEditingProduct({ ...editingProduct, variants: updatedVariants });
                    }}
                    className="text-xs px-2.5 py-1 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100"
                  >
                    + 新增規格
                  </button>
                </div>

                <div className="space-y-3">
                  {(editingProduct.variants || []).map((v, index) => (
                    <div key={index} className="border p-3 rounded-lg bg-gray-50 flex flex-col space-y-2 relative">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = (editingProduct.variants || []).filter((_, idx) => idx !== index);
                          setEditingProduct({ ...editingProduct, variants: updated });
                        }}
                        className="absolute right-2 top-2 text-gray-400 hover:text-red-500 text-lg"
                      >
                        &times;
                      </button>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pr-6">
                        <div>
                          <label className="block text-[10px] text-gray-500">規格名稱</label>
                          <input
                            type="text"
                            required
                            value={v.name || ""}
                            onChange={(e) => {
                              const updated = [...editingProduct.variants];
                              updated[index].name = e.target.value;
                              setEditingProduct({ ...editingProduct, variants: updated });
                            }}
                            className="w-full text-xs border p-1 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500">規格價格</label>
                          <input
                            type="number"
                            required
                            value={v.price || 0}
                            onChange={(e) => {
                              const updated = [...editingProduct.variants];
                              updated[index].price = parseInt(e.target.value);
                              setEditingProduct({ ...editingProduct, variants: updated });
                            }}
                            className="w-full text-xs border p-1 rounded"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500">規格狀態 (Status)</label>
                          <select
                            value={v.status || "available"}
                            onChange={(e) => {
                              const updated = [...editingProduct.variants];
                              updated[index].status = e.target.value;
                              setEditingProduct({ ...editingProduct, variants: updated });
                            }}
                            className="w-full text-xs border p-1 rounded bg-white outline-none"
                          >
                            <option value="available">available（現貨）</option>
                            <option value="reserved">reserved（保留）</option>
                            <option value="sold">sold（已售出）</option>
                            <option value="archived">archived（封存）</option>
                          </select>
                        </div>
                      </div>
                      {/* Row 2 & 3: 規格詳細設定與排序 (結構化排版) */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-t pt-3 mt-2">
                        {/* 規格類型 */}
                        <div className="min-w-[140px]">
                          <label className="block text-[10px] text-gray-500 font-semibold mb-2">規格類型</label>
                          <div className="flex gap-4 h-9 items-center">
                            <label className="inline-flex items-center text-xs cursor-pointer select-none">
                              <input
                                type="radio"
                                name={`variant-type-${index}`}
                                checked={(v.type || "ready_made") === "ready_made"}
                                onChange={() => {
                                  const updated = [...editingProduct.variants];
                                  updated[index].type = "ready_made";
                                  setEditingProduct({ ...editingProduct, variants: updated });
                                }}
                                className="mr-1.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 accent-indigo-600"
                              />
                              現品
                            </label>
                            <label className="inline-flex items-center text-xs cursor-pointer select-none">
                              <input
                                type="radio"
                                name={`variant-type-${index}`}
                                checked={v.type === "semi_finished"}
                                onChange={() => {
                                  const updated = [...editingProduct.variants];
                                  updated[index].type = "semi_finished";
                                  if (updated[index].lead_time_days === undefined) {
                                    updated[index].lead_time_days = 10;
                                  }
                                  setEditingProduct({ ...editingProduct, variants: updated });
                                }}
                                className="mr-1.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 accent-indigo-600"
                              />
                              半成品
                            </label>
                          </div>
                        </div>

                        {/* 製作期天數 & 客製提示文案 (semi_finished) OR 備註說明 (ready_made) */}
                        {v.type === "semi_finished" ? (
                          <>
                            {/* 製作期天數 */}
                            <div>
                              <label className="block text-[10px] text-gray-500 font-semibold mb-1">製作期天數</label>
                              <div className="flex items-center gap-1 h-9">
                                <input
                                  type="number"
                                  min={1}
                                  required
                                  value={v.lead_time_days === undefined ? 10 : v.lead_time_days}
                                  onChange={(e) => {
                                    const updated = [...editingProduct.variants];
                                    updated[index].lead_time_days = parseInt(e.target.value) || 10;
                                    setEditingProduct({ ...editingProduct, variants: updated });
                                  }}
                                  className="w-full text-xs border p-2 rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                <span className="text-xs text-gray-600 font-medium whitespace-nowrap">天</span>
                              </div>
                            </div>

                            {/* 客製提示文案 */}
                            <div>
                              <label className="block text-[10px] text-gray-500 font-semibold mb-1">客製提示文案（選填）</label>
                              <div className="h-9 flex items-end">
                                <input
                                  type="text"
                                  placeholder="留空使用預設文案"
                                  value={v.custom_notice || ""}
                                  onChange={(e) => {
                                    const updated = [...editingProduct.variants];
                                    updated[index].custom_notice = e.target.value;
                                    setEditingProduct({ ...editingProduct, variants: updated });
                                  }}
                                  className="w-full text-xs border p-2 rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                              </div>
                            </div>
                          </>
                        ) : (
                          /* 備註說明（現貨條件）- 橫跨兩欄，與排序按鈕對齊 */
                          <div className="md:col-span-2">
                            <label className="block text-[10px] text-gray-500 font-semibold mb-1">備註說明（現貨條件，選填）</label>
                            <div className="h-9 flex items-end">
                              <input
                                type="text"
                                placeholder="例如：現貨戒圍為國際圍 #11，不可改圍"
                                value={v.ready_made_note || ""}
                                onChange={(e) => {
                                  const updated = [...editingProduct.variants];
                                  updated[index].ready_made_note = e.target.value;
                                  setEditingProduct({ ...editingProduct, variants: updated });
                                }}
                                className="w-full text-xs border p-2 rounded bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                              />
                            </div>
                          </div>
                        )}
                        {/* 規格排序 - 垂直置中，避免與鄰近 Input 貼合 */}
                        <div className="flex items-center gap-2 h-9 border-t md:border-t-0 pt-2 md:pt-0">
                          <span className="text-gray-500 text-[10px] font-semibold whitespace-nowrap">規格排序:</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-100 font-bold">
                              #{v.sort_order === undefined ? index : v.sort_order}
                            </span>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => moveVariant(index, "up")}
                              className="px-2 py-1 bg-white border rounded text-[10px] text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition-colors animate-none"
                            >
                              ▲ 上移
                            </button>
                            <button
                              type="button"
                              disabled={index === (editingProduct.variants || []).length - 1}
                              onClick={() => moveVariant(index, "down")}
                              className="px-2 py-1 bg-white border rounded text-[10px] text-gray-700 hover:bg-gray-100 disabled:opacity-40 disabled:hover:bg-white transition-colors animate-none"
                            >
                              ▼ 下移
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="border-t pt-3 mt-2">
                        <label className="block text-[10px] font-bold text-gray-600 mb-1">規格圖片庫</label>
                          <div className="flex flex-wrap gap-2 mb-2 items-center">
                            {(v.images && v.images.length > 0 ? v.images : (v.image ? [v.image] : [])).map((imgUrl, imgIdx, arr) => (
                              <div key={imgIdx} className="relative w-16 h-16 border rounded bg-white group flex items-center justify-center overflow-hidden">
                                <img src={imgUrl} alt="preview" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1">
                                  {imgIdx>0 && (
                                    <button type="button" onClick={()=>{const m=[...arr];[m[imgIdx],m[imgIdx-1]]=[m[imgIdx-1],m[imgIdx]];const u=[...editingProduct.variants];u[index].images=m;u[index].image=m[0]||"";setEditingProduct({...editingProduct,variants:u});}} className="text-[9px] bg-indigo-500 text-white rounded px-1 cursor-pointer">&larr;</button>
                                  )}
                                  {imgIdx<arr.length-1 && (
                                    <button type="button" onClick={()=>{const m=[...arr];[m[imgIdx],m[imgIdx+1]]=[m[imgIdx+1],m[imgIdx]];const u=[...editingProduct.variants];u[index].images=m;u[index].image=m[0]||"";setEditingProduct({...editingProduct,variants:u});}} className="text-[9px] bg-indigo-500 text-white rounded px-1 cursor-pointer">&rarr;</button>
                                  )}
                                  <button type="button" onClick={()=>{const m=arr.filter((_,i)=>i!==imgIdx);const u=[...editingProduct.variants];u[index].images=m;u[index].image=m[0]||"";setEditingProduct({...editingProduct,variants:u});}} className="text-[10px] bg-red-500 text-white rounded px-1 cursor-pointer">&times;</button>
                                </div>
                              </div>
                            ))}
                            <div className="relative">
                              <label className="flex flex-col items-center justify-center w-16 h-16 border-2 border-dashed rounded cursor-pointer hover:bg-indigo-50 text-gray-400">
                                {uploadingVariantIndex===index ? <span className="text-[10px] text-indigo-600 animate-pulse text-center">上傳中</span> : <span className="text-xs font-bold">+上傳</span>}
                                <input type="file" accept="image/*" disabled={uploadingVariantIndex!==null} className="hidden"
                                  onChange={async(e)=>{const f=e.target.files?.[0];if(!f)return;setUploadingVariantIndex(index);const cur=v.images&&v.images.length>0?v.images:(v.image?[v.image]:[]);const fd=new FormData();fd.append("file",f);fd.append("productId",editingProduct.originalId||"temp");fd.append("variantId",v.name?encodeURIComponent(v.name):`var-${index}`);try{const res=await fetch("/api/admin/upload",{method:"POST",body:fd});const d=await res.json();if(d.success&&d.url){const upImgs=[...cur,d.url];const u=[...editingProduct.variants];u[index].images=upImgs;u[index].image=upImgs[0]||"";setEditingProduct({...editingProduct,variants:u});}else alert("上傳失敗: "+(d.message||""));}catch(err){alert("上傳出錯："+err.message);}finally{setUploadingVariantIndex(null);}}}
                                />
                              </label>
                            </div>
                          </div>
                          <div className="w-full flex mt-1">
                            <input type="text" placeholder="圖片網址庫 (逗號分隔)" value={(v.images&&v.images.length>0?v.images:(v.image?[v.image]:[])).join(", ")}
                              onChange={(e)=>{const urls=e.target.value.split(",").map(url=>url.trim()).filter(Boolean);const u=[...editingProduct.variants];u[index].images=urls;u[index].image=urls[0]||"";setEditingProduct({...editingProduct,variants:u});}}
                              className="w-full text-[10px] border p-1 rounded text-gray-600 bg-white"
                            />
                          </div>
                        </div>
                      </div>
                  ))}
                </div>
              </div>

              {/* 按鈕 */}
              <div className="pt-4 border-t flex justify-end space-x-3 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? "儲存中..." : "確認儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. 工藝編輯 Modal */}
      {editingCraft && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                {editingCraft._id ? "編輯工藝詳情" : "新增工藝詳情"}
              </h3>
              <button
                onClick={() => setEditingCraft(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCraftSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-indigo-500 pl-2">
                  工藝內容編輯
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">工藝識別 ID</label>
                    <input
                      type="text"
                      value={editingCraft.id || ""}
                      onChange={(e) => setEditingCraft({ ...editingCraft, id: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">工藝名稱 (標題)</label>
                    <input
                      type="text"
                      required
                      value={editingCraft.title || ""}
                      onChange={(e) => setEditingCraft({ ...editingCraft, title: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* 分類關聯下拉選單 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">分類關聯 (同步設定 category 與 categoryId)</label>
                  <select
                    value={editingCraft.categoryId || ""}
                    onChange={(e) => {
                      const selectedCatId = e.target.value;
                      const matchedCategory = craftsData.categories.find(cat => String(cat._id) === String(selectedCatId));
                      if (matchedCategory) {
                        setEditingCraft({
                          ...editingCraft,
                          categoryId: selectedCatId,
                          category: matchedCategory.name
                        });
                      }
                    }}
                    className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    <option value="">-- 請選擇分區分類 --</option>
                    {craftsData.categories.map((cat) => (
                      <option key={cat._id} value={cat._id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">簡介 (summary)</label>
                    <input
                      type="text"
                      value={editingCraft.summary || ""}
                      onChange={(e) => setEditingCraft({ ...editingCraft, summary: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">圖示名稱 (icon)</label>
                    <input
                      type="text"
                      value={editingCraft.icon || ""}
                      onChange={(e) => setEditingCraft({ ...editingCraft, icon: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">工藝圖片設定 (自動上傳 / 預覽)</label>
                  {editingCraft.image ? (
                    <div className="flex items-center space-x-4 p-3 border rounded bg-gray-50 mb-2">
                      <img
                        src={editingCraft.image}
                        alt="工藝圖片預覽"
                        className="w-16 h-16 object-cover rounded border bg-white"
                        onError={(e) => { e.target.src = "/placeholder-image.png"; }}
                      />
                      <div className="flex flex-col space-y-1 flex-1 min-w-0">
                        <span className="text-xs text-gray-500 truncate">{editingCraft.image}</span>
                        <label className="inline-block text-center text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-100 cursor-pointer w-24">
                          {uploadingCraftImage ? "上傳中..." : "更換圖片"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingCraftImage}
                            className="hidden"
                            onChange={handleCraftImageUpload}
                          />
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer hover:bg-indigo-50 text-gray-400 border-gray-300 mb-2">
                      {uploadingCraftImage ? (
                        <span className="text-xs text-indigo-600 animate-pulse font-medium">圖片上傳中...</span>
                      ) : (
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span className="text-xs font-bold text-indigo-600">+ 上傳工藝圖片</span>
                          <span className="text-[10px] text-gray-400">點擊選取檔案自動上傳</span>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingCraftImage}
                        className="hidden"
                        onChange={handleCraftImageUpload}
                      />
                    </label>
                  )}
                  <div className="mt-2">
                    <label className="block text-[10px] font-semibold text-gray-400 mb-1">圖片網址微調 Input</label>
                    <input
                      type="text"
                      value={editingCraft.image || ""}
                      onChange={(e) => setEditingCraft({ ...editingCraft, image: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700 bg-white"
                      placeholder="微調網址路徑..."
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">工藝說明與詳情</label>
                  <textarea
                    rows={8}
                    required
                    value={editingCraft.content || ""}
                    onChange={(e) => setEditingCraft({ ...editingCraft, content: e.target.value })}
                    className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none leading-relaxed"
                  />
                </div>
              </div>

              {/* 按鈕 */}
              <div className="pt-4 border-t flex justify-end space-x-3 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setEditingCraft(null)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? "儲存中..." : "確認儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. 編輯系列子題 Modal */}
      {editingSeries && (
        <div className="fixed inset-0 bg-black/50 z-50 flex justify-center items-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 text-lg">
                編輯系列子題 - {editingSeries.name}
              </h3>
              <button
                onClick={() => setEditingSeries(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSeriesSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 系列基本資料編輯區塊 */}
              <div className="space-y-4 border-b pb-6">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-indigo-500 pl-2">
                  系列基本資料編輯 (SERIES BASIC INFO)
                </h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">系列名稱 (name)</label>
                    <input
                      type="text"
                      required
                      value={editingSeries.name || ""}
                      onChange={(e) => setEditingSeries({ ...editingSeries, name: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                      placeholder="例如：自然個性系列"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">系列描述 (description)</label>
                    <textarea
                      value={editingSeries.description || ""}
                      onChange={(e) => setEditingSeries({ ...editingSeries, description: e.target.value })}
                      className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-indigo-500 outline-none bg-white h-24 resize-none"
                      placeholder="請輸入系列描述..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">系列主圖預覽與上傳</label>
                    <div className="flex items-center gap-4">
                      {/* Thumbnail Preview */}
                      <div className="relative w-20 h-20 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                        {editingSeries.image ? (
                          <img
                            src={getImageUrl(editingSeries.image)}
                            alt="Preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-gray-400">無主圖</span>
                        )}
                      </div>
                      
                      {/* Upload Button */}
                      <div>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium text-xs">
                          {uploadingSeriesImage ? "上傳中..." : "+ 選擇圖片上傳"}
                          <input
                            type="file"
                            accept="image/*"
                            disabled={uploadingSeriesImage}
                            className="hidden"
                            onChange={handleSeriesImageUpload}
                          />
                        </label>
                        <p className="text-[10px] text-gray-400 mt-1">
                          支援 JPG, PNG 等圖片。新上傳將存至 Cloudflare R2，原本地路徑仍可相容。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 全新動態頁簽編輯 */}
              <div className="space-y-6">
                <h4 className="font-bold text-sm text-gray-700 uppercase tracking-wider border-l-4 border-emerald-500 pl-2">
                  全新動態頁簽編輯 (DYNAMIC TABS SETTINGS)
                </h4>
                
                {(() => {
                  const defaultTabs = [
                    { tabKey: 'style', tabLabel: '系列風格', header: { title: '', description: '' }, craftId: '', features: [{ title: '', description: '' }, { title: '', description: '' }, { title: '', description: '' }] },
                    { tabKey: 'mood', tabLabel: '心情筆記', header: { title: '', description: '' }, craftId: '', features: [{ title: '', description: '' }, { title: '', description: '' }, { title: '', description: '' }] },
                    { tabKey: 'outfit', tabLabel: '穿搭哲學', header: { title: '', description: '' }, craftId: '', features: [{ title: '', description: '' }, { title: '', description: '' }, { title: '', description: '' }] }
                  ];

                  const tabs = editingSeries.tabs && editingSeries.tabs.length > 0 ? editingSeries.tabs : defaultTabs;

                  return tabs.map((tab, tabIdx) => {
                    const updateTabField = (field, value) => {
                      const newTabs = JSON.parse(JSON.stringify(tabs));
                      newTabs[tabIdx][field] = value;
                      setEditingSeries({ ...editingSeries, tabs: newTabs });
                    };

                    const updateHeaderField = (field, value) => {
                      const newTabs = JSON.parse(JSON.stringify(tabs));
                      if (!newTabs[tabIdx].header) newTabs[tabIdx].header = { title: '', description: '' };
                      newTabs[tabIdx].header[field] = value;
                      setEditingSeries({ ...editingSeries, tabs: newTabs });
                    };

                    const updateFeatureField = (featIdx, field, value) => {
                      const newTabs = JSON.parse(JSON.stringify(tabs));
                      if (!newTabs[tabIdx].features) {
                        newTabs[tabIdx].features = [
                          { title: '', description: '' },
                          { title: '', description: '' },
                          { title: '', description: '' }
                        ];
                      }
                      newTabs[tabIdx].features[featIdx][field] = value;
                      setEditingSeries({ ...editingSeries, tabs: newTabs });
                    };

                    return (
                      <div key={tab.tabKey || tabIdx} className="p-4 border border-stone-200 rounded-lg bg-stone-50/50 space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                          <span className="font-semibold text-xs text-emerald-800 tracking-wider uppercase">
                            頁簽 {tabIdx + 1}：[{tab.tabKey}]
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">頁簽名稱 (tabLabel)</label>
                            <input
                              type="text"
                              value={tab.tabLabel || ""}
                              onChange={(e) => updateTabField("tabLabel", e.target.value)}
                              className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">對應工藝 ID (craftId)</label>
                            <select
                              value={tab.craftId || ""}
                              onChange={(e) => updateTabField("craftId", e.target.value)}
                              className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            >
                              <option value="">-- 請選擇關聯工藝 --</option>
                              {craftsData.crafts && craftsData.crafts.map((c) => (
                                <option key={c.id} value={c.id}>
                                  [{c.id}] {c.title} ({c.category})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">頁簽標題 (header.title)</label>
                            <input
                              type="text"
                              value={tab.header?.title || ""}
                              onChange={(e) => updateHeaderField("title", e.target.value)}
                              className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">頁簽描述 (header.description)</label>
                            <input
                              type="text"
                              value={tab.header?.description || ""}
                              onChange={(e) => updateHeaderField("description", e.target.value)}
                              className="w-full text-sm border p-2 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                            />
                          </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t">
                          <label className="block text-xs font-bold text-gray-700">特色內容 (3組 Features)</label>
                          {[0, 1, 2].map((featIdx) => {
                            const feat = (tab.features || [])[featIdx] || { title: "", description: "" };
                            return (
                              <div key={featIdx} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-emerald-300">
                                <input
                                  type="text"
                                  placeholder={`特色 ${featIdx + 1} 標題`}
                                  value={feat.title || ""}
                                  onChange={(e) => updateFeatureField(featIdx, "title", e.target.value)}
                                  className="w-full text-xs border p-1.5 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                />
                                <input
                                  type="text"
                                  placeholder={`特色 ${featIdx + 1} 描述`}
                                  value={feat.description || ""}
                                  onChange={(e) => updateFeatureField(featIdx, "description", e.target.value)}
                                  className="w-full text-xs border p-1.5 rounded focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* 按鈕 */}
              <div className="pt-4 border-t flex justify-end space-x-3 bg-white sticky bottom-0">
                <button
                  type="button"
                  onClick={() => setEditingSeries(null)}
                  className="px-4 py-2 border rounded-md text-sm text-gray-600 hover:bg-gray-50 font-medium"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 font-medium shadow-sm disabled:bg-indigo-400"
                >
                  {isSubmitting ? "儲存中..." : "確認儲存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableProductCard({ prod, isSortingMode, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: prod._id, disabled: !isSortingMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-lg overflow-hidden bg-white shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between relative ${
        isSortingMode ? "cursor-grab active:cursor-grabbing border-indigo-300 ring-2 ring-indigo-100" : ""
      }`}
      {...attributes}
      {...(isSortingMode ? listeners : {})}
    >
      <div>
        <div className="relative">
          <img
            src={prod.image || "/images/logo.png"}
            alt={prod.name}
            className="w-full h-48 object-cover bg-gray-50"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/images/logo.png";
            }}
          />
          {isSortingMode && (
            <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none animate-fade-in">
              <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded shadow-md font-semibold tracking-wider uppercase">
                ↕ 拖曳排序
              </span>
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              prod.status === "available" || !prod.status ? "bg-green-100 text-green-800" :
              prod.status === "reserved" ? "bg-yellow-100 text-yellow-800" :
              prod.status === "sold" ? "bg-red-100 text-red-800" :
              "bg-gray-100 text-gray-800"
            }`}>
              {prod.status === "available" || !prod.status ? "現貨上架" :
               prod.status === "reserved" ? "交易保留" :
               prod.status === "sold" ? "已售出" :
               "下架封存"}
            </span>
            <span className="text-[10px] text-gray-400">
              {prod.variants?.length || 0} 個規格
            </span>
          </div>
          <h3 className="font-semibold text-gray-900 line-clamp-1">{prod.name}</h3>
          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{prod.description}</p>
          <p className="text-sm font-bold text-indigo-600 mt-3">
            NT$ {prod.basePrice?.toLocaleString()}
          </p>
        </div>
      </div>
      <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
        <span className="text-[10px] text-gray-400">排序號: {prod.sort_order || 0}</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(JSON.parse(JSON.stringify(prod)));
          }}
          disabled={isSortingMode}
          className="text-xs px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded border border-indigo-200 hover:bg-indigo-100 font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          編輯商品
        </button>
      </div>
    </div>
  );
}
