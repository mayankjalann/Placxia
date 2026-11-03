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

allowedStudentSchema.index({ college: 1, branch: 1, batch: 1, isRegistered: 1 });
allowedStudentSchema.index({ email: 1 }, { unique: true });
allowedStudentSchema.index({ college: 1, rollNo: 1 }, { unique: true });

export const AllowedStudent = mongoose.model(
  "AllowedStudent",
  allowedStudentSchema
);
