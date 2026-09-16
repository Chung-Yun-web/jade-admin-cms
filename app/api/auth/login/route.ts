import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import clientPromise from "@/lib/mongodb";
import productsJsonRaw from "@/lib/products.json";

// Types for products JSON
interface StaticProduct {
  id: string;
  name: string;
  status?: string;
  isActive?: boolean;
}

interface StaticSeries {
  id: string;
  products: StaticProduct[];
}

// Check if a product is active/valid in static JSON
function findProductInStatic(productId: string): { found: boolean; isValid: boolean } {
  const seriesList = productsJsonRaw as unknown as StaticSeries[];
  for (const series of seriesList) {
    const product = series.products.find((p) => p.id === productId);
    if (product) {
      const isOffShelf =
        product.status === "off-shelf" ||
        product.status === "inactive" ||
        product.isActive === false;
      return { found: true, isValid: !isOffShelf };
    }
  }
  return { found: false, isValid: false };
}

export async function POST(req: NextRequest) {
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "無效的 JSON 格式" },
        { status: 400 }
      );
    }

    const { userId, email, temporaryCart, isCheckoutPage } = body;
    const isCheckout = Boolean(isCheckoutPage);

    if (!userId && !email) {
      return NextResponse.json(
        { success: false, message: "缺少必要識別參數 (userId 或 email)" },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    const client = await clientPromise;
    const db = client.db();

    // Query User
    let query: any = {};
    if (userId) {
      try {
        query._id = new ObjectId(userId);
      } catch {
        query.id = userId;
      }
    } else if (email) {
      query.email = email;
    }

    const user = await db.collection("users").findOne(query);

    if (!user) {
      return NextResponse.json(
        { success: false, message: "找不到該會員" },
        { status: 404 }
      );
    }

    // Retrieve historical cart from DB
    const dbCart = user.cart || [];

    // Helper function to check product validity
    const validateProduct = async (prodIdStr: string) => {
      // 1. Try querying products collection in MongoDB
      try {
        let pQuery: any = { id: prodIdStr };
        try {
          pQuery = {
            $or: [{ id: prodIdStr }, { _id: new ObjectId(prodIdStr) }],
          };
        } catch {
          // Keep search by string id only
        }

        const dbProduct = await db.collection("products").findOne(pQuery);
        if (dbProduct) {
          const isOffShelf =
            dbProduct.status === "off-shelf" ||
            dbProduct.status === "inactive" ||
            dbProduct.isActive === false ||
            dbProduct.isPublished === false;
          return !isOffShelf;
        }
      } catch (err) {
        console.error("Querying products collection error:", err);
      }

      // 2. Fallback: check static JSON file
      const staticResult = findProductInStatic(prodIdStr);
      if (staticResult.found) {
        return staticResult.isValid;
      }

      // If not found in DB or static JSON, consider it as not existing
      return false;
    };

    // Filter valid historical cart items, and clean up their product_id if they have a spec in product_id
    const filteredDbCart: any[] = [];
    for (const item of dbCart) {
      const rawId = (item.product_id ? item.product_id.toString() : "");
      const dashIndex = rawId.indexOf("-");
      let cleanId = rawId;
      let spec = item.spec || "";

      if (dashIndex !== -1) {
        cleanId = rawId.substring(0, dashIndex);
        if (!spec) {
          spec = rawId.substring(dashIndex + 1);
        }
      }

      if (cleanId && (await validateProduct(cleanId))) {
        filteredDbCart.push({
          product_id: cleanId,
          spec: spec || undefined,
          quantity: Number(item.quantity) || 1,
          source: item.source || "db", // Default to "db" for historical items
        });
      }
    }

    // Generate session/login token
    const token = crypto.randomBytes(32).toString("hex");

    const hasTemporaryItems = Array.isArray(temporaryCart) && temporaryCart.length > 0;

    const mergedCart: any[] = [];

    if (hasTemporaryItems) {
      // 1. Process temporary cart (A) -> all items are marked as "session"
      for (const item of temporaryCart) {
        const rawId = (item.product_id || item.id || "").toString();
        const dashIndex = rawId.indexOf("-");
        let cleanId = rawId;
        let spec = item.spec || "";

        if (dashIndex !== -1) {
          cleanId = rawId.substring(0, dashIndex);
          if (!spec) {
            spec = rawId.substring(dashIndex + 1);
          }
        }

        if (cleanId) {
          const existingTemp = mergedCart.find(
            (x) => x.product_id === cleanId && (x.spec || "") === spec
          );
          if (existingTemp) {
            existingTemp.quantity += Number(item.quantity) || 1;
          } else {
            mergedCart.push({
              product_id: cleanId,
              spec: spec || undefined,
              quantity: Number(item.quantity) || 1,
              source: "session",
            });
          }
        }
      }

      // 2. Merge with filtered DB cart (B) -> historical items default to "db"
      for (const dbItem of filteredDbCart) {
        const dbIdStr = dbItem.product_id;
        const dbSpec = dbItem.spec || "";

        const existing = mergedCart.find(
          (item) => item.product_id === dbIdStr && (item.spec || "") === dbSpec
        );

        if (existing) {
          // If it matches a temporary item, sum quantities and keep it as "session"
          existing.quantity += Number(dbItem.quantity) || 1;
        } else {
          mergedCart.push({
            product_id: dbIdStr,
            spec: dbSpec || undefined,
            quantity: Number(dbItem.quantity) || 1,
            source: dbItem.source || "db",
          });
        }
      }

      // Format payload for MongoDB (using ObjectId or original string)
      const dbCartPayload = mergedCart.map((item) => {
        let objectId;
        try {
          objectId = new ObjectId(item.product_id);
        } catch {}
        return {
          product_id: objectId || item.product_id,
          spec: item.spec || undefined,
          quantity: item.quantity,
          source: item.source || "session", // Keep source as is (session for temp, db for db)
        };
      });

      // Write merged cart immediately to MongoDB to ensure NO data loss
      await db.collection("users").updateOne(
        query,
        {
          $set: { cart: dbCartPayload },
        },
        { upsert: false }
      );
    } else {
      // No temporary items: If not on checkout page, force convert any "session" items in DB to "db"
      // Even if on checkout page with no temp items, they are already historical "db" items
      const updatedDbCart = filteredDbCart.map(item => ({
        ...item,
        source: isCheckout ? (item.source || "db") : "db" as const
      }));

      const dbCartPayload = updatedDbCart.map((item) => {
        let objectId;
        try {
          objectId = new ObjectId(item.product_id);
        } catch {}
        return {
          product_id: objectId || item.product_id,
          spec: item.spec || undefined,
          quantity: item.quantity,
          source: item.source,
        };
      });

      await db.collection("users").updateOne(
        query,
        {
          $set: { cart: dbCartPayload },
        },
        { upsert: false }
      );

      mergedCart.push(...updatedDbCart);
    }

    return NextResponse.json({
      success: true,
      message: "會員登入成功 (已合併並同步至資料庫)",
      token,
      isCheckoutMode: isCheckout,
      cart: mergedCart,
      user: {
        id: user._id ? user._id.toString() : user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error: any) {
    console.error("Login cart API error:", error);
    return NextResponse.json(
      { success: false, message: "伺服器內部錯誤" },
      { status: 500 }
    );
  }
}
