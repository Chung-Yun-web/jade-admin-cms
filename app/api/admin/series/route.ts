import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { _id, name, description, image, seriesStyle, moodNotes, outfitPhilosophy, tabs } = body;

    if (!_id) {
      return NextResponse.json({ success: false, message: "缺少 _id" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const updateDoc: any = {
      updatedAt: new Date()
    };
    if (name !== undefined) updateDoc.name = name;
    if (description !== undefined) updateDoc.description = description;
    if (image !== undefined) updateDoc.image = image;
    if (seriesStyle !== undefined) updateDoc.seriesStyle = seriesStyle;
    if (moodNotes !== undefined) updateDoc.moodNotes = moodNotes;
    if (outfitPhilosophy !== undefined) updateDoc.outfitPhilosophy = outfitPhilosophy;
    if (tabs !== undefined) updateDoc.tabs = tabs;

    const result = await db.collection("series").updateOne(
      { _id: new ObjectId(_id) },
      { $set: updateDoc }
    );

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("PUT series error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
