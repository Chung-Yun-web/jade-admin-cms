import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";
import {
  isHexObjectId,
  normalizeOutletStatusInput,
  resolveOutletStatusFields,
} from "@/lib/outletStatus";


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

    const resolvedStatus = resolveOutletStatusFields({
      status: insertData.status,
      isSocialPromo: insertData.isSocialPromo,
      promoCode: insertData.promoCode,
      existing: null,
    });

    const originalPrice =
      insertData.originalPrice !== undefined && insertData.originalPrice !== "" && insertData.originalPrice !== null
        ? Number(insertData.originalPrice)
        : undefined;

    const docToInsert = {
      title,
      slug,
      price,
      ...(originalPrice !== undefined && !isNaN(originalPrice) ? { originalPrice } : {}),
      images: Array.isArray(insertData.images)
        ? insertData.images.filter((img: unknown) => typeof img === "string" && img.trim().length > 0)
        : [],
      material: (insertData.material || "").trim(),
      dimensions: (insertData.dimensions || "").trim(),
      sourceNote: (insertData.sourceNote || "").trim(),
      description: (insertData.description || "").trim(),
      status: resolvedStatus.status,
      reservedUntil: resolvedStatus.reservedUntil,
      isSocialPromo: resolvedStatus.isSocialPromo,
      promoCode: resolvedStatus.promoCode,
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

    if (!_id || !isHexObjectId(String(_id))) {
      return NextResponse.json({ success: false, message: "缺少或無效的 _id" }, { status: 400 });
    }

    const targetObjectId = new ObjectId(String(_id));
    const client = await clientPromise;
    const db = client.db();

    const existingOutlet = await db.collection("outlets").findOne({ _id: targetObjectId });
    if (!existingOutlet) {
      return NextResponse.json({ success: false, message: "找不到該筆 Outlet 商品" }, { status: 404 });
    }

    const title = (updateData.title ?? existingOutlet.title ?? "").trim();
    let slug = (updateData.slug ?? existingOutlet.slug ?? "").trim().toLowerCase();
    const price =
      updateData.price !== undefined ? Number(updateData.price) : Number(existingOutlet.price);

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

    // Check slug uniqueness across other documents
    const existingSlugDoc = await db.collection("outlets").findOne({
      slug,
      _id: { $ne: targetObjectId },
    });
    if (existingSlugDoc) {
      return NextResponse.json(
        { success: false, message: `Slug 代碼「${slug}」已被其他商品使用，請更換` },
        { status: 400 }
      );
    }

    delete updateData.createdAt;
    delete updateData.updatedAt;

    const resolvedStatus = resolveOutletStatusFields({
      status: updateData.status,
      isSocialPromo: updateData.isSocialPromo,
      promoCode: updateData.promoCode,
      existing: {
        status: existingOutlet.status,
        isSocialPromo: existingOutlet.isSocialPromo,
        promoCode: existingOutlet.promoCode,
      },
    });

    const hasOwn = (key: string) => Object.prototype.hasOwnProperty.call(updateData, key);

    const setFields: Record<string, unknown> = {
      title,
      slug,
      price,
      status: resolvedStatus.status,
      reservedUntil: resolvedStatus.reservedUntil,
      isSocialPromo: resolvedStatus.isSocialPromo,
      promoCode: resolvedStatus.promoCode,
      updatedAt: new Date(),
    };

    // 嚴格保護商品圖片欄位：僅在請求明確提供合法陣列時才更新 images，避免狀態更新誤清空圖片
    if (hasOwn("images") && Array.isArray(updateData.images)) {
      setFields.images = updateData.images.filter(
        (img: unknown) => typeof img === "string" && img.trim().length > 0
      );
    }
    if (hasOwn("material")) {
      setFields.material = (updateData.material || "").trim();
    }
    if (hasOwn("dimensions")) {
      setFields.dimensions = (updateData.dimensions || "").trim();
    }
    if (hasOwn("sourceNote")) {
      setFields.sourceNote = (updateData.sourceNote || "").trim();
    }
    if (hasOwn("description")) {
      setFields.description = (updateData.description || "").trim();
    }
    if (hasOwn("sortOrder")) {
      setFields.sortOrder = Number(updateData.sortOrder) || 0;
    }

    const unsetFields: Record<string, string> = {
      reservedAt: "",
      lockedUntil: "",
    };

    if (hasOwn("originalPrice")) {
      const originalPrice =
        updateData.originalPrice !== undefined &&
        updateData.originalPrice !== "" &&
        updateData.originalPrice !== null
          ? Number(updateData.originalPrice)
          : null;

      if (originalPrice !== null && !isNaN(originalPrice)) {
        setFields.originalPrice = originalPrice;
      } else {
        unsetFields.originalPrice = "";
      }
    }

    const updateOperation: Record<string, unknown> = {
      $set: setFields,
      $unset: unsetFields,
    };

    const result = await db.collection("outlets").updateOne(
      { _id: targetObjectId },
      updateOperation
    );

    const updatedOutlet = await db.collection("outlets").findOne({ _id: targetObjectId });

    return NextResponse.json({ success: true, outlet: updatedOutlet, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("PUT outlet error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const targetIdRaw = body._id || body.id;

    if (!targetIdRaw || !isHexObjectId(String(targetIdRaw))) {
      return NextResponse.json({ success: false, message: "缺少或無效的 _id" }, { status: 400 });
    }

    if (body.status !== undefined && !normalizeOutletStatusInput(body.status)) {
      return NextResponse.json({ success: false, message: "無效的販售狀態 (status)" }, { status: 400 });
    }

    const targetObjectId = new ObjectId(String(targetIdRaw));
    const client = await clientPromise;
    const db = client.db();

    const existingOutlet = await db.collection("outlets").findOne({ _id: targetObjectId });
    if (!existingOutlet) {
      return NextResponse.json({ success: false, message: "找不到該筆 Outlet 商品" }, { status: 404 });
    }

    const resolvedStatus = resolveOutletStatusFields({
      status: body.status,
      isSocialPromo: body.isSocialPromo,
      promoCode: body.promoCode,
      existing: {
        status: existingOutlet.status,
        isSocialPromo: existingOutlet.isSocialPromo,
        promoCode: existingOutlet.promoCode,
      },
    });

    // 狀態快速切換僅局部更新狀態與保留欄位，嚴格不碰觸 images / imageUrl 與其他商品資料
    const result = await db.collection("outlets").updateOne(
      { _id: targetObjectId },
      {
        $set: {
          status: resolvedStatus.status,
          isSocialPromo: resolvedStatus.isSocialPromo,
          promoCode: resolvedStatus.promoCode,
          reservedUntil: resolvedStatus.reservedUntil,
          updatedAt: new Date(),
        },
        $unset: {
          reservedAt: "",
          lockedUntil: "",
        },
      }
    );

    const updatedOutlet = await db.collection("outlets").findOne({ _id: targetObjectId });

    return NextResponse.json({ success: true, outlet: updatedOutlet, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("PATCH outlet error:", error);
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
