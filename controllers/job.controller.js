import { Job } from "../models/job.model.js";
import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Student } from "../models/student.model.js";
import mongoose from "mongoose";
import { Application } from "../models/application.model.js";
import { Offer } from "../models/offer.model.js";
import { getStudentJobEligibilityReason } from "../utils/jobEligibility.js";

const hasApprovedAllColleges = (company, collegeIds) =>
    Array.isArray(collegeIds) && collegeIds.length > 0 && collegeIds.every((collegeId) =>
        company.approvedColleges.some((approvedId) => approvedId.toString() === collegeId.toString()) &&
        company.requestedColleges.some((requestedId) => requestedId.toString() === collegeId.toString())
    );

const isDeadlineCurrent = (deadline) => {
    const deadlineEnd = new Date(deadline);
    if (Number.isNaN(deadlineEnd.getTime())) return false;
    deadlineEnd.setUTCHours(23, 59, 59, 999);
    return deadlineEnd >= new Date();
};

const validateEligibilityFields = (fields) => {
    const numericRanges = { cgpaCutoff: [0, 10] };
    for (const [field, [min, max]] of Object.entries(numericRanges)) {
        if (fields[field] === undefined) continue;
        const value = Number(fields[field]);
        if (!Number.isFinite(value) || value < min || value > max) {
            throw new ApiError(400, `${field} must be between ${min} and ${max}`);
        }
    }
    const allowedBranches = ["CSE", "IT", "ECE", "EE", "ME", "CE", "OTHER"];
    if (fields.allowedBranches !== undefined && (!Array.isArray(fields.allowedBranches) || fields.allowedBranches.some((branch) => !allowedBranches.includes(branch)))) {
        throw new ApiError(400, "Select valid branch codes for eligibility");
    }
};

const createJob=asyncHandler(async (req,res)=>{
    const company= await Company.findOne({user: req.user._id});

    if(!company){
        throw new ApiError(404,"Company profile not found");
    }

    const {
        title,
        description,
        positionsAvailable,
        jobType,
        location,
        deadline,
        ctcMin,
        ctcMax,
        cgpaCutoff,
        allowedBranches,
        eligibleColleges
      } = req.body;
    
      // 4. Basic validation
      if (!title || !description || !positionsAvailable || !jobType || !deadline) {
        throw new ApiError(400, "Missing required job fields");
      }
      if (!Number.isInteger(Number(positionsAvailable)) || Number(positionsAvailable) < 1) {
        throw new ApiError(400, "Number of positions must be a positive whole number");
      }
      if (!Number.isFinite(Number(ctcMin)) || !Number.isFinite(Number(ctcMax)) ||
          Number(ctcMin) < 0 || Number(ctcMax) < Number(ctcMin)) {
        throw new ApiError(400, "Enter a valid salary range");
      }
      if (!isDeadlineCurrent(deadline)) {
        throw new ApiError(400, "Application deadline must be today or a future date");
      }
      validateEligibilityFields({ cgpaCutoff, allowedBranches });

      if (!Array.isArray(eligibleColleges) || eligibleColleges.length === 0) {
        throw new ApiError(400, "Select at least one approved college for this job");
      }
      if (!eligibleColleges.every(mongoose.isValidObjectId)) {
        throw new ApiError(400, "One or more selected colleges are invalid");
      }
      if (!hasApprovedAllColleges(company, eligibleColleges)) {
        throw new ApiError(403, "You can only post jobs to colleges that have approved your company.");
      }

      const job = await Job.create({
        company: company._id,
        title,
        description,
        requiredSkills: [],
        positionsAvailable,
        jobType,
        location,
        deadline,
        ctcMin,
        ctcMax,
        cgpaCutoff,
        tenthCutoff: 0,
        twelfthCutoff: 0,
        batchEligible: [],
        allowedBranches,
        eligibleColleges,
        status: "DRAFT" // company can publish later
      });
    
      // 6. Return response
      return res.status(201).json(
        new ApiResponse(
          201,
          job,
          "Job created successfully (DRAFT mode)"
        )
      );
})

