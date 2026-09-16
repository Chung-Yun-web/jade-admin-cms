import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的 JSON 格式" },
        { status: 400 }
      );
    }

    const { userId, cart } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數 userId" },
        { status: 400 }
      );
    }

    if (!Array.isArray(cart)) {
      return NextResponse.json(
        { success: false, message: "購物車必須為陣列格式" },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db();

    // Map cart items with clean IDs and specifications
    const dbCart = cart.map((item: any) => {
      const rawId = (item.id || item.product_id || "").toString().trim();
      const dashIndex = rawId.indexOf("-");
      let cleanId = rawId;
      let spec = (item.spec || "").toString().trim();
      
      if (dashIndex !== -1) {
        cleanId = rawId.substring(0, dashIndex).trim();
        if (!spec) {
          spec = rawId.substring(dashIndex + 1).trim();
        }
      }

      let objectId;
      try {
        if (cleanId.length === 24) {
          objectId = new ObjectId(cleanId);
        }
      } catch {
        // Fallback if not valid ObjectId format
      }

      return {
        product_id: objectId || cleanId,
        spec: spec || undefined,
        quantity: Number(item.quantity) || 1,
      };
    });

    let query: any = {};
    try {
      query._id = new ObjectId(userId);
    } catch {
      query.id = userId;
    }

    const updateResult = await db.collection("users").updateOne(
      query,
      {
        $set: { cart: dbCart },
      },
      { upsert: false }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json(
        { success: false, message: "找不到該會員，無法更新購物車" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "同步購物車到資料庫成功",
    });
  } catch (error: any) {
    console.error("Update cart API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
