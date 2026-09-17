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

    // Fetch all members with required fields (including 'role' and 'member')
    const users = await db.collection("users")
      .find({}, { projection: { _id: 1, name: 1, email: 1, image: 1, role: 1, member: 1, createdAt: 1 } })
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
      members: users.map(user => ({
        ...user,
        member: user.member || "general",
        role: user.role || "general"
      }))
    });
  } catch (error: any) {
    console.error("GET members error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH method to update member status or admin role
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, member, role } = body;

    if (!userId || (member === undefined && role === undefined)) {
      return NextResponse.json({ success: false, message: "缺少必要欄位" }, { status: 400 });
    }

    const updateDoc: Record<string, string> = {};

    if (member !== undefined) {
      if (!["general", "partner"].includes(member)) {
        return NextResponse.json({ success: false, message: "無效的會員身份" }, { status: 400 });
      }
      updateDoc.member = member;
    }

    if (role !== undefined) {
      if (!["admin", "general"].includes(role)) {
        return NextResponse.json({ success: false, message: "無效的管理權限" }, { status: 400 });
      }
      updateDoc.role = role;
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

    return NextResponse.json({ success: true, message: "更新成功" });
  } catch (error: any) {
    console.error("PATCH member error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

