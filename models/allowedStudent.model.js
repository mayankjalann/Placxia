import mongoose, { Schema } from "mongoose";

const allowedStudentSchema = new Schema(
  {
    college: {
      type: Schema.Types.ObjectId,
      ref: "College",
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    rollNo: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      trim: true,
    },
    batch: {
      type: String,
      required: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

export const AllowedStudent = mongoose.model(
  "AllowedStudent",
  allowedStudentSchema
);