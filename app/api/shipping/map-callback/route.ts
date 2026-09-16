import { NextRequest } from "next/server";

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const storeId = formData.get("CVSStoreID")?.toString() || "";
    const storeName = formData.get("CVSStoreName")?.toString() || "";
    const storeAddress = formData.get("CVSAddress")?.toString() || "";
    const subType = formData.get("LogisticsSubType")?.toString() || "";

    console.log("Received ECPay CVS selection callback:", { storeId, storeName, storeAddress, subType });

    // 透過 JSON.stringify 進行安全轉義，防止任何 XSS 或是字元中斷 Script 的問題
    const storeIdJson = JSON.stringify(storeId);
    const storeNameJson = JSON.stringify(storeName);
    const storeAddressJson = JSON.stringify(storeAddress);
    const subTypeJson = JSON.stringify(subType);

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>門市選擇完成</title>
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
              text-align: center;
            }
            .success-message {
              padding: 2rem;
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
              max-width: 400px;
            }
          </style>
        </head>
        <body>
          <div class="success-message">
            <h3 style="color: #0B251A; font-weight: 500; margin-top: 0;">門市選取成功</h3>
            <p style="font-size: 14px; color: #666; margin-bottom: 8px;">門市名稱：${storeName}</p>
            <p style="font-size: 12px; color: #999; margin-bottom: 24px;">門市地址：${storeAddress}</p>
            <p style="font-size: 13px; color: #555;">正在將門市資訊帶回，並自動關閉此視窗...</p>
          </div>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: "CVS_STORE_SELECTED",
                storeId: ${storeIdJson},
                storeName: ${storeNameJson},
                storeAddress: ${storeAddressJson},
                subType: ${subTypeJson}
              }, "*");
            } else {
              console.error("找不到父視窗 (window.opener)！無法傳回資訊。");
            }
            
            // 延遲關閉視窗，讓使用者看清結果並確保 postMessage 發送完畢
            setTimeout(function() {
              window.close();
            }, 800);
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
    console.error("ECPay Map Callback error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
