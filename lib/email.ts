import { Order } from "@/types/order";

export interface SendEmailResult {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  data?: unknown;
}

/**
 * 訪客結帳防呆驗證：檢查訂單收件者是否具備有效 Email
 */
function isValidEmail(email?: string | null): email is string {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed) return false;
  // 基礎 Email 格式檢查
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * 格式化貨幣數字
 */
function formatCurrency(amount: number = 0): string {
  return amount.toLocaleString("zh-TW");
}

/**
 * 呼叫 Resend REST API 發送信件
 */
async function sendViaResend({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<unknown> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("NO_API_KEY");
  }

  const fromEmail = process.env.EMAIL_FROM?.trim() || "巧鈺好飾 JADE AURA <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject: subject,
      html: html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API HTTP ${response.status}: ${errorBody}`);
  }

  return await response.json();
}

/**
 * 訂單成立通知信 (發送給顧客)
 * 訪客結帳防呆：若無 Email 則安全略過並記錄 Log，不中斷業務流程
 */
export async function sendOrderConfirmationEmail(order: Order): Promise<SendEmailResult> {
  try {
    const recipientEmail = order.customerInfo?.email?.trim();

    // 訪客結帳防呆檢查
    if (!isValidEmail(recipientEmail)) {
      console.log(
        `[Email Safe Skip] 訂單 ${order.orderNumber} 為一次性訪客結帳或未填寫電子郵件 (email: "${recipientEmail || ""}")，安全略過發信通知。`
      );
      return { success: true, skipped: true, reason: "NO_EMAIL" };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn(
        `[Email Safe Skip] 系統尚未設定 RESEND_API_KEY，略過真實發信通知 (訂單: ${order.orderNumber}, 收件者: ${recipientEmail})。`
      );
      return { success: true, skipped: true, reason: "NO_API_KEY" };
    }

    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      "https://jade-brand-site.vercel.app";

    const isCvs =
      order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
    const shippingMethodName =
      order.shippingInfo?.methodName || (isCvs ? "超商純取貨" : "保值郵寄");
    const receiverName =
      order.shippingInfo?.receiverName || order.customerInfo?.name || "尊榮貴賓";
    const receiverPhone =
      order.shippingInfo?.receiverPhone || order.customerInfo?.phone || "";

    const shippingDestHtml = isCvs
      ? `<div style="padding: 12px; background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; margin-top: 8px;">
           <strong style="color: #5b21b6;">取件門市：${order.shippingInfo?.storeName || "超商指定門市"}</strong>
           ${order.shippingInfo?.storeId ? `<span style="font-size: 11px; background: #e0e7ff; color: #3730a3; padding: 2px 6px; border-radius: 4px; margin-left: 6px;">門市代號：${order.shippingInfo.storeId}</span>` : ""}
           <div style="font-size: 12px; color: #6b7280; margin-top: 4px;">門市地址：${order.shippingInfo?.storeAddress || "請參閱門市系統資料"}</div>
         </div>`
      : `<div style="padding: 12px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-top: 8px;">
           <strong style="color: #92400e;">配送地址：${order.shippingInfo?.address || order.customerInfo?.shippingAddress || "未提供配送地址"}</strong>
           <div style="font-size: 12px; color: #b45309; margin-top: 4px;">★ 巧鈺好飾高額全保價包裹 · 專人親交簽收</div>
         </div>`;

    const itemsHtml = (order.items || [])
      .map(
        (item) => `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 12px 8px; vertical-align: top;">
            <div style="font-weight: 600; color: #111827; font-size: 14px;">${item.name}</div>
            ${item.spec ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">規格款式: ${item.spec}</div>` : ""}
          </td>
          <td style="padding: 12px 8px; text-align: center; vertical-align: top; color: #374151; font-size: 13px;">
            ${item.quantity || 1}
          </td>
          <td style="padding: 12px 8px; text-align: right; vertical-align: top; color: #111827; font-weight: 600; font-family: monospace; font-size: 14px;">
            NT$ ${formatCurrency((item.price || 0) * (item.quantity || 1))}
          </td>
        </tr>`
      )
      .join("");

    const grandTotal = order.amountInfo?.grandTotal || order.totalAmount || 0;
    const shippingFee = order.amountInfo?.shippingFee ?? (isCvs ? 60 : 100);
    const subtotal = order.amountInfo?.subtotal || Math.max(0, grandTotal - shippingFee);

    const subject = `【巧鈺好飾 JADE AURA】訂單成立確認信（訂單編號：${order.orderNumber}）`;

    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang TC', 'Microsoft JhengHei', sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #09261a 0%, #12402d 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px;">巧鈺好飾</h1>
              <div style="color: #a7f3d0; font-size: 11px; letter-spacing: 3px; margin-top: 4px; text-transform: uppercase;">JADE AURA JEWELRY</div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 30px 28px;">
              <div style="font-size: 16px; font-weight: 600; color: #064e3b; margin-bottom: 12px;">
                親愛的 ${receiverName} 您好：
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 0; margin-bottom: 24px;">
                感謝您於巧鈺好飾選購天然翡翠珠寶。我們已收到您的訂單，專業珠寶師傅正細心為您的珍品進行出貨前品檢與專屬保價包裝。
              </p>

              <!-- Order Summary Card -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                <div style="font-size: 12px; color: #6b7280;">訂單編號</div>
                <div style="font-size: 17px; font-weight: 700; font-family: monospace; color: #111827; margin-top: 2px;">${order.orderNumber}</div>
                <div style="font-size: 12px; color: #9ca3af; margin-top: 6px;">下單時間：${new Date(order.createdAt).toLocaleString("zh-TW", { hour12: false })}</div>
              </div>

              <!-- Shipping Info Card -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 10px;">配送與收件資訊</div>
                <div style="font-size: 13px; color: #4b5563; line-height: 1.6;">
                  <div>收件貴賓：<strong>${receiverName}</strong></div>
                  <div>聯絡電話：${receiverPhone || "未提供"}</div>
                  <div>運送方式：<strong>${shippingMethodName}</strong></div>
                </div>
                ${shippingDestHtml}
              </div>

              <!-- Items Table -->
              <div style="margin-bottom: 24px;">
                <div style="font-size: 14px; font-weight: 700; color: #111827; margin-bottom: 10px;">訂購飾品明細</div>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                  <thead>
                    <tr style="background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; font-size: 12px; color: #6b7280;">
                      <th align="left" style="padding: 8px;">商品名稱</th>
                      <th align="center" style="padding: 8px; width: 60px;">數量</th>
                      <th align="right" style="padding: 8px; width: 90px;">小計</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                </table>
              </div>

              <!-- Amount Calculation -->
              <div style="background-color: #f9fafb; border-radius: 12px; padding: 16px 20px; margin-bottom: 28px;">
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; margin-bottom: 6px;">
                  <span>商品總計</span>
                  <span style="font-family: monospace;">NT$ ${formatCurrency(subtotal)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 13px; color: #6b7280; margin-bottom: 8px;">
                  <span>物流運費</span>
                  <span style="font-family: monospace;">NT$ ${formatCurrency(shippingFee)}</span>
                </div>
                <div style="border-top: 1px dashed #d1d5db; padding-top: 8px; display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #047857;">
                  <span>應付與實付總額</span>
                  <span style="font-family: monospace;">NT$ ${formatCurrency(grandTotal)}</span>
                </div>
              </div>

              <!-- Action Button -->
              <div style="text-align: center; margin-bottom: 16px;">
                <a href="${frontendUrl}/orders/track" target="_blank" style="display: inline-block; background-color: #065f46; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 9999px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(6, 95, 70, 0.2);">
                  查詢即時訂單與貨態
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 28px; text-align: center; font-size: 12px; color: #9ca3af;">
              <div style="margin-bottom: 6px;">巧鈺好飾 翡翠珠寶旗艦館 · 客服專線：(02) 2788-9999</div>
              <div>此信件為系統自動發出，請勿直接回覆。如有任何疑問，歡迎造訪官方網站與我們聯繫。</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const res = await sendViaResend({
      to: recipientEmail,
      subject: subject,
      html: html,
    });

    console.log(`[Email Service] 訂單成立通知信已成功發送至 ${recipientEmail} (訂單: ${order.orderNumber})`);
    return { success: true, data: res };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Email Service] 發送訂單成立通知信失敗 (訂單: ${order.orderNumber}):`, error);
    // 安全攔截，絕不拋出 Error
    return { success: false, error: errorMsg };
  }
}

