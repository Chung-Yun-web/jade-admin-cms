import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const revalidate = 0;

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

// 綠界物流 CheckMacValue (MD5 加密) 計算邏輯
function calculateMD5CheckMacValue(params: Record<string, string>, hashKey: string, hashIV: string): string {
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
  
  // 6. 進行 MD5 加密，並轉大寫
  return crypto
    .createHash("md5")
    .update(lowercaseString)
    .digest("hex")
    .toUpperCase();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const subType = searchParams.get("subType") || "UNIMART";

    // 讀取環境變數 (優先採用 .env.local 中的物流專用金鑰，否則回退到官方物流 Staging 預設值)
    const merchantId = process.env.ECPAY_LOGISTICS_MERCHANT_ID?.trim() || "2000132";
    const hashKey = process.env.ECPAY_LOGISTICS_HASH_KEY?.trim() || "5294y06J1Ssq5Thj";
    const hashIV = process.env.ECPAY_LOGISTICS_HASH_IV?.trim() || "v77hoKGq4kWxNNIS";

    // 動態取得當前的 Host 與 Protocol 來產生 ServerReplyURL
    const host = req.headers.get("host") || "localhost:3000";
    const protocol = req.headers.get("x-forwarded-proto") || "http";
    const replyUrlObj = new URL("/api/shipping/map-callback", `${protocol}://${host}`);
    const ServerReplyURL = replyUrlObj.toString();

    // 建立綠界地圖必要欄位 (B2C 規格)
    const params: Record<string, string> = {
      MerchantID: merchantId,
      LogisticsType: "CVS",
      LogisticsSubType: subType,
      IsCollection: "N",
      ServerReplyURL: ServerReplyURL,
      ExtraData: "",
    };

    // 計算 MD5 的 CheckMacValue
    const CheckMacValue = calculateMD5CheckMacValue(params, hashKey, hashIV);

    console.log("=== [ECPay Map Redirection debug] ===");
    console.log("MerchantID:", merchantId);
    console.log("LogisticsType:", "CVS");
    console.log("LogisticsSubType:", subType);
    console.log("IsCollection:", "N");
    console.log("ServerReplyURL:", ServerReplyURL);
    console.log("ExtraData:", '""');
    console.log("Calculated CheckMacValue (MD5):", CheckMacValue);
    console.log("======================================");

    // 產生 HTML 自動提交 Form 表單至綠界物流地圖
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>正在導向至綠界電子地圖...</title>
          <meta charset="utf-8" />
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #f9f9f9;
              color: #333;
            }
            .loader {
              width: 40px;
              height: 40px;
              border: 3px solid #0B251A;
              border-top-color: transparent;
              border-radius: 50%;
              animation: spin 1s linear infinite;
              margin-bottom: 20px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="loader"></div>
          <p>正在導向至綠界電子地圖，請稍候...</p>
          <form id="ecpay-map-form" action="https://logistics-stage.ecpay.com.tw/Express/map" method="POST" style="display: none;">
            <input type="hidden" name="MerchantID" value="${merchantId}" />
            <input type="hidden" name="LogisticsType" value="CVS" />
            <input type="hidden" name="LogisticsSubType" value="${subType}" />
            <input type="hidden" name="IsCollection" value="N" />
            <input type="hidden" name="ServerReplyURL" value="${ServerReplyURL}" />
            <input type="hidden" name="ExtraData" value="" />
            <input type="hidden" name="CheckMacValue" value="${CheckMacValue}" />
          </form>
          <script>
            document.getElementById('ecpay-map-form').submit();
          </script>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (error: any) {
    console.error("ECPay Map redirection error:", error);
    return NextResponse.json({ error: "無法導向電子地圖頁面" }, { status: 500 });
  }
}
