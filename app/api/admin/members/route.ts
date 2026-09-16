import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";

export const revalidate = 0;

// GET method to list members and stats
export async function GET() {
  try {
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Fetch all members with required fields (including the new decoupled 'member' field)
    const users = await db.collection("users")
      .find({}, { projection: { _id: 1, name: 1, email: 1, image: 1, role: 1, member: 1, createdAt: 1 } })
      .toArray();

    // Calculate stats based on decoupled 'member' status
    const totalMembers = users.length;
    const generalCount = users.filter(user => user.member === "general" || !user.member).length;
    const partnerCount = users.filter(user => user.member === "partner").length;

    return NextResponse.json({
      success: true,
      stats: {
        generalCount,
        partnerCount,
        totalMembers
      },
      members: users.map(user => ({
        ...user,
        member: user.member || "general" // Legacy data compatibility: default to general
      }))
    });
  } catch (error: any) {
    console.error("GET members error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

// PATCH method to update business member status (never overwriting system permissions)
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, member } = body;

    if (!userId || !member) {
      return NextResponse.json({ success: false, message: "缺少必要欄位" }, { status: 400 });
    }

    if (!["general", "partner"].includes(member)) {
      return NextResponse.json({ success: false, message: "無效的會員身份" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Strictly update 'member' field, preserving system 'role'
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: { member: member } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: "找不到該會員" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH member error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

