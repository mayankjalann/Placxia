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
    approvedColleges: [
      {
        type: Schema.Types.ObjectId,
        ref: "College"
      }
    ],
    requestedColleges: [
      {
        type: Schema.Types.ObjectId,
        ref: "College"
      }
    ],
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