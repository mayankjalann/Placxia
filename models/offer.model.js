import mongoose, { Schema } from "mongoose";

const offerSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    application: {
        type: Schema.Types.ObjectId,
        ref: "Application",
        required: true
      },
    offeredCtc: {
      type: Number,
      required: true,
    },
    offerLetterUrl: {
      type: String,
    },
    offerLetterPublicId: {
      type: String,
    },
    joiningDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "DECLINED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

export const Offer = mongoose.model("Offer", offerSchema);