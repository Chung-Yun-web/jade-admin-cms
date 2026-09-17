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
    const { orders } = body; // Array of { id: string, sort_order: number }

    if (!Array.isArray(orders)) {
      return NextResponse.json({ success: false, message: "無效的參數，應為 { orders: [{ id, sort_order }] }" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const bulkOps = orders.map((item: { id: string; sort_order: number }) => ({
      updateOne: {
        filter: { _id: new ObjectId(item.id) },
        update: { $set: { sort_order: Number(item.sort_order), updatedAt: new Date() } }
      }
    }));

    if (bulkOps.length > 0) {
      await db.collection("products").bulkWrite(bulkOps);
    }

    return NextResponse.json({ success: true, message: "款式排序更新成功" });
  } catch (error: any) {
    console.error("POST reorder error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
