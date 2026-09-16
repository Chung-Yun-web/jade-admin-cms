import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db();
    
    // Fetch series and return them
    const series = await db.collection("series").find({}).toArray();
    
    return NextResponse.json({ success: true, series });
  } catch (error: any) {
    console.error("GET series error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
