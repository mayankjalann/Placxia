import mongoose, { Schema } from "mongoose";

const jobSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    requiredSkills: {
      type: [String],
      default: [],
    },
    positionsAvailable: {
      type: Number,
      required: true,
      min: 1,
    },
    jobType: {
      type: String,
      enum: ["FULL_TIME", "INTERN", "PPO"],
      required: true,
    },
    location: {
      type: String,
      trim: true,
    },
    deadline: {
      type: Date,
      required: true,
    },
    ctcMin: {
      type: Number,
      required: true,
    },
    ctcMax: {
      type: Number,
      required: true,
    },
    cgpaCutoff: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },
    tenthCutoff: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    twelfthCutoff: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    batchEligible: {
      type: [String],
      default: [],
    },
    allowedBranches: {
      type: [String],
      default: [],
    },
    eligibleColleges: [
      {
        type: Schema.Types.ObjectId,
        ref: "College",
      },
    ],
    status: {
      type: String,
      enum: ["DRAFT", "OPEN", "CLOSED"],
      default: "DRAFT",
    },
  },
  { timestamps: true }
);

export const Job = mongoose.model("Job", jobSchema);