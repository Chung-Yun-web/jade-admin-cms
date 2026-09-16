import { NextRequest } from 'next/server';
import crypto from 'crypto';
import clientPromise from '@/lib/mongodb';

// 綠界特有的 URL 編碼規則
function ecpayUrlEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/%20/g, '+')
    .replace(/%2D/g, '-')
    .replace(/%5F/g, '_')
    .replace(/%2E/g, '.')
    .replace(/%21/g, '!')
    .replace(/%2A/g, '*')
    .replace(/%28/g, '(')
    .replace(/%29/g, ')');
}

// 計算 CheckMacValue
function calculateCheckMacValue(params: Record<string, string>, hashKey: string, hashIV: string): string {
  // 1. 將參數依字典順序排序
  const sortedKeys = Object.keys(params).sort();
  
  // 2. 組成 key1=value1&key2=value2...
  const paramString = sortedKeys
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  
  // 3. 前後加上 HashKey 與 HashIV
  const rawString = `HashKey=${hashKey}&${paramString}&HashIV=${hashIV}`;
  
  // 4. 進行綠界特有的 URL 編碼
  const encodedString = ecpayUrlEncode(rawString);
  
  // 5. 轉小寫
  const lowercaseString = encodedString.toLowerCase();
  
  // 6. 進行 SHA256 加密，並轉大寫
  return crypto
    .createHash('sha256')
    .update(lowercaseString)
    .digest('hex')
    .toUpperCase();
}

export async function POST(req: NextRequest) {
  try {
    const hashKey = process.env.ECPAY_HASH_KEY?.trim() || '';
    const hashIV = process.env.ECPAY_HASH_IV?.trim() || '';

    // 1. 接收來自 ECPay 的 POST 請求中的 FormData (用戶瀏覽器 POST 過來的值)
    let data: Record<string, string> = {};
    try {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } catch (err) {
      console.warn('ECPay callback direct POST had no formData or failed to parse:', err);
    }

    console.log('ECPay browser redirect callback received data:', data);

    const receivedCheckMacValue = data.CheckMacValue;
    const { MerchantTradeNo, RtnCode, TradeNo } = data;

    // 2. 如果有資料，做安全驗證與資料庫更新（雙重保險）
    if (receivedCheckMacValue && hashKey && hashIV) {
      const { CheckMacValue, ...paramsToVerify } = data;
      const calculatedCheckMacValue = calculateCheckMacValue(paramsToVerify, hashKey, hashIV);

      if (calculatedCheckMacValue === receivedCheckMacValue) {
        if (RtnCode === '1') {
          const client = await clientPromise;
          const db = client.db();

          // 根據 MerchantTradeNo (對應 orderNumber) 更新訂單狀態
          const result = await db.collection('orders').updateOne(
            { orderNumber: MerchantTradeNo },
            {
              $set: {
                paymentStatus: 'paid',
                paymentIntentId: TradeNo || null,
              },
            }
          );
          console.log(`[Double Insurance] Successfully processed ECPay browser callback for order ${MerchantTradeNo}. DB update result:`, result);
        } else {
          console.log(`[Double Insurance] ECPay browser callback received for order ${MerchantTradeNo} but payment failed. RtnCode: ${RtnCode}`);
        }
      } else {
        console.error(`[Double Insurance] ECPay Browser Callback Signature Error! Calculated: ${calculatedCheckMacValue}, Received: ${receivedCheckMacValue}`);
      }
    }

    // 3. 獲取成功跳轉頁面的完整 URL。優先採用與當前請求相同的 Host 以免 Session 遺失
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const successUrl = new URL('/checkout/success', `${protocol}://${host}`);

    console.log('Redirecting user to success URL via HTML + JS:', successUrl.toString());

    // 4. 回傳包含 JavaScript 導向的 HTML 網頁，避免 302 導向在 POST 請求中失效或造成安全問題
    return new Response(
      `<html>
        <head>
          <title>Redirecting...</title>
          <script>
            window.location.href = "${successUrl.toString()}";
          </script>
        </head>
        <body style="font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9f9f9; color: #333;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <h2 style="font-weight: 300; margin-bottom: 8px;">付款驗證完成</h2>
            <p style="font-size: 14px; color: #666; margin-bottom: 20px;">正在為您導向至訂單成功頁面，請稍候...</p>
            <div style="width: 24px; height: 24px; border: 2px solid #0B251A; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <style>
              @keyframes spin { to { transform: rotate(360deg); } }
            </style>
          </div>
        </body>
      </html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  } catch (error) {
    console.error('ECPay callback redirect error:', error);
    // 即使發生錯誤也盡量跳轉回成功頁面
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const successUrl = new URL('/checkout/success', `${protocol}://${host}`);
    
    return new Response(
      `<html>
        <head>
          <script>
            window.location.href = "${successUrl.toString()}";
          </script>
        </head>
        <body>
          <p>Redirecting...</p>
        </body>
      </html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );
  }
}
