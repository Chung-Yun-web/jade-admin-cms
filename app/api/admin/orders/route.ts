import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";
import { Order, OrderStatsData } from "@/types/order";

export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const tab = (searchParams.get("tab") || "UNSHIPPED").toUpperCase();
    const searchQuery = (searchParams.get("search") || "").trim();

    const client = await clientPromise;
    const db = client.db();

    // 基礎條件：已完成付款訂單
    const paidCondition = {
      $or: [
        { "paymentInfo.status": "PAID" },
        { paymentStatus: "paid" },
        { paymentStatus: "PAID" },
      ],
    };

    // 取得所有已付款訂單以計算統計指標
    const allPaidDocs = await db.collection("orders")
      .find(paidCondition)
      .sort({ createdAt: -1 })
      .toArray();

    const normalizeOrder = (rawDoc: any): Order => {
      const receiverName = rawDoc.shippingInfo?.receiverName || rawDoc.customerInfo?.name || "收件人";
      const receiverPhone = rawDoc.shippingInfo?.receiverPhone || rawDoc.customerInfo?.phone || "";
      const address = rawDoc.shippingInfo?.address || rawDoc.customerInfo?.shippingAddress || "";
      const isCVS = Boolean(rawDoc.shippingInfo?.method === "CVS_STORE" || rawDoc.shippingInfo?.storeId);

      const normalizedShippingInfo = {
        method: rawDoc.shippingInfo?.method || (isCVS ? "CVS_STORE" : "INSURED_HOME"),
        methodName: rawDoc.shippingInfo?.methodName || (isCVS ? "超商純取貨" : "尊榮保值宅配"),
        receiverName: receiverName,
        receiverPhone: receiverPhone,
        address: address,
        storeId: rawDoc.shippingInfo?.storeId || "",
        storeName: rawDoc.shippingInfo?.storeName || "",
        storeAddress: rawDoc.shippingInfo?.storeAddress || "",
      };

      const shippingFee = rawDoc.amountInfo?.shippingFee ?? (normalizedShippingInfo.method === "CVS_STORE" ? 60 : 100);
      const grandTotal = rawDoc.amountInfo?.grandTotal || rawDoc.totalAmount || 0;
      const subtotal = rawDoc.amountInfo?.subtotal || Math.max(0, grandTotal - shippingFee);

      const normalizedAmountInfo = {
        subtotal: subtotal,
        shippingFee: shippingFee,
        grandTotal: grandTotal,
      };

      const shippingStatus = rawDoc.shippingStatus === "SHIPPED" ? "SHIPPED" : "UNSHIPPED";

      return {
        _id: rawDoc._id ? rawDoc._id.toString() : new ObjectId().toString(),
        orderNumber: rawDoc.orderNumber || "JADE-UNKNOWN",
        userId: rawDoc.userId ? String(rawDoc.userId) : null,
        totalAmount: grandTotal,
        paymentStatus: rawDoc.paymentStatus || "paid",
        customerInfo: {
          name: rawDoc.customerInfo?.name || receiverName,
          email: rawDoc.customerInfo?.email || "",
          phone: rawDoc.customerInfo?.phone || receiverPhone,
          shippingAddress: rawDoc.customerInfo?.shippingAddress || address,
        },
        items: Array.isArray(rawDoc.items)
          ? rawDoc.items.map((item: any) => ({
              productId: item.productId || "",
              name: item.name || item.title || "天然翡翠珠寶商品",
              price: item.price || 0,
              quantity: item.quantity || item.qty || 1,
              spec: item.spec || "",
              image: item.image || "",
            }))
          : [],
        isGuest: Boolean(rawDoc.isGuest),
        amountInfo: normalizedAmountInfo,
        shippingInfo: normalizedShippingInfo,
        paymentInfo: {
          provider: rawDoc.paymentInfo?.provider || "ECPAY",
          status: rawDoc.paymentInfo?.status || "PAID",
          tradeNo: rawDoc.paymentInfo?.tradeNo || rawDoc.paymentIntentId || "",
        },
        shippingStatus: shippingStatus,
        trace: rawDoc.trace || "",
        shippedAt: rawDoc.shippedAt ? new Date(rawDoc.shippedAt).toISOString() : null,
        createdAt: rawDoc.createdAt ? new Date(rawDoc.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: rawDoc.updatedAt ? new Date(rawDoc.updatedAt).toISOString() : undefined,
      };
    };

    const allOrders = allPaidDocs.map(normalizeOrder);

    // 計算儀表統計數據
    const unshippedOrders = allOrders.filter((o) => o.shippingStatus !== "SHIPPED");
    const shippedOrders = allOrders.filter((o) => o.shippingStatus === "SHIPPED");

    const insuredHomeCount = unshippedOrders.filter(
      (o) => o.shippingInfo?.method === "INSURED_HOME" || (!o.shippingInfo?.storeId && o.shippingInfo?.method !== "CVS_STORE")
    ).length;

    const cvsCount = unshippedOrders.filter(
      (o) => o.shippingInfo?.method === "CVS_STORE" || Boolean(o.shippingInfo?.storeId)
    ).length;

    const totalInsuredValue = unshippedOrders.reduce((sum, o) => {
      return sum + (o.amountInfo?.grandTotal || o.totalAmount || 0);
    }, 0);

    const stats: OrderStatsData = {
      unshippedCount: unshippedOrders.length,
      unshippedTotal: totalInsuredValue,
      insuredHomeCount: insuredHomeCount,
      cvsCount: cvsCount,
      shippedCount: shippedOrders.length,
    };

    // 根據當前 Tab 與搜尋字串過濾訂單
    let filteredOrders = allOrders;
    if (tab === "UNSHIPPED") {
      filteredOrders = unshippedOrders;
    } else if (tab === "SHIPPED") {
      filteredOrders = shippedOrders;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filteredOrders = filteredOrders.filter((o) => {
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerInfo.name.toLowerCase().includes(q) ||
          o.customerInfo.phone.toLowerCase().includes(q) ||
          (o.shippingInfo?.receiverName && o.shippingInfo.receiverName.toLowerCase().includes(q)) ||
          (o.shippingInfo?.receiverPhone && o.shippingInfo.receiverPhone.toLowerCase().includes(q)) ||
          (o.shippingInfo?.storeName && o.shippingInfo.storeName.toLowerCase().includes(q)) ||
          (o.shippingInfo?.storeId && o.shippingInfo.storeId.toLowerCase().includes(q)) ||
          (o.shippingInfo?.address && o.shippingInfo.address.toLowerCase().includes(q)) ||
          (o.trace && o.trace.toLowerCase().includes(q))
        );
      });
    }

    return NextResponse.json({
      success: true,
      orders: filteredOrders,
      stats: stats,
    });
  } catch (error: any) {
    console.error("GET orders error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { orderNumber, shippingStatus, trace } = body;

    if (!orderNumber) {
      return NextResponse.json({ success: false, message: "缺少訂單編號 (orderNumber)" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const updateFields: any = {
      updatedAt: new Date(),
    };

    // 1. 更新出貨狀態
    if (shippingStatus !== undefined) {
      if (!["SHIPPED", "UNSHIPPED"].includes(shippingStatus)) {
        return NextResponse.json({ success: false, message: "無效的出貨狀態" }, { status: 400 });
      }
      updateFields.shippingStatus = shippingStatus;
      if (shippingStatus === "SHIPPED") {
        updateFields.shippedAt = new Date();
      } else {
        updateFields.shippedAt = null;
      }
    }

    // 2. 更新物流追蹤單號
    if (trace !== undefined) {
      updateFields.trace = String(trace).trim();
    }

    const result = await db.collection("orders").updateOne(
      { orderNumber: orderNumber },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: "查無此訂單" }, { status: 404 });
    }

    // 3. 出貨庫存連動：當訂單完成出貨 (SHIPPED)，自動將對應商品規格/單品狀態更新為 'sold'
    if (shippingStatus === "SHIPPED") {
      try {
        const order = await db.collection("orders").findOne({ orderNumber });
        if (order && Array.isArray(order.items)) {
          for (const item of order.items) {
            const pId = item.productId;
            const pName = item.name;
            const specName = item.spec;

            const filter: any = {};
            if (pId) {
              if (ObjectId.isValid(pId)) {
                filter.$or = [{ _id: new ObjectId(pId) }, { originalId: pId }];
              } else {
                filter.originalId = pId;
              }
            } else if (pName) {
              filter.name = pName;
            }

            if (Object.keys(filter).length > 0) {
              const productDoc = await db.collection("products").findOne(filter);
              if (productDoc && Array.isArray(productDoc.variants) && productDoc.variants.length > 0) {
                let variantIndex = -1;
                if (specName) {
                  variantIndex = productDoc.variants.findIndex((v: any) => v.name === specName);
                }
                if (variantIndex === -1) {
                  variantIndex = 0;
                }

                const updateKey = `variants.${variantIndex}.status`;
                await db.collection("products").updateOne(
                  { _id: productDoc._id },
                  {
                    $set: {
                      [updateKey]: "sold",
                      updatedAt: new Date(),
                    },
                  }
                );
                console.log(`[MongoDB] Linked shipment: Product ${productDoc.name} variant [${variantIndex}] marked as sold`);
              }
            }
          }
        }
      } catch (linkErr) {
        console.warn("[MongoDB] Warning: Failed to link order items to product sold status:", linkErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "訂單資料更新成功",
    });
  } catch (error: any) {
    console.error("PATCH orders error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
