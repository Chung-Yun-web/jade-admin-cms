import { NextRequest, NextResponse } from "next/server";
import { auth, isUserAdmin } from "@/auth";
import { generateCvsLabelHtml, generateInsuredDeliveryHtml } from "@/lib/orderPrintTemplates";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { order, labelType } = body;

    if (!order) {
      return NextResponse.json({ success: false, message: "缺少訂單資料" }, { status: 400 });
    }

    let html = "";
    if (labelType === "CVS_STORE") {
      html = await generateCvsLabelHtml(order);
    } else {
      html = await generateInsuredDeliveryHtml(order);
    }

    return NextResponse.json({ success: true, html });
  } catch (error: any) {
    console.error("Print template error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
