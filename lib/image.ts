/**
 * 取得圖片的完整網址，用於處理 Cloudflare R2 網址與舊有專案本地相對路徑。
 * 
 * - 若 path 以 http:// 或 https:// 開頭，代表為 R2 網址，直接回傳。
 * - 若 path 以 / 開頭，代表為舊有專案相對路徑，直接回傳。
 * - 若 path 為空或無效，回傳預設的 logo 佔位圖。
 */
export function getImageUrl(path: any): string {
  if (!path) {
    return "/images/logo.png";
  }

  // 支援 Next.js 靜態導入 (StaticImport) 的物件型態
  if (typeof path !== "string") {
    return path.src || "/images/logo.png";
  }

  const trimmed = path.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("/")) {
    return trimmed;
  }

  // 預防性處理：若沒有斜線開頭的相對路徑，補上斜線
  return `/${trimmed}`;
}

