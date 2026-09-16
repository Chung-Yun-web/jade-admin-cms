import { auth } from "@/auth";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const revalidate = 0;

export async function GET() {
  const session = await auth();
  if (!session || !session.user || !session.user.email) {
    return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const user = await db.collection("users").findOne({ email: session.user.email });
    
    if (!user) {
      return NextResponse.json({ error: "找不到使用者" }, { status: 404 });
    }

    return NextResponse.json({ role: user.role || "general" });
  } catch (error) {
    console.error("Failed to fetch user role:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
