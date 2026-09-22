import QRCode from 'qrcode';
import { Order, SenderInfo } from '@/types/order';

export const DEFAULT_SENDER: SenderInfo = {
  name: process.env.SENDER_NAME || '巧鈺好飾 翡翠珠寶旗艦館',
  phone: process.env.SENDER_PHONE || '02-2788-9999',
  address: process.env.SENDER_ADDRESS || '台北市信義區松仁路100號微風南山翡翠展售中心',
  postcode: process.env.SENDER_POSTCODE || '110',
};

export async function generateCvsLabelHtml(order: Order, sender: SenderInfo = DEFAULT_SENDER): Promise<string> {
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(`CVS:${order.orderNumber}`, {
      margin: 1,
      width: 100,
      color: {
        dark: '#1e293b',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code for CVS:', err);
  }

  const receiverName = order.shippingInfo?.receiverName || order.customerInfo?.name || '收件人';
  const rawPhone = order.shippingInfo?.receiverPhone || order.customerInfo?.phone || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const last3Digits = cleanPhone.length >= 3 ? cleanPhone.slice(-3) : '---';
  const maskedPhone = cleanPhone.length === 10
    ? `${cleanPhone.slice(0, 4)}-XXX-${cleanPhone.slice(7)}`
    : rawPhone;

  const storeId = order.shippingInfo?.storeId || '999999';
  const storeName = (order.shippingInfo?.storeName || '超商指定門市').trim();
  const storeAddress = (order.shippingInfo?.storeAddress || '（請參閱門市系統資料）').trim();
  const printTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

  const itemsSummary = (order.items || []).map(i => `${i.name} x${i.quantity || 1}`).join('、');

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>巧鈺好飾 - 超商取貨貼紙標籤 - ${order.orderNumber}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei", "PingFang TC", sans-serif;
    }
    body {
      width: 100mm;
      min-height: 150mm;
      padding: 3.5mm;
      background: #ffffff;
      color: #0f172a;
      font-size: 10px;
      line-height: 1.3;
    }
    .label-container {
      border: 2px solid #000000;
      border-radius: 4px;
      padding: 2.5mm;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000000;
      padding-bottom: 1.5mm;
      margin-bottom: 2mm;
    }
    .cvs-title {
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 0.5px;
    }
    .cvs-type {
      background: #000000;
      color: #ffffff;
      padding: 2px 6px;
      font-weight: 900;
      font-size: 11px;
      border-radius: 2px;
    }
    .store-hero {
      border: 2px solid #000000;
      background: #f8fafc;
      padding: 3mm 2mm;
      border-radius: 3px;
      text-align: center;
      margin-bottom: 2mm;
    }
    .store-label {
      font-size: 9px;
      font-weight: bold;
      color: #475569;
      text-transform: uppercase;
    }
    .store-id-large {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #000000;
      line-height: 1.1;
      margin: 1px 0;
    }
    .store-name-large {
      font-size: 16px;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 2px;
    }
    .store-address {
      font-size: 9.5px;
      color: #475569;
      word-break: break-all;
    }
    .customer-hero {
      border: 2px dashed #000000;
      padding: 2.5mm;
      margin-bottom: 2mm;
      background: #ffffff;
    }
    .customer-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      align-items: center;
    }
    .receiver-name {
      font-size: 20px;
      font-weight: 900;
      color: #000000;
    }
    .phone-last3 {
      text-align: right;
      border-left: 2px solid #cbd5e1;
      padding-left: 2mm;
    }
    .phone-last3-num {
      font-size: 22px;
      font-weight: 900;
      color: #dc2626;
      line-height: 1;
    }
    .alert-banner {
      background: #000000;
      color: #ffffff;
      text-align: center;
      font-weight: 900;
      font-size: 11px;
      padding: 3px 2px;
      letter-spacing: 0.5px;
      margin-bottom: 2mm;
      border-radius: 2px;
    }
    .barcode-area {
      text-align: center;
      border: 1px solid #e2e8f0;
      padding: 2mm 1mm;
      margin-bottom: 2mm;
      background: #ffffff;
    }
    .footer-info {
      font-size: 8.5px;
      color: #64748b;
      border-top: 1px solid #cbd5e1;
      padding-top: 1.5mm;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
  </style>
</head>
<body>
  <div class="label-container">
    <!-- Header -->
    <div class="header-row">
      <div>
        <div class="cvs-title">超商取貨專用出貨標籤</div>
        <div style="font-size: 8.5px; color: #64748b; font-weight: bold;">巧鈺好飾 OFFICIAL LOGISTICS</div>
      </div>
      <div class="cvs-type">
        純取貨 (已付款)
      </div>
    </div>

    <!-- Store Hero -->
    <div class="store-hero">
      <div class="store-label">【取件超商門市與店號】</div>
      <div class="store-id-large">${storeId}</div>
      <div class="store-name-large">${storeName}</div>
      <div class="store-address">📍 ${storeAddress}</div>
      <div style="margin-top: 2px;">
        <svg id="store-barcode" style="width: 50mm; height: 9mm;"></svg>
      </div>
    </div>

    <!-- Warning Banner -->
    <div class="alert-banner">
      ★ 本件已完成全額付款，取件時須核對身分證件正本 ★
    </div>

    <!-- Customer Card -->
    <div class="customer-hero">
      <div class="customer-grid">
        <div>
          <div style="font-size: 8.5px; color: #64748b; font-weight: bold;">【取件人姓名】</div>
          <div class="receiver-name">${receiverName}</div>
          <div style="font-size: 10px; font-weight: 700; color: #334155; margin-top: 2px;">
            ${maskedPhone}
          </div>
        </div>
        <div class="phone-last3">
          <div style="font-size: 8.5px; color: #64748b; font-weight: bold;">【手機末三碼】</div>
          <div class="phone-last3-num">${last3Digits}</div>
          <div style="font-size: 8px; color: #dc2626; font-weight: bold;">(門市快速查找)</div>
        </div>
      </div>
    </div>

    <!-- Order Barcode Section -->
    <div class="barcode-area">
      <div style="display: flex; justify-content: space-around; align-items: center;">
        <div>
          <svg id="order-barcode" style="width: 60mm; height: 11mm;"></svg>
          <div style="font-size: 9px; font-weight: 800; letter-spacing: 0.5px;">
            訂單編號：${order.orderNumber}
          </div>
        </div>
        <div>
          ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 32px; height: 32px;" alt="QR" />` : ''}
        </div>
      </div>
    </div>

    <!-- Items Preview -->
    <div style="font-size: 8.5px; color: #475569; background: #f1f5f9; padding: 2px 4px; border-radius: 2px; margin-bottom: 1.5mm;">
      <span style="font-weight: bold; color: #1e293b;">品項：</span>${itemsSummary || '巧鈺好飾 精選珠寶首飾'}
    </div>

    <!-- Footer -->
    <div class="footer-info">
      <div>
        <div>寄件商：${sender.name} (${sender.phone})</div>
        <div>列印時間：${printTime}</div>
      </div>
      <div style="font-weight: 900; font-size: 9px; color: #000000;">
        【0元包裹】
      </div>
    </div>
  </div>

  <script>
    try {
      JsBarcode("#order-barcode", "${order.orderNumber}", {
        format: "CODE128",
        lineColor: "#000000",
        width: 1.6,
        height: 38,
        displayValue: false,
        margin: 0
      });

      if ("${storeId}" && "${storeId}" !== "999999") {
        JsBarcode("#store-barcode", "${storeId}", {
          format: "CODE128",
          lineColor: "#000000",
          width: 1.4,
          height: 28,
          displayValue: false,
          margin: 0
        });
      }
    } catch(e) {
      console.error("Barcode generation error:", e);
    }
  </script>
</body>
</html>
  `;
}

export async function generateInsuredDeliveryHtml(order: Order, sender: SenderInfo = DEFAULT_SENDER): Promise<string> {
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(order.orderNumber, {
      margin: 1,
      width: 100,
      color: {
        dark: '#0B251A',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code for Insured Delivery:', err);
  }

  const grandTotalStr = (order.amountInfo?.grandTotal || order.totalAmount || 0).toLocaleString();
  const receiverName = order.shippingInfo?.receiverName || order.customerInfo?.name || '貴賓顧客';
  const receiverPhone = order.shippingInfo?.receiverPhone || order.customerInfo?.phone || '';
  const receiverAddress = order.shippingInfo?.address || order.customerInfo?.shippingAddress || '（未提供地址）';
  const printTime = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });

  const itemsHtml = (order.items || []).map((item, idx) => `
    <tr class="border-b border-gray-200 text-xs">
      <td class="py-1 px-1 text-center">${idx + 1}</td>
      <td class="py-1 px-1 font-medium">${item.name || '精品翡翠'} ${item.spec ? `<span class="text-gray-500">(${item.spec})</span>` : ''}</td>
      <td class="py-1 px-1 text-center font-bold">${item.quantity || 1}</td>
      <td class="py-1 px-1 text-right">NT$ ${(item.price || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <title>巧鈺好飾 - 尊榮保價宅配單 - ${order.orderNumber}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
  <style>
    @page {
      size: 100mm 150mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Microsoft JhengHei", "PingFang TC", sans-serif;
    }
    body {
      width: 100mm;
      min-height: 150mm;
      padding: 4mm;
      background: #ffffff;
      color: #1a202c;
      font-size: 10.5px;
      line-height: 1.35;
    }
    .sheet-border {
      border: 1.5px solid #0B251A;
      border-radius: 4px;
      padding: 3mm;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0B251A;
      padding-bottom: 2mm;
      margin-bottom: 2mm;
    }
    .brand-title {
      font-size: 16px;
      font-weight: 900;
      color: #0B251A;
      letter-spacing: 0.5px;
    }
    .badge {
      background: #0B251A;
      color: #C5A880;
      font-weight: bold;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-block;
      margin-top: 2px;
    }
    .val-banner {
      background: #fff8e6;
      border: 1px dashed #d97706;
      padding: 4px 6px;
      border-radius: 4px;
      margin-bottom: 2mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .val-title {
      font-size: 10px;
      color: #92400e;
      font-weight: bold;
    }
    .val-amount {
      font-size: 15px;
      font-weight: 900;
      color: #b45309;
    }
    .barcode-section {
      text-align: center;
      margin: 1mm 0 2mm;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2mm;
      margin-bottom: 2mm;
    }
    .info-box {
      border: 1px solid #cbd5e1;
      padding: 4px;
      border-radius: 3px;
      background: #f8fafc;
    }
    .info-box.highlight {
      border: 1.5px solid #0B251A;
      background: #ffffff;
    }
    .info-label {
      font-size: 9px;
      font-weight: bold;
      color: #64748b;
      margin-bottom: 2px;
      text-transform: uppercase;
    }
    .info-name {
      font-size: 12px;
      font-weight: 800;
      color: #0f172a;
    }
    .info-phone {
      font-size: 11px;
      font-weight: 700;
      color: #1e293b;
      margin: 1px 0;
    }
    .info-address {
      font-size: 10px;
      color: #334155;
      word-break: break-all;
    }
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 2mm;
    }
    .items-table th {
      background: #f1f5f9;
      font-size: 9px;
      font-weight: 700;
      color: #475569;
      padding: 2px 4px;
      border-bottom: 1px solid #cbd5e1;
      text-align: left;
    }
    .warning-box {
      font-size: 8.5px;
      color: #b91c1c;
      background: #fef2f2;
      border: 1px solid #fecaca;
      padding: 3px 5px;
      border-radius: 3px;
      margin-bottom: 2mm;
      font-weight: 600;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px dashed #94a3b8;
      padding-top: 2mm;
      margin-top: auto;
    }
    .sign-box {
      border: 1px solid #94a3b8;
      height: 14mm;
      width: 28mm;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      color: #94a3b8;
      background: #fafafa;
    }
  </style>
</head>
<body>
  <div class="sheet-border">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="brand-title">巧鈺好飾 翡翠珠寶</div>
        <div class="badge">★ 尊榮保價宅配託運單 ★</div>
      </div>
      <div style="text-align: right;">
        ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" style="width: 32px; height: 32px;" alt="QR" />` : ''}
      </div>
    </div>

    <!-- Declared Value Banner -->
    <div class="val-banner">
      <div>
        <div class="val-title">★ 珠寶全額保值專案託運 ★</div>
        <div style="font-size: 8.5px; color: #78350f;">已完成全額付款（運送遺失照價理賠）</div>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 8.5px; color: #78350f;">保值申報總額</div>
        <div class="val-amount">NT$ ${grandTotalStr}</div>
      </div>
    </div>

    <!-- Barcode -->
    <div class="barcode-section">
      <svg id="barcode" style="width: 82mm; height: 13mm;"></svg>
      <div style="font-size: 9px; font-weight: bold; color: #334155; letter-spacing: 1px;">
        託運單號：${order.orderNumber}
      </div>
    </div>

    <!-- Sender and Receiver Grid -->
    <div class="info-grid">
      <!-- Recipient -->
      <div class="info-box highlight" style="grid-column: span 2;">
        <div class="info-label">【收件人資訊 / RECIPIENT】</div>
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <span class="info-name">${receiverName} 貴賓</span>
          <span class="info-phone">☎ ${receiverPhone}</span>
        </div>
        <div class="info-address" style="margin-top: 2px;">
          📍 <strong>${receiverAddress}</strong>
        </div>
      </div>

      <!-- Sender -->
      <div class="info-box" style="grid-column: span 2;">
        <div class="info-label">【寄件人資訊 / SENDER】</div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-weight: bold; color: #1e293b;">${sender.name}</span>
          <span>☎ ${sender.phone}</span>
        </div>
        <div style="font-size: 9px; color: #64748b;">${sender.address}</div>
      </div>
    </div>

    <!-- Goods Items -->
    <div style="margin-bottom: 2mm;">
      <div style="font-size: 9px; font-weight: bold; color: #334155; margin-bottom: 2px;">【託運內容物明細】</div>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 6mm; text-align: center;">#</th>
            <th>品名 / 規格</th>
            <th style="width: 10mm; text-align: center;">數量</th>
            <th style="width: 18mm; text-align: right;">申報單價</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml || '<tr><td colspan="4" style="text-align:center; padding: 4px;">天然翡翠飾品 1 件</td></tr>'}
        </tbody>
      </table>
    </div>

    <!-- Security Warning -->
    <div class="warning-box">
      ⚠️ <strong>配送特別警語：</strong>高單價天然玉石飾品，包裝內外已全程錄影並貼附防偽易碎封條。請物流司機親交本人簽收，開箱時敬請收件人全程錄影。
    </div>

    <!-- Footer Signatures -->
    <div class="footer">
      <div style="font-size: 8px; color: #64748b;">
        <div>列印時間：${printTime}</div>
        <div>防偽封條號：SEC-${order.orderNumber.slice(-6)}</div>
        <div style="margin-top: 1px; color: #0B251A; font-weight: bold;">巧鈺好飾 官方出貨防偽監控</div>
      </div>
      <div>
        <div class="sign-box">收件人親簽 / 蓋章</div>
      </div>
    </div>
  </div>

  <script>
    try {
      JsBarcode("#barcode", "${order.orderNumber}", {
        format: "CODE128",
        lineColor: "#0B251A",
        width: 1.8,
        height: 42,
        displayValue: false,
        margin: 0
      });
    } catch(e) {
      console.error("Barcode generation error:", e);
    }
  </script>
</body>
</html>
  `;
}
