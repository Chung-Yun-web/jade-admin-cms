import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export const revalidate = 0;

// GET method to list payout claims and aggregate statistics
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";
    const search = searchParams.get("search") || "";

    const client = await clientPromise;
    const db = client.db();

    // 1. 取得所有回饋提領申請紀錄用以統計數值
    const allClaims = await db
      .collection("rebate_claims")
      .find({})
      .sort({ appliedAt: -1, createdAt: -1 })
      .toArray();

    let pendingCount = 0;
    let pendingAmount = 0;
    let completedCount = 0;
    let completedAmount = 0;
    let totalCount = allClaims.length;
    let totalAmount = 0;

    allClaims.forEach((claim: any) => {
      const amount = Number(claim.totalRewardAmount) || 0;
      totalAmount += amount;
      if (claim.status === "審核中" || claim.status === "pending") {
        pendingCount += 1;
        pendingAmount += amount;
      } else if (claim.status === "已撥款" || claim.status === "approved") {
        completedCount += 1;
        completedAmount += amount;
      }
    });

    const stats = {
      pendingCount,
      pendingAmount,
      completedCount,
      completedAmount,
      totalCount,
      totalAmount,
    };

    // 2. 構建篩選條件
    const filterQuery: any = {};

    if (status !== "ALL") {
      if (status === "審核中") {
        filterQuery.status = { $in: ["審核中", "pending"] };
      } else if (status === "已撥款") {
        filterQuery.status = { $in: ["已撥款", "approved"] };
      } else {
        filterQuery.status = status;
      }
    }

    if (search.trim()) {
      const reg = new RegExp(search.trim(), "i");
      filterQuery.$or = [
        { userEmail: reg },
        { userName: reg },
        { claimId: reg },
        { orderNumbers: reg },
        { "bankInfo.accountNumber": reg },
        { "bankInfo.bankCodeName": reg },
      ];
    }

    const filteredClaims = await db
      .collection("rebate_claims")
      .find(filterQuery)
      .sort({ appliedAt: -1, createdAt: -1 })
      .toArray();

    const formattedPayouts = filteredClaims.map((item: any) => ({
      _id: item._id.toString(),
      claimId: item.claimId || `CLM-${item._id.toString().slice(-8)}`,
      userId: item.userId || "",
      userEmail: item.userEmail || "",
      userName: item.userName || "",
      orderNumbers: Array.isArray(item.orderNumbers) ? item.orderNumbers : [],
      orders: Array.isArray(item.orders) ? item.orders : [],
      totalRewardAmount: Number(item.totalRewardAmount) || 0,
      rewardRate: Number(item.rewardRate) || 15,
      bankInfo: {
        bankCodeName: item.bankInfo?.bankCodeName || "未填寫",
        accountNumber: item.bankInfo?.accountNumber || "未填寫",
      },
      status: item.status || "審核中",
      appliedAt: item.appliedAt || item.createdAt || new Date(),
      processedAt: item.processedAt || null,
      createdAt: item.createdAt || item.appliedAt || new Date(),
      updatedAt: item.updatedAt || null,
      adminNote: item.adminNote || "",
    }));

    return NextResponse.json({
      success: true,
      stats,
      payouts: formattedPayouts,
    });
  } catch (error: any) {
    console.error("GET payouts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH method to approve or reject a payout claim
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { claimId, action, note } = body;

    if (!claimId || !action) {
      return NextResponse.json({ success: false, message: "缺少必要參數 (claimId, action)" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // 查找該筆提領申請
    let query: any = { claimId };
    let claim = await db.collection("rebate_claims").findOne(query);

    if (!claim && ObjectId.isValid(claimId)) {
      claim = await db.collection("rebate_claims").findOne({ _id: new ObjectId(claimId) });
    }

    if (!claim) {
      return NextResponse.json({ success: false, message: "找不到該筆回饋撥款申請" }, { status: 404 });
    }

    const now = new Date();

    if (action === "approve") {
      // 1. 更新 rebate_claims 集合狀態為「已撥款」
      await db.collection("rebate_claims").updateOne(
        { _id: claim._id },
        {
          $set: {
            status: "已撥款",
            processedAt: now,
            updatedAt: now,
            adminNote: note !== undefined ? note : (claim.adminNote || ""),
          },
        }
      );

      // 2. 連動更新關聯的 orders 集合
      if (Array.isArray(claim.orderNumbers) && claim.orderNumbers.length > 0) {
        await db.collection("orders").updateMany(
          { orderNumber: { $in: claim.orderNumbers } },
          {
            $set: {
              rebateClaimStatus: "approved",
              rebatePayoutAt: now,
            },
          }
        );
      }

      return NextResponse.json({
        success: true,
        message: `申請單號 ${claim.claimId} 撥款審核成功！已標註為【已撥款】並同步更新訂單狀態。`,
      });
    } else if (action === "reject") {
      // 退回申請：更新 rebate_claims 狀態為「已退回」，並將 orders 狀態重設回 unclaimed
      await db.collection("rebate_claims").updateOne(
        { _id: claim._id },
        {
          $set: {
            status: "已退回",
            processedAt: now,
            updatedAt: now,
            adminNote: note !== undefined ? note : (claim.adminNote || ""),
          },
        }
      );

      if (Array.isArray(claim.orderNumbers) && claim.orderNumbers.length > 0) {
        await db.collection("orders").updateMany(
          { orderNumber: { $in: claim.orderNumbers } },
          {
            $set: {
              rebateClaimStatus: "unclaimed",
            },
            $unset: {
              rebateClaimId: "",
              rebateClaimedAt: "",
            },
          }
        );
      }

      return NextResponse.json({
        success: true,
        message: `申請單號 ${claim.claimId} 已設定為【已退回】，並釋放關聯訂單可重新申請。`,
      });
    } else {
      return NextResponse.json({ success: false, message: "無效的操作類型" }, { status: 400 });
    }
  } catch (error: any) {
    console.error("PATCH payout error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
