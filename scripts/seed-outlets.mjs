import { MongoClient } from "mongodb";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to parse .env.local file
function loadEnv() {
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) {
    console.warn("⚠️ .env.local not found at", envPath);
    return;
  }
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

async function runSeed() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ 找不到 MONGODB_URI 環境變數，請確認 .env.local 設定。");
    process.exit(1);
  }

  console.log("🔌 正在連接 MongoDB...");
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db();

    console.log("🔍 正在從 products 集合挑選合適商品作為 Outlet 初始測試資料...");
    const products = await db.collection("products").find({}).limit(10).toArray();

    if (!products || products.length === 0) {
      console.error("❌ Product 集合內查無任何商品！");
      process.exit(1);
    }

    // Pick 6 products (between 4 and 8)
    const selected = products.slice(0, 6);
    console.log(`📦 已挑選 ${selected.length} 件商品進行轉換：`, selected.map(p => p.name).join(", "));

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

    const statuses = [
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
      // Gather images
      const rawImages = [];
      if (prod.image) rawImages.push(prod.image);
      if (Array.isArray(prod.detailImages)) {
        rawImages.push(...prod.detailImages);
      }
      if (Array.isArray(prod.variants)) {
        prod.variants.forEach((v) => {
          if (Array.isArray(v.images)) rawImages.push(...v.images);
          else if (v.image) rawImages.push(v.image);
        });
      }
      const uniqueImages = Array.from(new Set(rawImages.filter(Boolean)));

      const basePrice = Number(prod.basePrice) || 2000;
      // Discounted outlet price
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

    const isForce = process.argv.includes("--force");
    const count = await db.collection("outlets").countDocuments();

    if (count > 0 && !isForce) {
      console.log(`ℹ️ outlets 集合中已存在 ${count} 筆資料。`);
      console.log("👉 如需強制重置並重新寫入，請加上 --force 參數，例如：node scripts/seed-outlets.mjs --force");
      await client.close();
      return;
    }

    if (isForce && count > 0) {
      console.log(`🗑️ 已清除 outlets 集合中的 ${count} 筆舊資料...`);
      await db.collection("outlets").deleteMany({});
    }

    const result = await db.collection("outlets").insertMany(outletDocs);
    console.log(`✅ 成功匯入 ${result.insertedCount} 筆 Outlet 特賣商品至 MongoDB outlets 集合！`);
    console.log("📋 匯入明細：");
    outletDocs.forEach((d, i) => {
      console.log(`   [${i + 1}] ${d.title} (Slug: ${d.slug}) | 狀態: ${d.status} | 特價: $${d.price} (原價: $${d.originalPrice}) | 圖片數: ${d.images.length}`);
    });

  } catch (err) {
    console.error("❌ 匯入資料時發生錯誤：", err);
    process.exit(1);
  } finally {
    await client.close();
    console.log("🔌 MongoDB 連線已關閉。");
  }
}

runSeed();
