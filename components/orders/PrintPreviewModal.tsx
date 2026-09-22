import React, { useState, useEffect, useRef } from "react";
import { 
  X, 
  Printer, 
  ShieldCheck, 
  Store, 
  Loader2,
  AlertCircle
} from "lucide-react";
import { Order } from "@/types/order";

interface PrintPreviewModalProps {
  order: Order | null;
  initialType?: "INSURED_HOME" | "CVS_STORE";
  onClose: () => void;
  onPrintSuccess?: (order: Order) => void;
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  order,
  initialType,
  onClose,
  onPrintSuccess,
}) => {
  const [labelType, setLabelType] = useState<"INSURED_HOME" | "CVS_STORE">("INSURED_HOME");
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!order) return;
    if (initialType) {
      setLabelType(initialType);
    } else {
      const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
      setLabelType(isCvs ? "CVS_STORE" : "INSURED_HOME");
    }
  }, [order, initialType]);

  useEffect(() => {
    if (!order) return;
    const fetchHtml = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/admin/orders/print", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ order, labelType }),
        });
        const data = await res.json();
        if (data.success && data.html) {
          setPreviewHtml(data.html);
        }
      } catch (err) {
        console.error("載入列印預覽 HTML 失敗:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHtml();
  }, [order, labelType]);

  if (!order) return null;

  const handlePrint = () => {
    if (!iframeRef.current) return;
    try {
      const iframeWindow = iframeRef.current.contentWindow;
      if (iframeWindow) {
        iframeWindow.focus();
        iframeWindow.print();
        if (onPrintSuccess) {
          onPrintSuccess(order);
        }
      }
    } catch (err) {
      console.error("列印失敗:", err);
      // Fallback: 打開新視窗列印
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(previewHtml);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
          if (onPrintSuccess) onPrintSuccess(order);
        }, 500);
      }
    }
  };

  const isCvs = order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                出貨標籤列印預覽
              </h3>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                訂單：{order.orderNumber} ({isCvs ? "超商取貨" : "尊榮保價宅配"})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 標籤格式切換 Tab */}
        <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex gap-1.5 p-1 bg-gray-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLabelType("INSURED_HOME")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                labelType === "INSURED_HOME"
                  ? "bg-white text-amber-800 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>尊榮保價宅配單 (100×150mm)</span>
            </button>
            <button
              type="button"
              onClick={() => setLabelType("CVS_STORE")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${
                labelType === "CVS_STORE"
                  ? "bg-white text-purple-800 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Store className="w-3.5 h-3.5 text-purple-600" />
              <span>超商取貨貼紙標籤 (100×150mm)</span>
            </button>
          </div>
        </div>

        {/* 預覽區域 (Iframe) */}
        <div className="p-4 bg-gray-100/70 flex-1 overflow-auto flex items-center justify-center min-h-[440px]">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 text-gray-500 py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              <span className="text-xs">正在渲染標籤條碼與版型...</span>
            </div>
          ) : (
            <div className="w-[100mm] h-[150mm] max-h-[520px] bg-white shadow-lg border border-gray-300 rounded overflow-hidden">
              <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                title="Print Preview"
                className="w-full h-full border-0"
              />
            </div>
          )}
        </div>

        {/* Footer 操作列 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-gray-400" />
            <span>支援 100×150mm 熱感應貼紙機或 A4 格式列印</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 hover:bg-gray-50 rounded-lg text-xs font-medium text-gray-700 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !previewHtml}
              className="flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>立即列印標籤</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
