import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    const outlets = await db
      .collection("outlets")
      .find({})
      .sort({ sortOrder: 1, createdAt: -1 })
      .toArray();

    return NextResponse.json({ success: true, outlets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("Outlets API error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const insertData = { ...body };
    delete insertData._id;

    const title = (insertData.title || "").trim();
    let slug = (insertData.slug || "").trim().toLowerCase();
    const price = Number(insertData.price);

    if (!title) {
      return NextResponse.json({ success: false, message: "請填寫商品名稱 (title)" }, { status: 400 });
    }
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, message: "請輸入有效的特惠售價 (price)" }, { status: 400 });
    }

    if (!slug) {
      slug = `outlet-${Date.now().toString(36)}`;
    } else {
      // Normalize slug to valid URL characters
      slug = slug.replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    }

    const client = await clientPromise;
    const db = client.db();

    // Check slug uniqueness
    const existing = await db.collection("outlets").findOne({ slug });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Slug 代碼「${slug}」已被使用，請使用不同的 Slug 代碼` },
        { status: 400 }
      );
    }

    const validStatuses = ["available", "reserved", "sold", "archived"];
    const status = validStatuses.includes(insertData.status) ? insertData.status : "available";

    let reservedUntil: Date | null = null;
    if (status === "reserved" && insertData.reservedUntil) {
      reservedUntil = new Date(insertData.reservedUntil);
    }

    const originalPrice =
      insertData.originalPrice !== undefined && insertData.originalPrice !== "" && insertData.originalPrice !== null
        ? Number(insertData.originalPrice)
        : undefined;

    const docToInsert = {
      title,
      slug,
      price,
      ...(originalPrice !== undefined ? { originalPrice } : {}),
      images: Array.isArray(insertData.images) ? insertData.images.filter(Boolean) : [],
      material: (insertData.material || "").trim(),
      sourceNote: (insertData.sourceNote || "").trim(),
      description: (insertData.description || "").trim(),
      status,
      reservedUntil,
      sortOrder: Number(insertData.sortOrder) || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("outlets").insertOne(docToInsert);

    const newOutlet = {
      _id: result.insertedId,
      ...docToInsert,
    };

    return NextResponse.json({ success: true, outlet: newOutlet });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("POST outlet error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json({ success: false, message: "缺少 _id" }, { status: 400 });
    }

    const targetObjectId = new ObjectId(_id);
    const title = (updateData.title || "").trim();
    let slug = (updateData.slug || "").trim().toLowerCase();
    const price = Number(updateData.price);

    if (!title) {
      return NextResponse.json({ success: false, message: "請填寫商品名稱 (title)" }, { status: 400 });
    }
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ success: false, message: "請輸入有效的特惠售價 (price)" }, { status: 400 });
    }

    if (!slug) {
      slug = `outlet-${Date.now().toString(36)}`;
    } else {
      slug = slug.replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
    }

    const client = await clientPromise;
    const db = client.db();

    // Check slug uniqueness across other documents
    const existing = await db.collection("outlets").findOne({
      slug,
      _id: { $ne: targetObjectId },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, message: `Slug 代碼「${slug}」已被其他商品使用，請更換` },
        { status: 400 }
      );
    }

    delete updateData.createdAt;
    delete updateData.updatedAt;

    const validStatuses = ["available", "reserved", "sold", "archived"];
    const status = validStatuses.includes(updateData.status) ? updateData.status : "available";

    let reservedUntil: Date | null = null;
    if (status === "reserved" && updateData.reservedUntil) {
      reservedUntil = new Date(updateData.reservedUntil);
    }

    const originalPrice =
      updateData.originalPrice !== undefined && updateData.originalPrice !== "" && updateData.originalPrice !== null
        ? Number(updateData.originalPrice)
        : null;

    const setFields: Record<string, unknown> = {
      title,
      slug,
      price,
      images: Array.isArray(updateData.images) ? updateData.images.filter(Boolean) : [],
      material: (updateData.material || "").trim(),
      sourceNote: (updateData.sourceNote || "").trim(),
      description: (updateData.description || "").trim(),
      status,
      reservedUntil,
      sortOrder: Number(updateData.sortOrder) || 0,
      updatedAt: new Date(),
    };

    if (originalPrice !== null && !isNaN(originalPrice)) {
      setFields.originalPrice = originalPrice;
    }

    const updateOperation: Record<string, unknown> = { $set: setFields };
    if (originalPrice === null || isNaN(originalPrice as number)) {
      updateOperation.$unset = { originalPrice: "" };
    }

    const result = await db.collection("outlets").updateOne(
      { _id: targetObjectId },
      updateOperation
    );

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("PUT outlet error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    // Support both query param `?id=...` and JSON body `{ id }` or `{ _id }`
    const { searchParams } = new URL(req.url);
    let id = searchParams.get("id");

    if (!id) {
      try {
        const body = await req.json();
        id = body.id || body._id;
      } catch {
        // body might be empty, ignore
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, message: "缺少待刪除的 Outlet ID" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    const result = await db.collection("outlets").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: "找不到該筆 Outlet 商品" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "Outlet 商品已成功刪除" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("DELETE outlet error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
