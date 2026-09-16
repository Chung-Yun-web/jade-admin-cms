import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export async function PATCH(req: NextRequest) {
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

    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "缺少必要參數 userId" },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db();

    let query: any = {};
    try {
      query._id = new ObjectId(userId);
    } catch {
      query.id = userId;
    }

    const user = await db.collection("users").findOne(query);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到該會員" },
        { status: 404 }
      );
    }

    const dbCart = user.cart || [];

    // Promote logic: Change all items with source === "session" to "db"
    let hasChanges = false;
    const updatedCart = dbCart.map((item: any) => {
      if (item.source === "session") {
        hasChanges = true;
        return {
          ...item,
          source: "db",
        };
      }
      return item;
    });

    if (hasChanges) {
      await db.collection("users").updateOne(
        query,
        {
          $set: { cart: updatedCart },
        },
        { upsert: false }
      );
    }

    return NextResponse.json({
      success: true,
      message: "一鍵升級購物車品項成功",
      cart: updatedCart,
    });
  } catch (error: any) {
    console.error("Promote cart API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