/**
 * 貨態變更通知信 (發送給顧客)
 * 訪客結帳防呆：若無 Email 則安全略過並記錄 Log，不中斷業務流程
 */
export async function sendShippingStatusEmail(
  order: Order,
  newStatusText?: string
): Promise<SendEmailResult> {
  try {
    const recipientEmail = order.customerInfo?.email?.trim();

    // 訪客結帳防呆檢查
    if (!isValidEmail(recipientEmail)) {
      console.log(
        `[Email Safe Skip] 訂單 ${order.orderNumber} 貨態變更，但為訪客結帳或未填寫電子郵件 (email: "${recipientEmail || ""}")，安全略過發信。`
      );
      return { success: true, skipped: true, reason: "NO_EMAIL" };
    }

    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      console.warn(
        `[Email Safe Skip] 系統尚未設定 RESEND_API_KEY，略過貨態變更發信 (訂單: ${order.orderNumber}, 收件者: ${recipientEmail})。`
      );
      return { success: true, skipped: true, reason: "NO_API_KEY" };
    }

    const frontendUrl =
      process.env.NEXT_PUBLIC_FRONTEND_URL?.trim() ||
      process.env.NEXTAUTH_URL?.trim() ||
      "https://jade-brand-site.vercel.app";

    const isCvs =
      order.shippingInfo?.method === "CVS_STORE" || Boolean(order.shippingInfo?.storeId);
    const shippingMethodName =
      order.shippingInfo?.methodName || (isCvs ? "超商純取貨" : "保值郵寄");
    const receiverName =
      order.shippingInfo?.receiverName || order.customerInfo?.name || "尊榮貴賓";

    const statusDisplay =
      newStatusText ||
      order.status ||
      (order.shippingStatus === "SHIPPED" ? "已出貨運送中" : "處理中");

    const traceNumber =
      order.trace ||
      order.shippingInfo?.cvsPaymentNo ||
      order.shippingInfo?.allPayLogisticsId ||
      "";

    const subject = `【巧鈺好飾 JADE AURA】出貨貨態變更通知（訂單編號：${order.orderNumber}）`;

    const reminderHtml = isCvs
      ? `<div style="padding: 12px 14px; background-color: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; margin-top: 14px; font-size: 13px; color: #5b21b6;">
           <strong>超商取貨貼心提醒：</strong>
           <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 12px; color: #6d28d9;">
             <li>門市純取貨需出示與包裹收件人相符之【身分證件正本】方可領取。</li>
             <li>請於包裹抵達門市後 7 日內完成取貨，避免包裹逾期退回。</li>
           </ul>
         </div>`
      : `<div style="padding: 12px 14px; background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; margin-top: 14px; font-size: 13px; color: #92400e;">
           <strong>尊榮保值郵寄簽收提醒：</strong>
           <ul style="margin: 6px 0 0 0; padding-left: 20px; font-size: 12px; color: #b45309;">
             <li>此包裹已附加全額保值保險，配送人員將親交由本人或指定人員簽收。</li>
             <li>簽收時請確認包裹完整無拆封痕跡。</li>
           </ul>
         </div>`;

    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang TC', 'Microsoft JhengHei', sans-serif; color: #1f2937;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;" cellspacing="0" cellpadding="0">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #09261a 0%, #12402d 100%); padding: 32px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: 2px;">巧鈺好飾</h1>
              <div style="color: #a7f3d0; font-size: 11px; letter-spacing: 3px; margin-top: 4px; text-transform: uppercase;">JADE AURA JEWELRY</div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 30px 28px;">
              <div style="font-size: 16px; font-weight: 600; color: #064e3b; margin-bottom: 12px;">
                親愛的 ${receiverName} 您好：
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin-top: 0; margin-bottom: 20px;">
                您在巧鈺好飾訂購的珍藏飾品，包裹物流進度已於剛才更新，最新動態如下：
              </p>

              <!-- Status Card -->
              <div style="background-color: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                <div style="font-size: 12px; font-weight: 600; color: #047857; text-transform: uppercase; letter-spacing: 1px;">最新貨態狀態</div>
                <div style="font-size: 20px; font-weight: 800; color: #065f46; margin-top: 6px;">${statusDisplay}</div>
                ${
                  traceNumber
                    ? `<div style="font-size: 13px; color: #047857; margin-top: 8px;">
                         物流單號 / 寄件代碼：<span style="font-family: monospace; font-weight: 700; background: #ffffff; padding: 2px 8px; border-radius: 4px; border: 1px solid #a7f3d0;">${traceNumber}</span>
                       </div>`
                    : ""
                }
              </div>

              <!-- Shipping Destination Info -->
              <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; font-size: 13px; color: #4b5563;">
                <div>訂單編號：<strong style="font-family: monospace; color: #111827;">${order.orderNumber}</strong></div>
                <div style="margin-top: 4px;">運送方式：<strong>${shippingMethodName}</strong></div>
                <div style="margin-top: 4px;">
                  ${
                    isCvs
                      ? `指定門市：<strong>${order.shippingInfo?.storeName || "超商指定門市"}</strong> (${order.shippingInfo?.storeAddress || ""})`
                      : `收件地址：<strong>${order.shippingInfo?.address || order.customerInfo?.shippingAddress || ""}</strong>`
                  }
                </div>
              </div>

              ${reminderHtml}

              <!-- Action Button -->
              <div style="text-align: center; margin-top: 28px; margin-bottom: 12px;">
                <a href="${frontendUrl}/orders/track" target="_blank" style="display: inline-block; background-color: #065f46; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 13px 32px; border-radius: 9999px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(6, 95, 70, 0.2);">
                  前台包裹動態即時查詢
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 24px 28px; text-align: center; font-size: 12px; color: #9ca3af;">
              <div style="margin-bottom: 6px;">巧鈺好飾 翡翠珠寶旗艦館 · 客服專線：(02) 2788-9999</div>
              <div>此信件為系統自動推播，如已取貨或簽收請忽略此信。祝您配戴平安喜樂！</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    const res = await sendViaResend({
      to: recipientEmail,
      subject: subject,
      html: html,
    });

    console.log(`[Email Service] 貨態變更通知信已成功發送至 ${recipientEmail} (訂單: ${order.orderNumber})`);
    return { success: true, data: res };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Email Service] 發送貨態變更通知信失敗 (訂單: ${order.orderNumber}):`, error);
    // 安全攔截，絕不拋出 Error
    return { success: false, error: errorMsg };
  }
}
