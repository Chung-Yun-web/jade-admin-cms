import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

// 產生隨機英數字
function generateRandomAlphanumeric(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 取得台北時間格式與其組成
function getTaipeiDateTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value || "";
  const m = parts.find((p) => p.type === "month")?.value || "";
  const d = parts.find((p) => p.type === "day")?.value || "";
  const h = parts.find((p) => p.type === "hour")?.value || "";
  const min = parts.find((p) => p.type === "minute")?.value || "";
  const s = parts.find((p) => p.type === "second")?.value || "";

  return {
    formattedDate: `${y}/${m}/${d} ${h}:${min}:${s}`,
    timestampNoSec: `${y}${m}${d}${h}${min}`,
  };
}

// 綠界特有的 URL 編碼規則
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

// 計算 CheckMacValue
function calculateCheckMacValue(params: Record<string, string>, hashKey: string, hashIV: string): string {
  // 1. 將參數依字典順序排序
  const sortedKeys = Object.keys(params).sort();
  
  // 2. 組成 key1=value1&key2=value2...
  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  
  // 3. 前後加上 HashKey 與 HashIV
  const rawString = `HashKey=${hashKey}&${paramString}&HashIV=${hashIV}`;
  
  // 4. 進行綠界特有的 URL 編碼
  const encodedString = ecpayUrlEncode(rawString);
  
  // 5. 轉小寫
  const lowercaseString = encodedString.toLowerCase();
  
  // 6. 進行 SHA256 加密，並轉大寫
  return crypto
    .createHash("sha256")
    .update(lowercaseString)
    .digest("hex")
    .toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    // 1. 讀取環境變數並做防呆處理
    const merchantId = process.env.ECPAY_MERCHANT_ID?.trim() || "";
    const hashKey = process.env.ECPAY_HASH_KEY?.trim() || "";
    const hashIV = process.env.ECPAY_HASH_IV?.trim() || "";
    const orderPrefix = process.env.ECPAY_ORDER_PREFIX?.trim() || "JADE";
    const returnUrl = process.env.ECPAY_RETURN_URL?.trim() || "";
    const nextauthUrl = process.env.NEXTAUTH_URL?.trim() || "";

    if (!merchantId || !hashKey || !hashIV || !returnUrl) {
      return NextResponse.json(
        { error: "系統金流環境變數設定不完整" },
        { status: 500 }
      );
    }

    // 2. 解析前端傳入的參數
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "無效的請求主體 JSON 格式" },
        { status: 400 }
      );
    }

    const { totalAmount, tradeDesc, itemName, userId, isGuest, customerInfo, items, amountInfo, shippingInfo, paymentInfo } = body;

    if (!totalAmount || isNaN(Number(totalAmount)) || Number(totalAmount) <= 0) {
      return NextResponse.json(
        { error: "請提供有效的購物車總金額 (totalAmount)" },
        { status: 400 }
      );
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.phone || !customerInfo.shippingAddress || !customerInfo.email) {
      return NextResponse.json(
        { error: "請提供完整收件者聯絡資訊" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "請提供購買商品項目明細" },
        { status: 400 }
      );
    }

    // 3. 生成專屬訂單編號 (總長度限制 20 字元內)
    const { formattedDate, timestampNoSec } = getTaipeiDateTime();
    const randomSuffix = generateRandomAlphanumeric(4);
    
    // 計算剩餘可用長度，動態調整前綴
    const reservedLength = timestampNoSec.length + randomSuffix.length; // 12 + 4 = 16
    const maxPrefixLength = 20 - reservedLength; // 4
    const safePrefix = orderPrefix.substring(0, maxPrefixLength);
    
    const merchantTradeNo = `${safePrefix}${timestampNoSec}${randomSuffix}`;

    // 4. 連動 MongoDB
    const client = await clientPromise;
    const db = client.db();

    // 後端重新計算「商品小計 + 自訂物流運費 = 最終總金額 (grandTotal)」，避免前端金額遭改寫
    let calculatedSubtotal = 0;
    const enrichedItems: any[] = [];

    for (const item of items) {
      const rawId = (item.productId || "").toString();
      const dashIndex = rawId.indexOf("-");
      let cleanId = rawId;
      let spec = "";
      if (dashIndex !== -1) {
        cleanId = rawId.substring(0, dashIndex);
        spec = rawId.substring(dashIndex + 1);
      }

      let dbProduct = null;
      try {
        dbProduct = await db.collection("products").findOne({ _id: new ObjectId(cleanId) });
      } catch {
        // 預留支援非標準 ObjectId 商品 ID
        dbProduct = await db.collection("products").findOne({ originalId: cleanId });
      }

      let price = Number(item.price) || 0;
      if (dbProduct) {
        price = dbProduct.basePrice || 0;
        if (spec && dbProduct.variants && Array.isArray(dbProduct.variants)) {
          const matchedVariant = dbProduct.variants.find((v: any) => v.name === spec);
          if (matchedVariant) {
            price = matchedVariant.price;
          }
        }
      } else {
        console.warn(`[Checkout Security] 找不到商品編號：${cleanId}，採用前端傳入價格為備援：${price}`);
      }

      const quantity = Number(item.quantity) || 1;
      calculatedSubtotal += price * quantity;

      enrichedItems.push({
        productId: rawId,
        name: dbProduct ? (spec ? `${dbProduct.name} - ${spec}` : dbProduct.name) : (item.name || "精品手工飾品"),
        price: price,
        quantity: quantity,
      });
    }

    const method = shippingInfo?.method || "INSURED_HOME";
    const shippingFee = method === "INSURED_HOME" ? 100 : 60;
    const grandTotal = calculatedSubtotal + shippingFee;

    const finalAmountInfo = {
      subtotal: calculatedSubtotal,
      shippingFee: shippingFee,
      grandTotal: grandTotal,
    };

    const finalPaymentInfo = {
      provider: "ECPAY",
      status: "UNPAID",
      tradeNo: "",
    };

    const finalItemName = `${itemName || "JADE AURA 精選商品一批"}#運費(NT$${shippingFee}) x1`.substring(0, 190);
    const finalTradeDesc = `${tradeDesc || "JADE AURA 品牌線上交易"} (含自訂運費)`.substring(0, 190);

    // 如果是登入會員，更新會員資料庫中的姓名、電話、收件地址，並精準刪減已結帳的購物車品項
    if (userId && !isGuest) {
      try {
        let objectId;
        try {
          objectId = new ObjectId(userId);
        } catch {
          // 如果不符合標準 ObjectId，直接當字串處理 (NextAuth 某些 Adapter 會採用字串)
        }

        const query = objectId ? { _id: objectId } : { email: customerInfo.email };

        await db.collection("users").updateOne(
          query,
          {
            $set: {
              shippingAddress: customerInfo.shippingAddress,
            },
          },
          { upsert: false }
        );

        // Step 2: 精確扣減資料庫購物車中「已結帳」的品項，保留未勾選的暫存備選商品
        try {
          const userDoc = await db.collection("users").findOne(query);
          if (userDoc && Array.isArray(userDoc.cart)) {
            // 解析本次結帳的品項，拆解乾淨 ID 與 spec
            const checkedOutSpecs = items.map((item: any) => {
              const rawId = (item.productId || "").toString();
              const dashIndex = rawId.indexOf("-");
              let cleanId = rawId;
              let spec = "";
              if (dashIndex !== -1) {
                cleanId = rawId.substring(0, dashIndex);
                spec = rawId.substring(dashIndex + 1);
              }
              return {
                product_id: cleanId,
                spec: spec || ""
              };
            });

            const updatedCart = userDoc.cart.filter((cartItem: any) => {
              const cartProdId = (cartItem.product_id || "").toString();
              const cartSpec = cartItem.spec || "";
              
              // 檢查該資料庫車中品項是否在本次結帳清單中
              const isCheckedOut = checkedOutSpecs.some((checkedItem: any) => {
                return checkedItem.product_id === cartProdId && checkedItem.spec === cartSpec;
              });

              // 僅保留「未被結帳」的商品
              return !isCheckedOut;
            }).map((cartItem: any) => ({
              ...cartItem,
              source: "db", // All remaining unselected items become official "db" items
            }));

            await db.collection("users").updateOne(
              query,
              { $set: { cart: updatedCart } }
            );
          }
        } catch (syncCartErr) {
          console.error("結帳精準刪減會員購物車失敗，但不中斷訂單流程:", syncCartErr);
        }
      } catch (err) {
        console.error("更新會員個資失敗，但不中斷結帳流程:", err);
      }
    }

    // 5. 建立待付款訂單寫入 orders 集合
    const orderDoc = {
      orderNumber: merchantTradeNo,
      userId: userId ? userId : null,
      totalAmount: grandTotal,
      paymentStatus: "pending",
      createdAt: new Date(),
      customerInfo: {
        name: customerInfo.name,
        email: customerInfo.email,
        phone: customerInfo.phone,
        shippingAddress: customerInfo.shippingAddress,
      },
      items: enrichedItems,
      isGuest: Boolean(isGuest),
      amountInfo: finalAmountInfo,
      shippingInfo: shippingInfo || null,
      paymentInfo: finalPaymentInfo
    };

    await db.collection("orders").insertOne(orderDoc);

    // 6. 封裝綠界必要的 POST 參數 (全部必須是字串格式以利後續排序與簽章)
    const params: Record<string, string> = {
      MerchantID: merchantId,
      MerchantTradeNo: merchantTradeNo,
      MerchantTradeDate: formattedDate,
      PaymentType: "aio",
      TotalAmount: String(Math.round(grandTotal)), // 確保金額為整數
      TradeDesc: finalTradeDesc,
      ItemName: finalItemName,
      ReturnURL: returnUrl,
      ChoosePayment: "ALL",
      EncryptType: "1",
    };

    // 確保 OrderResultURL（用戶端跳轉回呼）採用正確的公網基底網址
    // 如果 ReturnURL 是公網 ngrok / Vercel 網址，優先從 ReturnURL 擷取 origin 作為基礎
    let baseUrl = nextauthUrl;
    if (returnUrl && returnUrl.startsWith("http")) {
      try {
        const parsedUrl = new URL(returnUrl);
        baseUrl = parsedUrl.origin;
      } catch (e) {
        console.error("Failed to parse returnUrl for base URL:", e);
      }
    }

    if (baseUrl) {
      params.OrderResultURL = `${baseUrl}/api/ecpay/callback`;
    }

    // 7. 進行綠界演算法加密，產出 CheckMacValue
    const checkMacValue = calculateCheckMacValue(params, hashKey, hashIV);

    console.log("=== [ECPay Payment Checkout debug] ===");
    console.log("MerchantTradeNo (OrderNumber):", merchantTradeNo);
    console.log("Subtotal (Calculated):", calculatedSubtotal);
    console.log("ShippingFee:", shippingFee);
    console.log("grandTotal (TotalAmount):", grandTotal);
    console.log("ItemName:", finalItemName);
    console.log("TradeDesc:", finalTradeDesc);
    console.log("Calculated CheckMacValue (SHA256):", checkMacValue);
    console.log("=======================================");

    // 8. 將所有參數與算好的 CheckMacValue 回傳給前端
    return NextResponse.json({
      ...params,
      CheckMacValue: checkMacValue,
    });
  } catch (error: any) {
    console.error("ECPay checkout API error:", error);
    return NextResponse.json(
      { error: "伺服器內部錯誤，無法生成交易參數" },
      { status: 500 }
    );
  }
}
