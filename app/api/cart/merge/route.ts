import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  console.log("[DEBUG 後端] >>>>>>>>>> 接收到合併購物車請求！ <<<<<<<<<<");
  try {
    // 1. 檢查當前 Session 內容
    const session = await auth();
    console.log("[DEBUG 後端] 當前 Session 內容為:", JSON.stringify(session));
    console.log("[DEBUG 後端] Session 解析出的 userId 為:", session?.user?.id);

    let body;
    try {
      body = await req.json();
    } catch {
      console.error("[DEBUG 後端] 錯誤: 無效的 JSON 格式");
      return NextResponse.json(
        { success: false, message: "無效的 JSON 格式" },
        { status: 400 }
      );
    }

    // 2. 檢查前端送過來的商品 Payload 與 userId
    const { userId: bodyUserId, localCart } = body;
    console.log("[DEBUG 後端] 請求 Body 中的 userId 為:", bodyUserId);
    console.log("[DEBUG 後端] 前端送來的商品資料 (localCart) 為:", JSON.stringify(localCart));

    // 優先使用 session.user.id，其次為 body 中的 userId
    const userId = session?.user?.id || bodyUserId;
    console.log("[DEBUG 後端] 最終選用的 userId 鑰匙為:", userId);

    if (!userId) {
      console.error("[DEBUG 後端] 錯誤: 缺少必要參數 userId 或 Session 尚未認證");
      return NextResponse.json(
        { success: false, message: "缺少必要參數 userId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(localCart)) {
      console.error("[DEBUG 後端] 錯誤: localCart 必須為陣列格式");
      return NextResponse.json(
        { success: false, message: "localCart 必須為陣列格式" },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db();

    // 3. 構造查詢語法並查詢用戶
    let query: any = {};
    try {
      query._id = new ObjectId(userId);
      console.log("[DEBUG 後端] 已成功將 userId 轉為 MongoDB ObjectId:", query._id);
    } catch (e) {
      console.log("[DEBUG 後端] userId 非 24 位元 Hex 格式，將作為 String 進行匹配:", userId);
      query.id = userId;
    }

    console.log("[DEBUG 後端] 正在對 users 集合執行查詢，Query 內容:", JSON.stringify(query));
    const user = await db.collection("users").findOne(query);

    if (!user) {
      console.error("[DEBUG 後端] 錯誤: 在 MongoDB 中找不到該會員！");
      return NextResponse.json(
        { success: false, message: "找不到該會員" },
        { status: 404 }
      );
    }

    console.log("[DEBUG 後端] 成功查獲用戶實體！用戶信箱為:", user.email, "用戶現有購物車:", JSON.stringify(user.cart));

    const dbCart = user.cart || [];

    // Map and normalize Frontend localCart
    const formattedLocal = localCart.map((item: any) => {
      const rawId = (item.productId || item.product_id || item.id || "").toString().trim();
      const dashIndex = rawId.indexOf("-");
      let cleanId = rawId;
      let spec = (item.spec || "").toString().trim();
      
      if (dashIndex !== -1) {
        cleanId = rawId.substring(0, dashIndex).trim();
        if (!spec) {
          spec = rawId.substring(dashIndex + 1).trim();
        }
      }

      return {
        product_id: cleanId,
        spec: spec || undefined,
        quantity: Number(item.quantity) || 1,
      };
    });

    console.log("[DEBUG 後端] 格式化後的本地購物車為:", JSON.stringify(formattedLocal));

    // Merge logic:
    // Create copy of existing db cart with normalized fields (without source)
    const mergedCart = dbCart.map((item: any) => ({
      product_id: item.product_id ? item.product_id.toString() : "",
      spec: item.spec || undefined,
      quantity: Number(item.quantity) || 1,
    }));

    // Merge localCart items into mergedCart
    for (const localItem of formattedLocal) {
      const targetId = localItem.product_id;
      const targetSpec = localItem.spec || "";

      // Find if there's an item in DB with SAME product_id and SAME spec
      const existingItem = mergedCart.find(
        (item: any) =>
          item.product_id === targetId &&
          (item.spec || "") === targetSpec
      );

      if (existingItem) {
        existingItem.quantity += localItem.quantity;
        console.log(`[DEBUG 後端] 商品 ${targetId} (${targetSpec}) 已存在，累加數量至:`, existingItem.quantity);
      } else {
        mergedCart.push({
          product_id: targetId,
          spec: localItem.spec,
          quantity: localItem.quantity,
        });
        console.log(`[DEBUG 後端] 商品 ${targetId} (${targetSpec}) 為新添品項，新增入列。`);
      }
    }

    // Format for writing to database (keep ObjectIds as ObjectIds, remove source/checked etc.)
    const dbCartPayload = mergedCart.map((item: any) => {
      let objectId;
      try {
        if (item.product_id && item.product_id.length === 24) {
          objectId = new ObjectId(item.product_id);
        }
      } catch {}
      return {
        product_id: objectId || item.product_id,
        spec: item.spec || undefined,
        quantity: Number(item.quantity) || 1,
      };
    });

    console.log("[DEBUG 後端] 寫入 MongoDB 的最終 Payload 為:", JSON.stringify(dbCartPayload));

    // Save back to user document
    const updateResult = await db.collection("users").updateOne(
      query,
      {
        $set: { cart: dbCartPayload },
      },
      { upsert: false }
    );

    console.log("[DEBUG 後端] MongoDB 更新執行結果Matched:", updateResult.matchedCount, "Modified:", updateResult.modifiedCount);

    return NextResponse.json({
      success: true,
      message: "合併購物車成功",
      cart: mergedCart,
    });
  } catch (error: any) {
    console.error("[DEBUG 後端] Merge cart API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
