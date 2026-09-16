import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    const categories = await db.collection("craft_categories").find({}).toArray();
    const crafts = await db.collection("crafts").find({}).toArray();

    return NextResponse.json({ success: true, categories, crafts });
  } catch (error: any) {
    console.error("GET crafts error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json({ success: false, message: "缺少 _id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    delete updateData.createdAt;
    delete updateData.updatedAt;

    if (updateData.categoryId) {
      updateData.categoryId = new ObjectId(updateData.categoryId);
    }

    const result = await db.collection("crafts").updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("PUT craft error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const adminEmails = ["alexli9118@gmail.com", "cc731228@gmail.com"];
    if (!session || !session.user || !adminEmails.includes(session.user.email || "")) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { _id, ...insertData } = body;

    const client = await clientPromise;
    const db = client.db();

    if (insertData.categoryId) {
      insertData.categoryId = new ObjectId(insertData.categoryId);
    }

    const result = await db.collection("crafts").insertOne({
      ...insertData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const newCraft = {
      _id: result.insertedId,
      ...insertData
    };

    return NextResponse.json({ success: true, craft: newCraft });
  } catch (error: any) {
    console.error("POST craft error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
