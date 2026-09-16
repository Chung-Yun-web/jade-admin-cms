import { auth } from "@/auth";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const revalidate = 0;

export async function POST() {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    await db.collection("users").updateOne(
      { email: session.user.email },
      { $set: { isNewUser: false, role: "general" } }
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to complete setup:", error);
    return NextResponse.json({ error: "更新失敗" }, { status: 500 });
  }
}
