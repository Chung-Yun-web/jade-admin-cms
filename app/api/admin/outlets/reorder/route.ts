import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { orders } = body; // Array of { id: string, sortOrder: number }

    if (!Array.isArray(orders)) {
      return NextResponse.json(
        { success: false, message: "無效的參數，應為 { orders: [{ id, sortOrder }] }" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const bulkOps = orders.map((item: { id: string; sortOrder: number }) => ({
      updateOne: {
        filter: { _id: new ObjectId(item.id) },
        update: {
          $set: {
            sortOrder: Number(item.sortOrder) || 0,
            updatedAt: new Date(),
          },
        },
      },
    }));

    if (bulkOps.length > 0) {
      await db.collection("outlets").bulkWrite(bulkOps);
    }

    return NextResponse.json({ success: true, message: "Outlet 商品排序更新成功" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("POST outlet reorder error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