const publishJob = asyncHandler(async (req, res) => {

    const { jobId } = req.params;
  
    // 1. get company profile
    const company = await Company.findOne({ user: req.user._id });
  
    if (!company) {
      throw new ApiError(404, "Company profile not found");
    }
  
    // 2. find job
    const job = await Job.findById(jobId);
  
    if (!job) {
      throw new ApiError(404, "Job not found");
    }
  
    // 3. ensure ownership
    if (job.company.toString() !== company._id.toString()) {
      throw new ApiError(403, "You cannot publish this job");
    }
  
    // 4. ensure only draft jobs can be published
    if (job.status !== "DRAFT") {
      throw new ApiError(400, "Only draft jobs can be published");
    }

    if (!hasApprovedAllColleges(company, job.eligibleColleges)) {
      throw new ApiError(403, "Your company must be approved for every selected college before publishing this job.");
    }
  
    // 5. validate required fields before publishing
    if (!job.title || !job.description || !job.deadline) {
      throw new ApiError(400, "Job is incomplete. Cannot publish");
    }
    if (!isDeadlineCurrent(job.deadline)) {
      throw new ApiError(400, "Application deadline has passed");
    }
    if (!Number.isFinite(Number(job.ctcMin)) || !Number.isFinite(Number(job.ctcMax)) ||
        Number(job.ctcMin) < 0 || Number(job.ctcMax) < Number(job.ctcMin)) {
      throw new ApiError(400, "Enter a valid salary range before publishing");
    }
  
    // 6. publish job
    job.status = "OPEN";
  
    await job.save();
  
    return res.status(200).json(
      new ApiResponse(
        200,
        job,
        "Job published successfully"
      )
    );
  });

const updateJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);

    if (!job) {
        throw new ApiError(404, "Job not found");
    }

    const company = await Company.findOne({ user: req.user._id });

    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }

    // Fix: We must compare company._id, not the whole company object!
    if (company._id.toString() !== job.company.toString()) {
        throw new ApiError(403, "You do not have permission to update this job");
    }

    if (job.status === "CLOSED") {
        throw new ApiError(400, "You cannot update a closed job");
    }

    // The fields the company is allowed to edit
    const allowedFields = [
        "title",
        "description",
        "positionsAvailable",
        "jobType",
        "location",
        "deadline",
        "ctcMin",
        "ctcMax",
        "cgpaCutoff",
        "allowedBranches",
        "eligibleColleges"
    ];

    if (req.body.eligibleColleges !== undefined) {
        if (!Array.isArray(req.body.eligibleColleges) || req.body.eligibleColleges.length === 0) {
            throw new ApiError(400, "Select at least one approved college for this job");
        }
        if (!req.body.eligibleColleges.every(mongoose.isValidObjectId)) {
            throw new ApiError(400, "One or more selected colleges are invalid");
        }
        if (!hasApprovedAllColleges(company, req.body.eligibleColleges)) {
            throw new ApiError(403, "You can only target colleges that have approved your company.");
        }
    }

    validateEligibilityFields({ cgpaCutoff: req.body.cgpaCutoff, allowedBranches: req.body.allowedBranches });
    job.requiredSkills = [];
    job.tenthCutoff = 0;
    job.twelfthCutoff = 0;
    job.batchEligible = [];

    // Loop through and update only what was sent in the request
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            job[field] = req.body[field];
        }
    });

    if (!isDeadlineCurrent(job.deadline)) {
        throw new ApiError(400, "Application deadline must be today or a future date");
    }

    await job.save();

    return res.status(200).json(
        new ApiResponse(200, job, "Job updated successfully")
    );
});

const closeJob= asyncHandler(async(req,res)=>{
    const {jobId}=req.params;

    const job= await Job.findById(jobId);

    if(!job){
        throw new ApiError(404, "Job not found");
    }

    const company= await Company.findOne({user: req.user?._id});

    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }

    if(company._id.toString() !== job.company.toString()){
        throw new ApiError(403, "You do not have permission to close this job");
    }

    if(job.status=="CLOSED"){
        throw new ApiError(400, "Job is already closed");
    }

    job.status="CLOSED"

    await job.save();

    return res.status(200).json(
        new ApiResponse(200, job, "Job closed successfully. Students can no longer apply.")
    );
})

