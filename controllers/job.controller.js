import { Job } from "../models/job.model.js";
import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { Student } from "../models/student.model.js";
const createJob=asyncHandler(async (req,res)=>{
    const company= await Company.findOne({user: req.user._id});

    if(!company){
        throw new ApiError(404,"Company profile not found");
    }

    const {
        title,
        description,
        requiredSkills,
        positionsAvailable,
        jobType,
        location,
        deadline,
        ctcMin,
        ctcMax,
        cgpaCutoff,
        tenthCutoff,
        twelfthCutoff,
        batchEligible,
        allowedBranches,
        eligibleColleges
      } = req.body;
    
      // 4. Basic validation
      if (!title || !description || !positionsAvailable || !jobType || !deadline) {
        throw new ApiError(400, "Missing required job fields");
      }

      // 5. Check if company is approved by ALL requested colleges
      if (eligibleColleges && eligibleColleges.length > 0) {
        const unapproved = eligibleColleges.filter(
            id => !company.approvedColleges.includes(id)
        );
        if (unapproved.length > 0) {
            throw new ApiError(403, "You can only post jobs to colleges that have approved your company.");
        }
      }

      const job = await Job.create({
        company: company._id,
        title,
        description,
        requiredSkills,
        positionsAvailable,
        jobType,
        location,
        deadline,
        ctcMin,
        ctcMax,
        cgpaCutoff,
        tenthCutoff,
        twelfthCutoff,
        batchEligible,
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
  
    // 5. validate required fields before publishing
    if (!job.title || !job.description || !job.deadline) {
      throw new ApiError(400, "Job is incomplete. Cannot publish");
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
        "requiredSkills",
        "positionsAvailable",
        "jobType",
        "location",
        "deadline",
        "ctcMin",
        "ctcMax",
        "cgpaCutoff",
        "tenthCutoff",
        "twelfthCutoff",
        "batchEligible",
        "allowedBranches",
        "eligibleColleges"
    ];

    // Loop through and update only what was sent in the request
    allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) {
            job[field] = req.body[field];
        }
    });

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
    // Find the logged-in student to get their college
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
        throw new ApiError(404, "Student profile not found");
    }

    // Only fetch jobs that are OPEN and meant for this student's college!
    const openJobs = await Job.find({ 
        status: "OPEN",
        eligibleColleges: { $in: [student.college] } 
    })
    .populate("company","name industry logoUrl")
    .sort({createdAt: -1}); //descending order

    return res.status(200).json(
        new ApiResponse(200, openJobs, "Open jobs fetched successfully")
    );

})

const getJobById = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    // Find the job and populate the company details
    const job = await Job.findById(jobId).populate("company", "name industry website logoUrl description");

    if (!job) {
        throw new ApiError(404, "Job not found");
    }

    return res.status(200).json(
        new ApiResponse(200, job, "Job details fetched successfully")
    );
});


export {createJob, 
publishJob,
updateJob,
closeJob,
getCompanyJobs,
getAllOpenJobs,
getJobById}; 