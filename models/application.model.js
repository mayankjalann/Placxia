import mongoose, { Schema } from "mongoose";

const roundSchema = new Schema(
  {
    roundNo: {
      type: Number,
      required: true,
    },
    roundType: {
      type: String,
      enum: ["APTITUDE", "TECHNICAL", "HR", "GD"],
      required: true,
    },
    interviewerName: {
      type: String,
      trim: true,
    },
    scheduledAt: {
      type: Date,
    },
    result: {
      type: String,
      enum: ["PASS", "FAIL", "PENDING"],
      default: "PENDING",
    },
    feedback: {
      type: String,
      trim: true,
    },
  }
);

const applicationSchema = new Schema(
  {
    student: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    status: {
      type: String,
      enum: ["APPLIED", "SHORTLISTED", "SELECTED", "REJECTED"],
      default: "APPLIED",
    },
    applicationSource: {
      type: String,
      enum: ["DIRECT", "DRIVE", "REFERRAL"],
      default: "DIRECT",
    },
    rounds: {
      type: [roundSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Prevent same student applying to same job twice
applicationSchema.index({ student: 1, job: 1 }, { unique: true });

export const Application = mongoose.model("Application", applicationSchema);