import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import { auth, isUserAdmin } from "@/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!isUserAdmin(session)) {
      return NextResponse.json({ success: false, message: "未授權" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const force = Boolean(body.force);

    const client = await clientPromise;
    const db = client.db();

    const currentCount = await db.collection("outlets").countDocuments();
    if (currentCount > 0 && !force) {
      return NextResponse.json({
        success: false,
        message: `Outlet 集合中已有 ${currentCount} 筆資料。若需重置並重新匯入，請使用 force 參數。`,
        count: currentCount,
      });
    }

    if (force && currentCount > 0) {
      await db.collection("outlets").deleteMany({});
    }

    // Fetch suitable products from MongoDB
    const products = await db.collection("products").find({}).limit(10).toArray();

    if (!products || products.length === 0) {
      return NextResponse.json(
        { success: false, message: "現有 Product 集合中無商品可供挑選遷移。" },
        { status: 404 }
      );
    }

    // Select 6 products (between 4 and 8)
    const selected = products.slice(0, 6);

    const sourceNotes = [
      "原廠展示孤品出清，成色完美，僅此一件",
      "絕版款式限量出清，微瑕原石手工精雕",
      "VIP尊爵特展陳列品，超值回饋藏家",
      "樣品福利品特賣，純手工包鑲金工",
      "大師手作微瑕切磨孤品，極致通透",
      "年度年終特賣出清，隨附保證書與精美禮盒",
    ];

    const materials = [
      "老坑冰種隨形翡翠、925銀鍍黑金手工雙面透包鑲",
      "天然緬甸A貨雪花玉、18K古法黃金鍛造",
      "特級紅碧玉、14K白金精鑲工藝",
      "高冰晴水綠花玉、925純銀手工雕花托座",
      "墨翠山脈剪影雕刻、18K黃金鏨刻滾邊",
      "頂級冰種藍水翡翠、手工極簡爪鑲項鍊",
    ];

    const statuses: Array<"available" | "reserved" | "sold" | "archived"> = [
      "available",
      "available",
      "reserved",
      "available",
      "sold",
      "archived",
    ];

    const now = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const outletDocs = selected.map((prod, idx) => {
      // Collect all non-duplicate images from product
      const rawImages: string[] = [];
      if (prod.image) rawImages.push(prod.image);
      if (Array.isArray(prod.detailImages)) {
        rawImages.push(...prod.detailImages);
      }
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v: { images?: string[]; image?: string }) => {
          if (Array.isArray(v.images)) rawImages.push(...v.images);
          else if (v.image) rawImages.push(v.image);
        });
      }
      const uniqueImages = Array.from(new Set(rawImages.filter(Boolean)));

      const basePrice = Number(prod.basePrice) || 2000;
      // Calculate discounted outlet price (roughly 60% ~ 75% of original, rounded)
      const discountRate = 0.6 + (idx % 3) * 0.08;
      const originalPrice = basePrice;
      const price = Math.round((originalPrice * discountRate) / 100) * 100;

      const slugBase = (prod.originalId || prod.id || `item-${idx + 1}`)
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9-_]/g, "");
      const slug = `outlet-${slugBase || idx + 1}`;

      const status = statuses[idx] || "available";
      const reservedUntil = status === "reserved" ? tomorrow : null;

      return {
        title: `${prod.name || "翡翠精品"} · 【特賣孤品】`,
        slug,
        price,
        originalPrice,
        images: uniqueImages.length > 0 ? uniqueImages : ["/images/logo.png"],
        material: materials[idx] || "緬甸天然A貨翡翠",
        sourceNote: sourceNotes[idx] || "絕版特賣出清",
        description:
          prod.description ||
          "保留玉石最初的隨形美學與原創肌理，將大自然的鬼斧神工融入日常配戴。此款為單品孤品，售完不補。",
        status,
        reservedUntil,
        sortOrder: idx,
        createdAt: now,
        updatedAt: now,
      };
    });

    const result = await db.collection("outlets").insertMany(outletDocs);

    return NextResponse.json({
      success: true,
      message: `成功匯入 ${result.insertedCount} 筆 Outlet 特賣商品！`,
      count: result.insertedCount,
      outlets: outletDocs,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "發生未知錯誤";
    console.error("POST outlet seed error:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
