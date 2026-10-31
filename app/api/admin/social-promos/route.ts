import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";
import { generatePromoCode, getFrontendBaseUrl, buildPromoDirectUrl } from "@/lib/utils";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db();

    // Determine frontend base URL for direct links (defaulting to https://jade-brand-site.vercel.app)
    const baseUrl = getFrontendBaseUrl();

    // 1. Fetch products that have any variant with isSocialPromo === true
    const products = await db
      .collection("products")
      .find({ "variants.isSocialPromo": true })
      .toArray();

    // 2. Fetch outlets with isSocialPromo === true
    const outlets = await db
      .collection("outlets")
      .find({ isSocialPromo: true })
      .toArray();

    const items: any[] = [];

    // Process products variants
    products.forEach((prod: any) => {
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v: any, vIdx: number) => {
          if (v.isSocialPromo) {
            const promo = v.promoCode || "";
            const directPath = `/product?id=${prod._id}&spec=${encodeURIComponent(v.name || "")}&promo=${encodeURIComponent(promo)}`;
            const fullUrl = buildPromoDirectUrl({
              type: "product",
              productId: String(prod._id),
              specName: v.name || "",
              promoCode: promo,
            });
            items.push({
              id: `${prod._id}_${vIdx}`,
              type: "product",
              sourceId: String(prod._id),
              productId: String(prod._id),
              variantIndex: vIdx,
              title: prod.name,
              variantName: v.name || `規格 #${vIdx + 1}`,
              price: v.price || 0,
              originalPrice: undefined,
              image: v.image || (Array.isArray(v.images) && v.images[0]) || prod.image || "/images/logo.png",
              status: v.status || "reserved",
              isSocialPromo: true,
              promoCode: promo,
              directPath,
              fullUrl,
              updatedAt: prod.updatedAt || prod.createdAt || new Date(),
            });
          }
        });
      }
    });

    // Process outlets
    outlets.forEach((out: any) => {
      const promo = out.promoCode || "";
      const directPath = `/outlet?slug=${encodeURIComponent(out.slug || "")}&promo=${encodeURIComponent(promo)}`;
      const fullUrl = buildPromoDirectUrl({
        type: "outlet",
        slug: out.slug || "",
        promoCode: promo,
      });
      items.push({
        id: String(out._id),
        type: "outlet",
        sourceId: String(out._id),
        slug: out.slug,
        title: out.title,
        variantName: "Outlet 特賣單品",
        price: out.price || 0,
        originalPrice: out.originalPrice,
        image: (Array.isArray(out.images) && out.images[0]) || "/images/logo.png",
        status: out.status || "reserved",
        isSocialPromo: true,
        promoCode: promo,
        directPath,
        fullUrl,
        updatedAt: out.updatedAt || out.createdAt || new Date(),
      });
    });

    // Sort items by updatedAt descending
    items.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Stats calculations
    const stats = {
      totalCount: items.length,
      productCount: items.filter((i) => i.type === "product").length,
      outletCount: items.filter((i) => i.type === "outlet").length,
      reservedCount: items.filter((i) => i.status === "reserved").length,
      soldCount: items.filter((i) => i.status === "sold").length,
      availableCount: items.filter((i) => i.status === "available").length,
    };

    return NextResponse.json({ success: true, baseUrl, items, stats });
  } catch (error: any) {
    console.error("GET social-promos error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json();
    const { type, sourceId, variantIndex, action } = body;

    if (!type || !sourceId || !action) {
      return NextResponse.json({ success: false, message: "缺少必要參數" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    if (type === "outlet") {
      const targetId = new ObjectId(sourceId);
      if (action === "release") {
        await db.collection("outlets").updateOne(
          { _id: targetId },
          {
            $set: {
              isSocialPromo: false,
              status: "available",
              promoCode: "",
              updatedAt: new Date(),
            },
          }
        );
        return NextResponse.json({ success: true, message: "已解除特惠保留" });
      } else if (action === "regenerateCode") {
        const newCode = generatePromoCode();
        await db.collection("outlets").updateOne(
          { _id: targetId },
          {
            $set: {
              promoCode: newCode,
              updatedAt: new Date(),
            },
          }
        );
        return NextResponse.json({ success: true, newPromoCode: newCode });
      }
    } else if (type === "product") {
      const targetId = new ObjectId(sourceId);
      const product = await db.collection("products").findOne({ _id: targetId });
      if (!product) {
        return NextResponse.json({ success: false, message: "找不到指定商品" }, { status: 404 });
      }

      const vIdx = Number(variantIndex);
      if (isNaN(vIdx) || !product.variants || !product.variants[vIdx]) {
        return NextResponse.json({ success: false, message: "找不到指定規格變體" }, { status: 404 });
      }

      const updatedVariants = [...product.variants];
      if (action === "release") {
        updatedVariants[vIdx] = {
          ...updatedVariants[vIdx],
          isSocialPromo: false,
          status: "available",
          promoCode: "",
        };
        await db.collection("products").updateOne(
          { _id: targetId },
          {
            $set: {
              variants: updatedVariants,
              updatedAt: new Date(),
            },
          }
        );
        return NextResponse.json({ success: true, message: "已解除特惠保留" });
      } else if (action === "regenerateCode") {
        const newCode = generatePromoCode();
        updatedVariants[vIdx] = {
          ...updatedVariants[vIdx],
          promoCode: newCode,
        };
        await db.collection("products").updateOne(
          { _id: targetId },
          {
            $set: {
              variants: updatedVariants,
              updatedAt: new Date(),
            },
          }
        );
        return NextResponse.json({ success: true, newPromoCode: newCode });
      }
    }

    return NextResponse.json({ success: false, message: "不支援的操作" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH social-promos error:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
