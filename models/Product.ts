import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVariant {
  _id?: any;
  id?: string;
  name: string;
  price: number;
  image: string;
  images?: string[];
  type?: "ready_made" | "semi_finished";
  sort_order?: number;
  custom_notice?: string;
  ready_made_note?: string;
  lead_time_days?: number;
  status: string;
  reservedUntil: Date | null;
  isSocialPromo?: boolean;
  promoCode?: string;
}

export interface IProduct extends Document {
  seriesId: mongoose.Types.ObjectId;
  originalId: string;
  name: string;
  description?: string;
  category?: "ring" | "pendant" | "bracelet" | "earring" | null;
  image: string;
  detailImages?: string[];
  basePrice: number;
  variants: IVariant[];
  craftIds?: string[];
  sort_order: number;
  status: string;
  reservedUntil: Date | null;
  policy?: {
    specifications?: any;
    ordering?: any;
    returns?: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const VariantSchema = new Schema<IVariant>({
  id: { type: String },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  image: { type: String },
  images: [{ type: String }],
  type: { type: String, enum: ["ready_made", "semi_finished"], default: "ready_made" },
  sort_order: { type: Number, default: 0 },
  custom_notice: { type: String, default: "" },
  ready_made_note: { type: String, default: "" },
  lead_time_days: { type: Number, default: 10 },
  status: { type: String, default: "available" },
  reservedUntil: { type: Date, default: null },
  isSocialPromo: { type: Boolean, default: false },
  promoCode: { type: String, default: "", trim: true }
});

const ProductSchema = new Schema<IProduct>(
  {
    seriesId: { type: Schema.Types.ObjectId, ref: "Series", required: true },
    originalId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String },
    category: { type: String, enum: ["ring", "pendant", "bracelet", "earring", null], default: null },
    image: { type: String },
    detailImages: [{ type: String }],
    basePrice: { type: Number },
    variants: [VariantSchema],
    craftIds: [{ type: String }],
    sort_order: { type: Number, default: 0 },
    status: { type: String, default: "available" },
    reservedUntil: { type: Date, default: null },
    policy: {
      specifications: { type: Schema.Types.Mixed },
      ordering: { type: Schema.Types.Mixed },
      returns: { type: Schema.Types.Mixed }
    }
  },
  { timestamps: true }
);

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
