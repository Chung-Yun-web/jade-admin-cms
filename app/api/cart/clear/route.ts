import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";

async function clearCartLogic(userId: string | undefined | null) {
  if (!userId) {
    return { success: false, message: "缺少必要參數 userId", status: 400 };
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

  const updateResult = await db.collection("users").updateOne(
    query,
    {
      $set: { cart: [] },
    },
    { upsert: false }
  );

  if (updateResult.matchedCount === 0) {
    return { success: false, message: "找不到該會員，無法清空購物車", status: 404 };
  }

  return { success: true, message: "已清空該會員在 MongoDB 的購物車資料", status: 200 };
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");

    if (!userId) {
      const session = await auth();
      userId = (session?.user as any)?.id || null;
    }

    const result = await clearCartLogic(userId);
    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.status }
    );
  } catch (error: any) {
    console.error("Clear cart DELETE API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    let userId = null;
    
    // Try to get from body first
    try {
      const body = await req.json();
      userId = body?.userId;
    } catch {
      // Body might be empty or invalid JSON, ignore
    }

    // Try query param
    if (!userId) {
      const { searchParams } = new URL(req.url);
      userId = searchParams.get("userId");
    }

    // Try session
    if (!userId) {
      const session = await auth();
      userId = (session?.user as any)?.id || null;
    }

    const result = await clearCartLogic(userId);
    return NextResponse.json(
      { success: result.success, message: result.message },
      { status: result.status }
    );
  } catch (error: any) {
    console.error("Clear cart POST API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
