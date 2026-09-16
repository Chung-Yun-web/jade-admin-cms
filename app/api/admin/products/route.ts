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

    const seriesRaw = await db.collection("series").find({}).toArray();
    const productsRaw = await db.collection("products").find({}).toArray();
    const crafts = await db.collection("crafts").find({}).toArray();

    const products = productsRaw.map((p: any) => {
      if (Array.isArray(p.variants)) {
        p.variants = [...p.variants].sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
      }
      p.sort_order = p.sort_order || 0;
      return p;
    });

    const series = seriesRaw.map((ser: any) => {
      const tabs = ser.tabs ? ser.tabs.map((tab: any) => {
        const matchedCraft = crafts.find((c: any) => String(c.id) === String(tab.craftId));
        return {
          ...tab,
          craft: matchedCraft ? {
            image: matchedCraft.image,
            content: matchedCraft.content
          } : undefined
        };
      }) : undefined;

      return {
        ...ser,
        tabs
      };
    });

    return NextResponse.json({ success: true, series, products });
  } catch (error: any) {
    console.error("GET products error:", error);
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

    if (updateData.seriesId) {
      updateData.seriesId = new ObjectId(updateData.seriesId);
    }

    // Ensure status safety
    if (updateData.status === undefined) {
      updateData.status = "available";
    }
    if (Array.isArray(updateData.variants)) {
      updateData.variants = updateData.variants.map((v: any) => ({
        ...v,
        status: v.status || "available"
      }));
    }

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(_id) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("PUT product error:", error);
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

    if (insertData.seriesId) {
      insertData.seriesId = new ObjectId(insertData.seriesId);
    }

    // Assign a unique originalId if not provided (e.g., random short string or timestamp)
    if (!insertData.originalId) {
      insertData.originalId = "p_" + Date.now().toString();
    }

    // Ensure status safety
    if (!insertData.status) {
      insertData.status = "available";
    }
    if (Array.isArray(insertData.variants)) {
      insertData.variants = insertData.variants.map((v: any) => ({
        ...v,
        status: v.status || "available"
      }));
    }

    const result = await db.collection("products").insertOne({
      ...insertData,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const newProduct = {
      _id: result.insertedId,
      ...insertData
    };

    return NextResponse.json({ success: true, product: newProduct });
  } catch (error: any) {
    console.error("POST product error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
