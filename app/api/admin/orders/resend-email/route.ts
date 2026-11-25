import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";
import { sendShippingStatusEmail } from "@/lib/email";
import { Order } from "@/types/order";

export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const orderNumber = typeof body?.orderNumber === "string" ? body.orderNumber.trim() : "";

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, message: "缺少訂單編號 (orderNumber)" },
        { status: 400 }
      );
    }

    const client = await clientPromise;
    const db = client.db();

    const orderDoc = await db.collection("orders").findOne({ orderNumber });
    if (!orderDoc) {
      return NextResponse.json(
        { success: false, message: "查無此訂單" },
        { status: 404 }
      );
    }

    const recipientEmail = orderDoc.customerInfo?.email?.trim() || "";

    let emailResult;
    try {
      emailResult = await sendShippingStatusEmail(orderDoc as unknown as Order);
    } catch (emailErr: unknown) {
      const errorMsg = emailErr instanceof Error ? emailErr.message : String(emailErr);
      console.error(`[POST resend-email] 重寄貨態通知信發生例外 (訂單: ${orderNumber}):`, emailErr);
      return NextResponse.json(
        { success: false, message: `重寄貨態通知信失敗：${errorMsg}` },
        { status: 500 }
      );
    }

    if (emailResult.skipped) {
      const skipMessage =
        emailResult.reason === "NO_EMAIL"
          ? `訂單 ${orderNumber} 未填寫有效顧客 Email（訪客結帳），已安全略過發信。`
          : emailResult.reason === "NO_GMAIL_APP_PASSWORD"
          ? `系統尚未設定 GMAIL_APP_PASSWORD，已安全略過發信（訂單：${orderNumber}）。`
          : `訂單 ${orderNumber} 已安全略過發信（${emailResult.reason || "SKIPPED"}）。`;

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: emailResult.reason,
        message: skipMessage,
        emailResult,
      });
    }

    if (!emailResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: `重寄貨態通知信失敗：${emailResult.error || "未知錯誤"}`,
          emailResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      skipped: false,
      message: `貨態通知信已重新發送至 ${recipientEmail}`,
      emailResult,
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("POST /api/admin/orders/resend-email error:", error);
    return NextResponse.json({ success: false, message: errorMsg }, { status: 500 });
  }
}
