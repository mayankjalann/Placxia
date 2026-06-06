import mongoose, { Schema } from "mongoose";

const adminSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true
    },
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    designation: {
      type: String,
      default: "Placement Coordinator",
      trim: true,
    },
    department: {
      type: String,
      default: "Training & Placement Cell",
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Admin = mongoose.model("Admin", adminSchema);