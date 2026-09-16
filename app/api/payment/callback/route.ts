import { NextRequest } from 'next/server';
import crypto from 'crypto';
import clientPromise from '../../../../lib/mongodb';

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

    if (!hashKey || !hashIV) {
      console.error('ECPay Callback Error: Missing gold flow credentials in env.');
      return new Response('0|ERR_CREDENTIALS', { status: 500 });
    }

    // 1. 接收綠界發送過來的 FormData
    const formData = await req.formData();
    const data: Record<string, string> = {};
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    const receivedCheckMacValue = data.CheckMacValue;
    if (!receivedCheckMacValue) {
      console.error('ECPay Callback Error: CheckMacValue is missing in request.');
      return new Response('0|ERR_MISSING_MAC', { status: 400 });
    }

    // 2. 安全驗證：排除 CheckMacValue 本身，重新用 HashKey 與 HashIV 算一次 CheckMacValue
    const { CheckMacValue, ...paramsToVerify } = data;
    const calculatedCheckMacValue = calculateCheckMacValue(paramsToVerify, hashKey, hashIV);

    if (calculatedCheckMacValue !== receivedCheckMacValue) {
      console.error(`ECPay Callback Signature Error! Calculated: ${calculatedCheckMacValue}, Received: ${receivedCheckMacValue}`);
      return new Response('0|ERR_SIGNATURE', { status: 400 });
    }

    // 3. 更新資料庫：若 RtnCode === '1' (代表付款成功)
    const { MerchantTradeNo, RtnCode, TradeNo } = data;

    if (RtnCode === '1') {
      const client = await clientPromise;
      const db = client.db();

      // 根據 MerchantTradeNo (對應 orderNumber) 更新訂單狀態
      const result = await db.collection('orders').updateOne(
        { orderNumber: MerchantTradeNo },
        {
          $set: {
            paymentStatus: 'paid',
            paymentIntentId: TradeNo || null, // 記錄綠界科技的交易聯邦單號
          },
        }
      );

      console.log(`Successfully processed ECPay callback for order ${MerchantTradeNo}. DB update result:`, result);
    } else {
      console.log(`ECPay callback received for order ${MerchantTradeNo} but payment failed or pending. RtnCode: ${RtnCode}`);
    }

    // 4. 回應綠界：純文字 1|OK
    return new Response('1|OK', {
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error: any) {
    console.error('ECPay callback server exception:', error);
    return new Response('0|ERR_EXCEPTION', { status: 500 });
  }
}
