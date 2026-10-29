import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export const revalidate = 0;

// GET method to list members and stats
export async function GET() {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Fetch all members with required fields (including 'role', 'member', and 'rewardRate')
    const users = await db.collection("users")
      .find({}, { projection: { _id: 1, name: 1, email: 1, image: 1, role: 1, member: 1, rewardRate: 1, createdAt: 1 } })
      .toArray();

    // Calculate stats based on 'member' and 'role'
    const totalMembers = users.length;
    const generalCount = users.filter(user => user.member === "general" || !user.member).length;
    const partnerCount = users.filter(user => user.member === "partner").length;
    const adminRoleCount = users.filter(user => user.role === "admin").length;

    return NextResponse.json({
      success: true,
      stats: {
        generalCount,
        partnerCount,
        totalMembers,
        adminRoleCount
      },
      members: users.map(user => {
        const isPartner = user.member === "partner" || user.role === "partner";
        let rewardRate = user.rewardRate;
        if (isPartner && (rewardRate === undefined || rewardRate === null)) {
          rewardRate = 15;
        }

        return {
          ...user,
          member: user.member || "general",
          role: user.role || "general",
          rewardRate: isPartner ? Number(rewardRate) : (rewardRate !== undefined ? Number(rewardRate) : 0),
        };
      })
    });
  } catch (error: any) {
    console.error("GET members error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH method to update member status, reward rate, or admin role
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, member, role, rewardRate } = body;

    if (!userId || (member === undefined && role === undefined && rewardRate === undefined)) {
      return NextResponse.json({ success: false, message: "缺少必要欄位" }, { status: 400 });
    }

    const updateDoc: Record<string, any> = {};

    if (member !== undefined) {
      if (!["general", "partner"].includes(member)) {
        return NextResponse.json({ success: false, message: "無效的會員身份" }, { status: 400 });
      }
      updateDoc.member = member;

      // 若升級為商店會員且尚未設定回饋比例，則給予預設值 15%
      if (member === "partner" && rewardRate === undefined) {
        const client = await clientPromise;
        const db = client.db();
        const existingUser = await db.collection("users").findOne({ _id: new ObjectId(userId) });
        if (existingUser && (existingUser.rewardRate === undefined || existingUser.rewardRate === null)) {
          updateDoc.rewardRate = 15;
        }
      }
    }

    if (role !== undefined) {
      if (!["admin", "general"].includes(role)) {
        return NextResponse.json({ success: false, message: "無效的管理權限" }, { status: 400 });
      }
      updateDoc.role = role;
    }

    if (rewardRate !== undefined) {
      let parsedRate = Number(rewardRate);
      // 若管理員輸入小數點比例 (例如 0.15)，自動轉換為百分比數值 15
      if (parsedRate > 0 && parsedRate < 1) {
        parsedRate = Math.round(parsedRate * 100 * 100) / 100;
      }

      if (isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        return NextResponse.json({ success: false, message: "回饋比例必須為 0 至 100 之間的有效數值" }, { status: 400 });
      }
      updateDoc.rewardRate = parsedRate;
    }

    const client = await clientPromise;
    const db = client.db();

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateDoc }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: "找不到該會員" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "更新成功", updated: updateDoc });
  } catch (error: any) {
    console.error("PATCH member error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