const getCompanyJobs = asyncHandler(async (req, res) => {
    // 1. Find the company profile for the logged in user
    const company = await Company.findOne({ user: req.user._id });

    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }

    // 2. Fetch all jobs belonging to this company, sorted newest first
    const jobs = await Job.find({ company: company._id }).sort({ createdAt: -1 });

    // 3. Return the array of jobs
    return res.status(200).json(
        new ApiResponse(200, jobs, "Company jobs fetched successfully")
    );
});

const getAllOpenJobs= asyncHandler(async(req,res)=>{
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const jobFilter = {
        status: "OPEN",
        deadline: { $gte: todayStart }
    };

    let student = null;
    if (req.user.role === "STUDENT") {
        student = await Student.findOne({ user: req.user._id });
        if (!student) {
            throw new ApiError(404, "Student profile not found");
        }
    }

    const openJobs = await Job.find(jobFilter)
    .populate("company","name industry logoUrl")
    .sort({createdAt: -1}); //descending order

    let visibleJobs = req.user.role === "STUDENT"
        ? openJobs.map((job) => ({
            ...job.toObject(),
            eligibilityReason: getStudentJobEligibilityReason(job, student),
        }))
        : openJobs;
    return res.status(200).json(
        new ApiResponse(200, visibleJobs, "Open jobs fetched successfully")
    );

})

const getJobById = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    // Find the job and populate the company details
    const job = await Job.findById(jobId).populate("company", "name industry website logoUrl description");

    if (!job) {
        throw new ApiError(404, "Job not found");
    }

    let eligibilityReason = null;
    if (req.user.role === "STUDENT") {
        const student = await Student.findOne({ user: req.user._id });
        if (!student) {
            throw new ApiError(404, "Student profile not found");
        }
        if (job.status !== "OPEN" || !isDeadlineCurrent(job.deadline)) {
            throw new ApiError(404, "Job not found");
        }
        eligibilityReason = getStudentJobEligibilityReason(job, student);
    }

    return res.status(200).json(
        new ApiResponse(200, eligibilityReason ? { ...job.toObject(), eligibilityReason } : job, "Job details fetched successfully")
    );
});

const getSavedJobs = asyncHandler(async (req, res) => {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) throw new ApiError(404, "Student profile not found");
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const jobs = await Job.find({
        _id: { $in: student.savedJobs || [] },
        status: "OPEN",
        deadline: { $gte: todayStart },
    }).populate("company", "name industry logoUrl").sort({ createdAt: -1 });
    return res.status(200).json(new ApiResponse(200, jobs, "Saved jobs fetched"));
});

const toggleSavedJob = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.jobId)) throw new ApiError(404, "Job not found");
    const student = await Student.findOne({ user: req.user._id });
    if (!student) throw new ApiError(404, "Student profile not found");
    const job = await Job.findById(req.params.jobId);
    if (!job || job.status !== "OPEN" || !isDeadlineCurrent(job.deadline)) throw new ApiError(404, "Open job not found");
    const saved = (student.savedJobs || []).some((id) => id.toString() === job._id.toString());
    if (saved) student.savedJobs = student.savedJobs.filter((id) => id.toString() !== job._id.toString());
    else student.savedJobs.push(job._id);
    await student.save();
    return res.status(200).json(new ApiResponse(200, { saved: !saved }, saved ? "Job removed from saved jobs" : "Job saved"));
});

const getPublicStats = asyncHandler(async (req, res) => {
    const [activePartners, openJobs, applications, placedStudents, highestOffer] = await Promise.all([
        Company.countDocuments({ approvedColleges: { $exists: true, $ne: [] } }),
        Job.countDocuments({ status: "OPEN", deadline: { $gte: new Date() } }),
        Application.countDocuments(),
        Student.countDocuments({ placementStatus: { $in: ["PLACED", "MULTIPLE_OFFERS"] } }),
        Offer.findOne({ status: "ACCEPTED" }).sort({ offeredCtc: -1 }).select("offeredCtc").lean(),
    ]);
    return res.status(200).json(new ApiResponse(200, {
        activePartners,
        openJobs,
        applications,
        placedStudents,
        highestPackage: highestOffer?.offeredCtc || 0,
    }, "Public statistics fetched"));
});


export {createJob, 
publishJob,
updateJob,
closeJob,
getCompanyJobs,
getAllOpenJobs,
getJobById};
export { getSavedJobs, toggleSavedJob, getPublicStats };
