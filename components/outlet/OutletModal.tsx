"use client";

import React, { useState } from "react";
import { 
  X, 
  Upload, 
  Trash2, 
  Star, 
  ArrowUp, 
  ArrowDown, 
  Loader2, 
  Sparkles, 
  Calendar,
  AlertCircle,
  Tag,
  DollarSign,
  Layers,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Gift
} from "lucide-react";
import { OutletItem, OutletStatus } from "@/types/outlet";
import { getImageUrl } from "@/lib/image";
import { generatePromoCode, buildPromoDirectUrl } from "@/lib/utils";


interface OutletModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlet: Partial<OutletItem> | null;
  onSave: (data: Partial<OutletItem>) => Promise<boolean>;
}

// Convert ISO/Date to YYYY-MM-DDTHH:mm for datetime-local input
function toDatetimeLocalString(dateVal?: string | Date | null): string {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch {
    return "";
  }
}

export const OutletModal: React.FC<OutletModalProps> = ({
  isOpen,
  onClose,
  outlet,
  onSave,
}) => {
  const isEdit = Boolean(outlet?._id);

  // Initialize state directly from props to avoid cascading renders
  const [formData, setFormData] = useState<Partial<OutletItem>>(() => {
    if (outlet) {
      return {
        _id: outlet._id,
        title: outlet.title || "",
        slug: outlet.slug || "",
        price: outlet.price ?? 0,
        originalPrice: outlet.originalPrice,
        images: Array.isArray(outlet.images) ? [...outlet.images] : [],
        material: outlet.material || "",
        sourceNote: outlet.sourceNote || "",
        description: outlet.description || "",
        status: outlet.status || "available",
        reservedUntil: outlet.reservedUntil || null,
        sortOrder: outlet.sortOrder ?? 0,
        isSocialPromo: Boolean(outlet.isSocialPromo),
        promoCode: outlet.promoCode || "",
      };
    }
    return {
      title: "",
      slug: "",
      price: 0,
      originalPrice: undefined,
      images: [],
      material: "",
      sourceNote: "",
      description: "",
      status: "available",
      reservedUntil: null,
      sortOrder: 0,
      isSocialPromo: false,
      promoCode: "",
    };
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [manualImageUrl, setManualImageUrl] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleToggleSocialPromo = (checked: boolean) => {
    if (checked) {
      const code = formData.promoCode || generatePromoCode();
      setFormData((prev) => ({
        ...prev,
        isSocialPromo: true,
        status: "reserved",
        reservedUntil: null,
        promoCode: code,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        isSocialPromo: false,
        status: "available",
        promoCode: "",
      }));
    }
  };

  const handleCopyCode = async () => {
    if (!formData.promoCode) return;
    try {
      await navigator.clipboard.writeText(formData.promoCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // fallback
    }
  };


  if (!isOpen) return null;

  // Auto-generate slug from title or timestamp
  const handleGenerateSlug = () => {
    const base = formData.title?.trim()
      ? formData.title
          .trim()
          .toLowerCase()
          .replace(/[\s·／/、，。！!]+/g, "-")
          .replace(/[^a-z0-9\u4e00-\u9fa5-_]/g, "")
      : `item-${Date.now().toString(36)}`;
    const finalSlug = `outlet-${base || Date.now().toString(36)}`;
    setFormData((prev) => ({ ...prev, slug: finalSlug }));
  };

  // Image Upload handler via Cloudflare R2
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);

    const uploadedUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("file", file);
        fd.append("productId", "outlet");
        fd.append("variantId", formData.slug || "single-item");

        const res = await fetch("/api/admin/upload", {
          method: "POST",
          body: fd,
        });

        const data = await res.json();
        if (data.success && data.url) {
          uploadedUrls.push(data.url);
        } else {
          throw new Error(data.message || `第 ${i + 1} 張圖片上傳失敗`);
        }
      }

      setFormData((prev) => ({
        ...prev,
        images: [...(prev.images || []), ...uploadedUrls],
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "圖片上傳過程中發生錯誤";
      console.error("Upload error:", err);
      setUploadError(message);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  // Add manual URL
  const handleAddManualImage = () => {
    if (!manualImageUrl.trim()) return;
    setFormData((prev) => ({
      ...prev,
      images: [...(prev.images || []), manualImageUrl.trim()],
    }));
    setManualImageUrl("");
  };

  // Set image as cover (move to index 0)
  const handleSetCover = (index: number) => {
    if (!formData.images || index <= 0) return;
    const imgs = [...formData.images];
    const [target] = imgs.splice(index, 1);
    imgs.unshift(target);
    setFormData((prev) => ({ ...prev, images: imgs }));
  };

  // Remove image
  const handleRemoveImage = (index: number) => {
    if (!formData.images) return;
    const imgs = formData.images.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, images: imgs }));
  };

  // Reorder image up/down
  const handleMoveImage = (index: number, direction: "up" | "down") => {
    if (!formData.images) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= formData.images.length) return;
    const imgs = [...formData.images];
    const temp = imgs[index];
    imgs[index] = imgs[targetIndex];
    imgs[targetIndex] = temp;
    setFormData((prev) => ({ ...prev, images: imgs }));
  };

  // Preset Source Notes
  const presetSourceNotes = [
    "原廠展示孤品出清，成色完美",
    "專櫃微瑕福利品，極致通透",
    "絕版款式限量出清，僅此一件",
    "原石微瑕手工精雕，附鑑定保證書",
    "樣品福利品特賣，純手工包鑲金工",
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title?.trim()) {
      alert("請輸入商品名稱！");
      return;
    }
    if (formData.price === undefined || formData.price < 0) {
      alert("請輸入大於或等於 0 的特惠售價！");
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onSave(formData);
      if (ok) {
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate discount rate
  const discountPercent =
    formData.originalPrice && formData.price && formData.originalPrice > formData.price
      ? Math.round(((formData.originalPrice - formData.price) / formData.originalPrice) * 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex justify-center items-center p-4 sm:p-6 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex justify-between items-center shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-white/10 rounded-lg backdrop-blur-xs">
              <Sparkles className="w-5 h-5 text-emerald-200" />
            </span>
            <div>
              <h2 className="text-lg font-bold">
                {isEdit ? "編輯 Outlet 單品" : "新增 Outlet 單品特賣"}
              </h2>
              <p className="text-xs text-emerald-100/80">
                專屬孤品/展示特賣單品管理，即時連動庫存狀態
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>基本資料與識別代碼</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  商品標題 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.title || ""}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="例：圓潤雙透鍊墜 · 【特賣孤品】"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>

              {/* Slug */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-gray-700">
                    Slug 網址識別代碼 <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateSlug}
                    className="text-[11px] text-emerald-600 hover:text-emerald-700 font-medium hover:underline flex items-center gap-0.5"
                  >
                    <Sparkles className="w-3 h-3" /> 自動產生
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.slug || ""}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  placeholder="例：outlet-np001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white font-mono text-xs"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  販售狀態 <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.status || "available"}
                  onChange={(e) => {
                    const newStatus = e.target.value as OutletStatus;
                    if (newStatus !== "reserved" && formData.isSocialPromo) {
                      setFormData({ ...formData, status: newStatus, isSocialPromo: false, promoCode: "" });
                    } else {
                      setFormData({ ...formData, status: newStatus });
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                >
                  <option value="available">🟢 現貨可售 (available)</option>
                  <option value="reserved">🟡 預訂保留中 (reserved)</option>
                  <option value="sold">⚪ 已售出 (sold)</option>
                  <option value="archived">🔴 下架封存 (archived)</option>
                </select>
              </div>

              {/* Social Promo Long-term Reservation Switch */}
              <div className="sm:col-span-2 bg-gradient-to-r from-purple-50 via-indigo-50 to-pink-50 border border-purple-200/80 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center shadow-xs">
                      <Gift className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-bold text-purple-950 cursor-pointer">
                          啟用社團特惠保留
                        </label>
                        {formData.isSocialPromo && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs animate-pulse">
                            長效保留生效中
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-purple-700/80 mt-0.5">
                        開啟後自動將品項設為「預訂保留」，產生專屬驗證碼，且不受 20 分鐘計時自動過期影響。
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.isSocialPromo)}
                      onChange={(e) => handleToggleSocialPromo(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {formData.isSocialPromo && (
                  <div className="mt-3 pt-3 border-t border-purple-200/70 space-y-2.5 bg-white/80 p-3 rounded-lg border border-purple-100">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-700">專屬驗證碼：</span>
                        <span className="font-mono text-sm font-bold bg-purple-100 text-purple-900 px-2.5 py-1 rounded border border-purple-300 tracking-wider">
                          {formData.promoCode || "生成中..."}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded transition-colors shadow-2xs cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedCode ? "已複製！" : "複製驗證碼"}</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newCode = generatePromoCode();
                            setFormData((prev) => ({ ...prev, promoCode: newCode }));
                          }}
                          className="inline-flex items-center gap-1 text-xs text-purple-700 hover:text-purple-900 hover:underline cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>重新產生代碼</span>
                        </button>
                      </div>
                    </div>

                    {/* 前台專屬直達連結 */}
                    {formData.slug ? (
                      <div className="pt-2 border-t border-purple-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1 text-xs text-purple-900 font-semibold shrink-0">
                          <span>🔗</span>
                          <span>前台專屬直達連結:</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <input
                            type="text"
                            readOnly
                            value={buildPromoDirectUrl({
                              type: "outlet",
                              slug: formData.slug,
                              promoCode: formData.promoCode,
                            })}
                            className="text-xs font-mono bg-purple-50/60 border border-purple-200 rounded px-2.5 py-1 text-gray-700 w-full truncate select-all focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const directUrl = buildPromoDirectUrl({
                                type: "outlet",
                                slug: formData.slug,
                                promoCode: formData.promoCode,
                              });
                              navigator.clipboard.writeText(directUrl);
                              setCopiedLink(true);
                              setTimeout(() => setCopiedLink(false), 2000);
                            }}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded transition-colors shadow-2xs shrink-0 cursor-pointer"
                          >
                            {copiedLink ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedLink ? "已複製！" : "複製直達連結"}</span>
                          </button>
                          <a
                            href={buildPromoDirectUrl({
                              type: "outlet",
                              slug: formData.slug,
                              promoCode: formData.promoCode,
                            })}
                            target="_blank"
                            rel="noreferrer"
                            title="前往前台預覽"
                            className="p-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-xs shrink-0"
                          >
                            預覽 ↗
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-purple-600/80 italic pt-1">
                        * 請填寫 Slug 代碼以自動生成專屬前台直達連結
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Reserved Until (visible when status === 'reserved' AND not social promo) */}
              {formData.status === "reserved" && !formData.isSocialPromo && (
                <div className="sm:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-3 animate-fade-in">
                  <label className="block text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    一般預訂保留截止時間 (選填)
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="datetime-local"
                      value={toDatetimeLocalString(formData.reservedUntil)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reservedUntil: e.target.value ? new Date(e.target.value).toISOString() : null,
                        })
                      }
                      className="px-3 py-1.5 border border-amber-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
                        setFormData({ ...formData, reservedUntil: in24h.toISOString() });
                      }}
                      className="text-xs px-2.5 py-1 bg-amber-200/70 text-amber-900 rounded hover:bg-amber-300 transition-colors font-medium"
                    >
                      + 保留 24 小時
                    </button>
                    {formData.reservedUntil && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, reservedUntil: null })}
                        className="text-xs text-gray-500 hover:text-red-600"
                      >
                        清除時間
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-amber-700 mt-1">
                    * 保留截止後，可手動將狀態改回「現貨可售」或設定為「已售出」。
                  </p>
                </div>
              )}

            </div>
          </div>

          {/* Section 2: Pricing */}
          <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>特惠價格設定</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Outlet Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Outlet 特惠價 (NT$) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.price ?? 0}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Original Price */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  專櫃原價 (NT$) (選填)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                  <input
                    type="number"
                    min={0}
                    value={formData.originalPrice ?? ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        originalPrice: e.target.value === "" ? undefined : Number(e.target.value),
                      })
                    }
                    placeholder="未輸入則無劃線原價"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              {/* Discount preview */}
              {discountPercent !== null && discountPercent > 0 && (
                <div className="sm:col-span-2 flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Tag className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    折後優惠：省下 NT$ {((formData.originalPrice || 0) - (formData.price || 0)).toLocaleString()}（約{" "}
                    {100 - discountPercent} 折 / 降價 {discountPercent}%）
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Images Management (Cloudflare R2) */}
          <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>圖片管理 (Cloudflare R2 上傳)</span>
              </h3>
              <span className="text-xs text-gray-500">
                已選 {formData.images?.length || 0} 張（第一張為主圖封面）
              </span>
            </div>

            {/* Upload Buttons & Manual Input */}
            <div className="flex flex-col sm:flex-row gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-dashed border-emerald-400 bg-emerald-50/50 hover:bg-emerald-100/50 text-emerald-700 font-medium text-xs cursor-pointer transition-colors ${
                  isUploading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>圖片上傳中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>點擊選擇照片上傳 (可多選)</span>
                  </>
                )}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  disabled={isUploading}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              <div className="flex gap-2 sm:w-1/2">
                <input
                  type="text"
                  placeholder="或直接貼上圖片 URL"
                  value={manualImageUrl}
                  onChange={(e) => setManualImageUrl(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddManualImage}
                  className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                  新增
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Images Grid */}
            {formData.images && formData.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pt-2">
                {formData.images.map((img, idx) => (
                  <div
                    key={idx}
                    className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-2xs hover:shadow-md transition-shadow"
                  >
                    <div className="aspect-square bg-gray-100 relative">
                      <img
                        src={getImageUrl(img)}
                        alt={`圖片 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && (
                        <span className="absolute top-1.5 left-1.5 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-current" /> 封面
                        </span>
                      )}
                    </div>

                    {/* Actions Overlay */}
                    <div className="p-1.5 bg-white border-t border-gray-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        {idx > 0 && (
                          <button
                            type="button"
                            title="設為首圖封面"
                            onClick={() => handleSetCover(idx)}
                            className="p-1 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Star className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx > 0 && (
                          <button
                            type="button"
                            title="前移"
                            onClick={() => handleMoveImage(idx, "up")}
                            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {idx < (formData.images?.length || 0) - 1 && (
                          <button
                            type="button"
                            title="後移"
                            onClick={() => handleMoveImage(idx, "down")}
                            className="p-1 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        title="移除圖片"
                        onClick={() => handleRemoveImage(idx)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 text-center py-4 bg-white rounded-lg border border-dashed border-gray-200">
                尚未上傳任何圖片，請點擊上方按鈕上傳。
              </p>
            )}
          </div>

          {/* Section 4: Details & Notes */}
          <div className="bg-gray-50/80 p-4 rounded-xl border border-gray-200/80 space-y-4">
            <h3 className="text-sm font-bold text-gray-800 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>規格材質與特賣說明</span>
            </h3>

            <div className="space-y-4">
              {/* Material */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  材質說明
                </label>
                <input
                  type="text"
                  value={formData.material || ""}
                  onChange={(e) => setFormData({ ...formData, material: e.target.value })}
                  placeholder="例：老坑冰種隨形翡翠、925銀鍍黑金手工包鑲"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>

              {/* Source Note with quick tags */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  來源備註 / 特賣理由
                </label>
                <input
                  type="text"
                  value={formData.sourceNote || ""}
                  onChange={(e) => setFormData({ ...formData, sourceNote: e.target.value })}
                  placeholder="例：原廠展示孤品出清，成色完美，僅此一件"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white mb-2"
                />
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] text-gray-400">快速填入：</span>
                  {presetSourceNotes.map((note, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setFormData({ ...formData, sourceNote: note })}
                      className="text-[11px] px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-full hover:border-emerald-400 hover:text-emerald-700 transition-colors"
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  商品詳細描述
                </label>
                <textarea
                  rows={4}
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="輸入商品創作理念、尺寸規格、日常佩戴建議等..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>

              {/* Sort Order */}
              <div className="w-1/2 sm:w-1/3">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  排序權重 (sortOrder)
                </label>
                <input
                  type="number"
                  value={formData.sortOrder ?? 0}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                />
                <span className="text-[10px] text-gray-400">數字越小越靠前顯示</span>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEdit ? "儲存更新" : "立即建立單品"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
