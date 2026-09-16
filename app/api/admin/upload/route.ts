import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@/auth";

// 初始化 Cloudflare R2 Client (S3 相容 API)
const s3Client = new S3Client({
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
  region: "auto",
});

export async function POST(req: NextRequest) {
  try {
    // 1. 管理員權限檢查
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    // 2. 檢查 R2 環境變數配置
    if (
      !process.env.R2_ACCOUNT_ID ||
      !process.env.R2_ACCESS_KEY_ID ||
      !process.env.R2_SECRET_ACCESS_KEY ||
      !process.env.R2_BUCKET_NAME ||
      !process.env.NEXT_PUBLIC_R2_PUBLIC_URL
    ) {
      return NextResponse.json(
        { success: false, message: "R2 雲端儲存未正確配置環境變數" },
        { status: 500 }
      );
    }

    // 3. 解析前端上傳的 FormData
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const productId = formData.get("productId") as string | null;
    const variantId = formData.get("variantId") as string | null;

    if (!file) {
      return NextResponse.json({ success: false, message: "未提供上傳檔案" }, { status: 400 });
    }
    if (!productId) {
      return NextResponse.json({ success: false, message: "未提供產品 ID (productId)" }, { status: 400 });
    }
    if (!variantId) {
      return NextResponse.json({ success: false, message: "未提供款式 ID (variantId)" }, { status: 400 });
    }

    // 4. 讀取檔案內容為 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 5. 淨化與解碼路徑參數，確保 Key 為 100% 乾淨的 ASCII
    const decodeAndSanitize = (str: string, fallback: string): string => {
      try {
        const decoded = decodeURIComponent(str);
        // 只保留英數字、中線、底線，其餘過濾
        const clean = decoded.replace(/[^a-zA-Z0-9-_]/g, "").trim();
        return clean || fallback;
      } catch {
        const clean = str.replace(/[^a-zA-Z0-9-_]/g, "").trim();
        return clean || fallback;
      }
    };

    const cleanProductId = decodeAndSanitize(productId, "product");
    const cleanVariantId = decodeAndSanitize(variantId, "variant");

    // 淨化檔名：忽視中文原始檔名，僅使用時間戳記 + 隨機數 + 淨化後的副檔名
    const originalName = file.name || "unnamed_file";
    const ext = originalName.includes(".") ? originalName.split(".").pop() || "jpg" : "jpg";
    const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "jpg";
    
    const timestamp = Date.now();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000); // 4位隨機數
    const filename = `${timestamp}-${randomSuffix}.${cleanExt}`;

    // 拼接成純 ASCII 的 R2 Key
    const key = cleanProductId === "crafts"
      ? `crafts/${cleanVariantId}/${filename}`
      : `products/${cleanProductId}/${cleanVariantId}/${filename}`;

    // 6. 執行 S3 / R2 上傳指令
    const uploadCommand = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || "application/octet-stream",
    });

    await s3Client.send(uploadCommand);

    // 7. 組成完整 CDN 公開網址並回傳
    const publicUrl = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;
    const baseUrl = publicUrl.endsWith("/") ? publicUrl.slice(0, -1) : publicUrl;
    const fullCdnUrl = `${baseUrl}/${key}`;

    return NextResponse.json({
      success: true,
      message: "檔案上傳成功",
      url: fullCdnUrl,
      key: key
    });
  } catch (error: any) {
    console.error("Upload API error:", error);
    return NextResponse.json(
      { success: false, message: error.message || "伺服器上傳處理失敗" },
      { status: 500 }
    );
  }
}
