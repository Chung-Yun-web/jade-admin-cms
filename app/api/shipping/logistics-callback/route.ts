import { NextRequest } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { sendShippingStatusEmail } from "@/lib/email";
import { Order } from "@/types/order";

export const revalidate = 0;

/**
 * 綠界特有的 URL 編碼規則
 */
function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, "+")
    .replace(/%2D/g, "-")
    .replace(/%5F/g, "_")
    .replace(/%2E/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2A/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

/**
 * 綠界物流 CheckMacValue (MD5 加密) 計算邏輯
 */
function calculateMD5CheckMacValue(
  params: Record<string, string>,
  hashKey: string,
  hashIV: string
): string {
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  const rawString = `HashKey=${hashKey}&${paramString}&HashIV=${hashIV}`;
  const encodedString = ecpayUrlEncode(rawString);
  const lowercaseString = encodedString.toLowerCase();
  return crypto
    .createHash("md5")
    .update(lowercaseString)
    .digest("hex")
    .toUpperCase();
}

/**
 * 處理綠界物流 Webhook (POST) 貨態回傳
 */
export async function POST(req: NextRequest) {
  try {
    const hashKey =
      process.env.ECPAY_LOGISTICS_HASH_KEY?.trim() || "5294y06J1Ssq5Thj";
    const hashIV =
      process.env.ECPAY_LOGISTICS_HASH_IV?.trim() || "v77hoKGq4kWxNNIS";

    // 1. 解析來自綠界的 FormData / URL-encoded 參數
    const data: Record<string, string> = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } else {
      // 備援：以文字方式解析表單字串
      const rawText = await req.text();
      const searchParams = new URLSearchParams(rawText);
      searchParams.forEach((value, key) => {
        data[key] = value;
      });
    }

    console.log("=== [ECPay Logistics Webhook Received] ===");
    console.log(data);
    console.log("==========================================");

    const receivedCheckMacValue = data.CheckMacValue;
    if (!receivedCheckMacValue) {
      console.error("[ECPay Logistics Webhook] 缺少 CheckMacValue 參數！");
      return new Response("0|ERR_MISSING_MAC", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 2. 簽章安全驗證
    const { CheckMacValue, ...paramsToVerify } = data;
    const calculatedCheckMacValue = calculateMD5CheckMacValue(paramsToVerify, hashKey, hashIV);

    if (calculatedCheckMacValue.toUpperCase() !== receivedCheckMacValue.toUpperCase()) {
      console.error(
        `[ECPay Logistics Webhook] 簽章驗證失敗！Calculated: ${calculatedCheckMacValue}, Received: ${receivedCheckMacValue}`
      );
      return new Response("0|ERR_CHECK_MAC_VALUE", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 3. 提取關鍵物流參數
    const merchantTradeNo = data.MerchantTradeNo; // 對應 orderNumber
    const rtnCode = data.RtnCode || "";
    const rtnMsg = data.RtnMsg || "";
    const allPayLogisticsId = data.AllPayLogisticsID || "";
    const cvsPaymentNo = data.CVSPaymentNo || "";
    const cvsValidationNo = data.CVSValidationNo || "";
    const updateStatusDate = data.UpdateStatusDate || "";

    if (!merchantTradeNo) {
      console.error("[ECPay Logistics Webhook] 缺少 MerchantTradeNo 訂單編號");
      return new Response("0|ERR_MISSING_TRADE_NO", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 4. 連動 MongoDB 查詢該訂單
    const client = await clientPromise;
    const db = client.db();

    const existingOrder = await db.collection("orders").findOne({
      orderNumber: merchantTradeNo,
    });

    if (!existingOrder) {
      console.warn(`[ECPay Logistics Webhook] 查無訂單編號: ${merchantTradeNo}`);
      return new Response("0|ERR_ORDER_NOT_FOUND", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 5. 組裝增量更新欄位，保留沿用既有欄位
    const updateFields: any = {
      updatedAt: new Date(),
      status: rtnMsg || `超商物流代碼: ${rtnCode}`,
      "shippingInfo.rtnCode": rtnCode,
      "shippingInfo.rtnMsg": rtnMsg,
      "shippingInfo.updateStatusDate": updateStatusDate,
    };

    if (allPayLogisticsId) {
      updateFields["shippingInfo.allPayLogisticsId"] = allPayLogisticsId;
    }
    if (cvsPaymentNo) {
      updateFields["shippingInfo.cvsPaymentNo"] = cvsPaymentNo;
    }
    if (cvsValidationNo) {
      updateFields["shippingInfo.cvsValidationNo"] = cvsValidationNo;
    }

    // 若訂單原本無 trace 物流追蹤號，將超商寄件代號或物流編號自動寫入 trace
    if (!existingOrder.trace && (cvsPaymentNo || allPayLogisticsId)) {
      updateFields.trace = cvsPaymentNo || allPayLogisticsId;
    }

    // 判斷物流狀態是否代表已交寄或出貨（例如 300 訂單處理中、2030 運送中、2063 抵達門市、2067 買家已取貨、3003 買家取件等）
    const isDispatched = ["300", "2030", "2063", "2067", "3003"].includes(rtnCode);
    const shouldMarkShipped = isDispatched && existingOrder.shippingStatus !== "SHIPPED";

    if (shouldMarkShipped) {
      updateFields.shippingStatus = "SHIPPED";
      if (!existingOrder.shippedAt) {
        updateFields.shippedAt = new Date();
      }
    }

    // 執行資料庫更新
    await db.collection("orders").updateOne(
      { orderNumber: merchantTradeNo },
      { $set: updateFields }
    );

    console.log(
      `[ECPay Logistics Webhook] 訂單 ${merchantTradeNo} 物流狀態更新成功 (RtnCode: ${rtnCode}, RtnMsg: ${rtnMsg})`
    );

    // 6. 出貨庫存連動（當從未出貨變成已出貨時）
    if (shouldMarkShipped && Array.isArray(existingOrder.items)) {
      try {
        for (const item of existingOrder.items) {
          const pId = item.productId;
          const pName = item.name;
          const specName = item.spec;

          const filter: any = {};
          if (pId) {
            if (ObjectId.isValid(pId)) {
              filter.$or = [{ _id: new ObjectId(pId) }, { originalId: pId }];
            } else {
              filter.originalId = pId;
            }
          } else if (pName) {
            filter.name = pName;
          }

          if (Object.keys(filter).length > 0) {
            const productDoc = await db.collection("products").findOne(filter);
            if (productDoc && Array.isArray(productDoc.variants) && productDoc.variants.length > 0) {
              let variantIndex = -1;
              if (specName) {
                variantIndex = productDoc.variants.findIndex((v: any) => v.name === specName);
              }
              if (variantIndex === -1) {
                variantIndex = 0;
              }

              const updateKey = `variants.${variantIndex}.status`;
              await db.collection("products").updateOne(
                { _id: productDoc._id },
                {
                  $set: {
                    [updateKey]: "sold",
                    updatedAt: new Date(),
                  },
                }
              );
              console.log(
                `[MongoDB] Logistics linked shipment: Product ${productDoc.name} variant [${variantIndex}] marked as sold`
              );
            }
          }
        }
      } catch (stockErr) {
        console.warn("[MongoDB] Logistics stock update warning:", stockErr);
      }
    }

    // 7. 自動發送貨態變更通知信 (使用 await 避免 Vercel Serverless 提早中斷，含訪客防呆且不影響主流程)
    const updatedOrder: Order = {
      ...existingOrder,
      ...updateFields,
      shippingInfo: {
        ...existingOrder.shippingInfo,
        rtnCode,
        rtnMsg,
        allPayLogisticsId: allPayLogisticsId || existingOrder.shippingInfo?.allPayLogisticsId,
        cvsPaymentNo: cvsPaymentNo || existingOrder.shippingInfo?.cvsPaymentNo,
        cvsValidationNo: cvsValidationNo || existingOrder.shippingInfo?.cvsValidationNo,
        updateStatusDate: updateStatusDate || existingOrder.shippingInfo?.updateStatusDate,
      },
      status: rtnMsg || existingOrder.status,
      trace: updateFields.trace || existingOrder.trace,
      shippingStatus: updateFields.shippingStatus || existingOrder.shippingStatus,
    } as unknown as Order;

    try {
      await sendShippingStatusEmail(updatedOrder, rtnMsg);
    } catch (err) {
      console.error("[ECPay Logistics Webhook] 自動寄信失敗但流程不中斷:", err);
    }

    // 8. 回應綠界 1|OK
    return new Response("1|OK", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "ERR_EXCEPTION";
    console.error("[ECPay Logistics Webhook Exception]:", error);
    return new Response(`0|${errorMsg}`, {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
