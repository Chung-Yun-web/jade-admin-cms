import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOutlet extends Document {
  title: string;
  slug: string;
  price: number;
  originalPrice?: number;
  images: string[];
  material?: string;
  sourceNote?: string;
  description?: string;
  status: "available" | "reserved" | "sold" | "archived";
  reservedUntil?: Date | null;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const OutletSchema = new Schema<IOutlet>(
  {
    title: {
      type: String,
      required: [true, "請輸入 Outlet 商品名稱"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "請輸入 Slug 代碼"],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    price: {
      type: Number,
      required: [true, "請輸入特惠售價"],
      min: [0, "售價不可小於 0"],
    },
    originalPrice: {
      type: Number,
      min: [0, "原價不可小於 0"],
      default: undefined,
    },
    images: {
      type: [String],
      default: [],
    },
    material: {
      type: String,
      default: "",
      trim: true,
    },
    sourceNote: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["available", "reserved", "sold", "archived"],
      default: "available",
      index: true,
    },
    reservedUntil: {
      type: Date,
      default: null,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "outlets",
  }
);

export const Outlet: Model<IOutlet> =
  mongoose.models.Outlet || mongoose.model<IOutlet>("Outlet", OutletSchema);

export default Outlet;
