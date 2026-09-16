export interface ProductVariant {
  name: string;      // 規格名稱 (如: 18K古法鏨金 / 14K白金 / 冰種綠翡)
  price: number;     // 規格價格
  image: string;     // 規格圖片路徑
  images?: string[]; // 規格圖片庫，允許上傳多張圖片
  status?: 'available' | 'reserved' | 'sold' | 'archived' | string;
  type?: 'ready_made' | 'semi_finished';
  sort_order?: number;
  custom_notice?: string;
  ready_made_note?: string;
  lead_time_days?: number;
}

export interface ProductPolicy {
  specifications: string; // 規格與材質說明
  ordering: string;       // 訂購與客製須知
  returns: string;        // 退換貨條款
}

export interface CreativeStoryItem {
  title: string;
  content: string;
  image?: string;         // 創意點滴子項圖片 (可選)
}

export interface Product {
  id: string;             // 產品唯一識別碼
  originalId?: string;    // 原始代碼 / 款式編號
  name: string;           // 產品名稱
  description: string;    // 產品簡介
  image: string;          // 主視覺圖路徑
  detailImages?: string[]; // 細節放大圖片路徑清單
  basePrice: number;      // 基礎/起始價格
  variants: ProductVariant[]; // 規格變體清單
  policy?: ProductPolicy;  // 規格、訂購、退貨三個頁籤的條款內容
  creativeStories?: CreativeStoryItem[]; // 創意點滴動態選單
  craftIds?: string[];    // 關聯式工藝與材質 ID 清單
  category?: 'ring' | 'pendant' | 'bracelet' | 'earring' | null;
  status?: 'available' | 'reserved' | 'sold' | 'archived' | string;
  sort_order?: number;     // 產品款式排序
}

export interface TopicSection {
  header?: {
    title: string;
    description?: string;
    subtitle?: string;
    mainTagline?: string;
  };
  story?: {
    image: string;
    subtitle?: string;
    paragraphs: string | string[];
    emphasis?: string;
  };
  features?: {
    title: string;
    content?: string;
    description?: string;
  }[];
}

export interface SeriesTab {
  tabKey: string;
  tabLabel: string;
  header: { title: string; description: string };
  craftId: string;
  features: Array<{ title: string; description: string }>;
  craft?: { image: string; content: string | string[] }; // Populate 後帶出的工藝資料
}

export interface ProductSeries {
  id: string;             // 系列唯一識別碼
  name: string;           // 系列中文名稱 (例如: 自然個性系列)
  englishName: string;    // 系列英文名稱 (例如: Natural Series)
  description: string;    // 系列理念描述
  products: Product[];    // 系列底下的產品清單
  tabs?: SeriesTab[];     // 新的頁籤資料
  seriesStyle?: string | TopicSection; // 系列風格 (已廢棄，相容舊資料)
  moodNotes?: string | TopicSection; // 心情筆記 (已廢棄，相容舊資料)
  outfitPhilosophy?: string | TopicSection; // 穿搭哲學 (已廢棄，相容舊資料)
}
