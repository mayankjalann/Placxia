import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { Student } from "../models/student.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Company } from "../models/company.model.js";

const applyForJob=asyncHandler(async (req,res)=>{
    const {jobId}=req.params;
    console.log(req.user._id);
    const student= await Student.findOne({user: req.user._id});


    if(!student){
        throw new ApiError(404, "Student profile not found");
    }

    const job=await Job.findById(jobId);

    if(!job){
        throw new ApiError(404, "Job not found");
    }

    if(job.status!="OPEN"){
        throw new ApiError(400, "This job is not accepting applications right now");
    }

    const existingApplication= await Application.findOne({
        student: student._id,
        job: job._id
    });

    if (existingApplication) {
        throw new ApiError(400, "You have already applied for this job");
    }

    const application= await Application.create({
        student: student._id,
        job: job._id,
        status: "APPLIED",
        applicationSource: "DIRECT"
    })

    return res.status(201).json(
        new ApiResponse(201, application, "Successfully applied for the job!")
    );
})

const getJobApplicants= asyncHandler(async(req,res)=>{
    const {jobId}=req.params;


   const company=await Company.findOne({user: req.user._id});

   if(!company){
    throw new ApiError(404, "Company profile not found");
   }

   const job=await Job.findById(jobId);

   if (!job) {
        throw new ApiError(404, "Job not found");
    }

    if(company._id.toString() !== job.company.toString()){
        throw new ApiError(403, "You do not have permission to view these applicants");
    }

    const applications = await Application.find({ job: jobId })
        .populate({
            path: "student",
            select: "name rollNo branch batch cgpa resumeUrl skills" 
        })
        .sort({ createdAt: -1 }); // Newest applications first
    return res.status(200).json(
        new ApiResponse(200, applications, "Applicants fetched successfully")
    );

})

const updateApplicationStatus = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { status } = req.body;

    // 1. Validate the incoming status
    const allowedStatuses = ["SHORTLISTED", "SELECTED", "REJECTED"];
    if (!allowedStatuses.includes(status)) {
        throw new ApiError(400, "Invalid status update");
    }

    // 2. Identify the company making the request
    const company = await Company.findOne({ user: req.user._id });
    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }

    // 3. Find the application and populate the job it belongs to
    const application = await Application.findById(applicationId).populate("job");
    
    if (!application) {
        throw new ApiError(404, "Application not found");
    }

    // 4. Security Check: Does the job inside this application belong to THIS company?
    if (application.job.company.toString() !== company._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this application");
    }

    // 5. Update status and save
    application.status = status;
    await application.save();

    return res.status(200).json(
        new ApiResponse(200, application, `Application status updated to ${status}`)
    );
});

const getMyApplications = asyncHandler(async (req, res) => {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) {
        throw new ApiError(404, "Student profile not found");
    }

    const applications = await Application.find({ student: student._id })
        .populate({
            path: "job",
            populate: {
                path: "company",
                select: "name companyProfile"
            }
        })
        .select("job status createdAt")
        .sort({ createdAt: -1 });
    
    return res.status(200).json(
        new ApiResponse(200, applications, "My applications fetched successfully")
    );
});

export {
    applyForJob,
    getJobApplicants,
    updateApplicationStatus,
    getMyApplications
}

