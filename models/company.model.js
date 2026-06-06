import mongoose, { Schema } from "mongoose";

const companySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    industry: {
      type: String,
      required: true,
      enum: ["TECH", "FINANCE", "CORE", "CONSULTING", "ECOMMERCE", "OTHER"],
    },
    website: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    logoUrl: {
      type: String,
    },
    logoPublicId: { //used to delete the old logo if company updates new warna cloudianry exhausts
      type: String,
    },
    isApproved: {
      type: Boolean,
      default: false,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    contactEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    contactPhone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Company = mongoose.model("Company", companySchema);