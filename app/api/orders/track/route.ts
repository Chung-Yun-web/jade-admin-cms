import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "無效的 JSON 格式" }, { status: 400 });
    }

    const { orderNumber } = body;

    if (!orderNumber || typeof orderNumber !== "string" || !orderNumber.trim()) {
      return NextResponse.json({ error: "請提供有效的訂單編號" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Query the order
    const order = await db.collection("orders").findOne({
      orderNumber: orderNumber.trim(),
    });

    if (!order) {
      return NextResponse.json({ error: "系統查無紀錄" }, { status: 404 });
    }

    // Map items list to keep only name and quantity (summarized)
    let safeItems: Array<{ name: string; quantity: number }> = [];
    if (order.items && Array.isArray(order.items)) {
      safeItems = order.items.map((item: any) => ({
        name: item.name || item.title || "精品手工飾品",
        quantity: item.quantity || item.qty || 1,
      }));
    }

    // Determine safe shipment/payment status
    // Use order.status if it exists, otherwise fall back to paymentStatus based status mappings
    let currentStatus = order.status;
    if (!currentStatus) {
      if (order.paymentStatus === "paid") {
        currentStatus = "已付款，商品製作中";
      } else if (order.paymentStatus === "pending") {
        currentStatus = "訂單成立，待付款";
      } else {
        currentStatus = "訂單處理中";
      }
    }

    // Format safe response structure
    const safeResponse = {
      orderNumber: order.orderNumber,
      status: currentStatus,
      updatedAt: order.updatedAt || order.createdAt || new Date(),
      items: safeItems,
    };

    return NextResponse.json(safeResponse);
  } catch (error) {
    console.error("Order tracking lookup error:", error);
    return NextResponse.json({ error: "內部伺服器錯誤" }, { status: 500 });
  }
}
