import mongoose, { Schema } from "mongoose";

const studentSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
    rollNo: {
      type: String,
      required: true,
      trim: true,
    },
    branch: {
      type: String,
      required: true,
      enum: ["CSE", "IT", "ECE", "EE", "ME", "CE", "OTHER"],
    },
    batch: {
      type: String,
      required: true,
    },
    cgpa: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    tenthPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    twelfthPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },
    skills: {
      type: [String],
      default: [],
    },
    resumeUrl: {
      type: String,
    },
    resumePublicId: {
      type: String,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    placementStatus: {
      type: String,
      enum: ["NOT_PLACED", "PLACED", "MULTIPLE_OFFERS"],
      default: "NOT_PLACED",
    },
    currentOffer: {
      type: Schema.Types.ObjectId,
      ref: "Offer",
      default: null,
    },
    placedAt: {
      type: Date,
      default: null,
    },
    placedInJob: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      default: null,
    },
  },
  { timestamps: true }
);

export const Student = mongoose.model("Student", studentSchema);