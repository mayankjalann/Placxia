import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { Student } from "../models/student.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Company } from "../models/company.model.js";
import mongoose from "mongoose";

const applyForJob=asyncHandler(async (req,res)=>{
    const {jobId}=req.params;
    const student= await Student.findOne({user: req.user._id});


    if(!student){
        throw new ApiError(404, "Student profile not found");
    }

    const job=await Job.findById(jobId);

    if(!job){
        throw new ApiError(404, "Job not found");
    }

    const deadlineEnd = new Date(job.deadline);
    deadlineEnd.setUTCHours(23, 59, 59, 999);
    if(job.status !== "OPEN" || deadlineEnd < new Date()){
        throw new ApiError(400, "This job is not accepting applications right now");
    }

    // Security Check: Does this job allow applications from this student's college?
    const isEligibleCollege = job.eligibleColleges.some(
        collegeId => collegeId.toString() === student.college.toString()
    );

    if (!isEligibleCollege) {
        throw new ApiError(403, "You are not authorized to apply for this job. It is not open to your college.");
    }

    const existingApplication= await Application.findOne({
        student: student._id,
        job: job._id
    });

    if (existingApplication) {
        throw new ApiError(400, "You have already applied for this job");
    }

    let application;
    try {
        application = await Application.create({
            student: student._id,
            job: job._id,
            status: "APPLIED",
            applicationSource: "DIRECT"
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(409, "You have already applied for this job");
        }
        throw error;
    }

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

    const origin = (req.get("x-forwarded-proto")?.split(",")[0] || req.protocol) + "://" + req.get("host");
    const responseApplications = applications.map((application) => {
        const result = application.toObject();
        if (result.student?.resumeUrl === "/api/v1/auth/resume") {
            result.student.resumeUrl = origin + "/api/v1/application/resume/" + result.student._id;
        } else if (result.student?.resumeUrl?.startsWith("http://localhost:")) {
            result.student.resumeUrl = null;
        }
        return result;
    });

    return res.status(200).json(
        new ApiResponse(200, responseApplications, "Applicants fetched successfully")
    );

})

const getApplicantResume = asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.studentId)) {
        throw new ApiError(404, "Student not found");
    }
    const company = await Company.findOne({ user: req.user._id });
    if (!company) {
        throw new ApiError(404, "Company profile not found");
    }

    const student = await Student.findById(req.params.studentId)
        .select("+resumeData +resumeContentType");
    if (!student?.resumeData) {
        throw new ApiError(404, "No resume has been uploaded");
    }

    const companyJobIds = await Job.find({ company: company._id }).distinct("_id");
    const hasApplicantRelationship = await Application.exists({
        student: student._id,
        job: { $in: companyJobIds }
    });
    if (!hasApplicantRelationship) {
        throw new ApiError(403, "You can only view resumes for your own applicants");
    }

    return res
        .type(student.resumeContentType || "application/pdf")
        .set("Content-Disposition", `inline; filename="resume-${student._id}.pdf"`)
        .set("Cache-Control", "private, no-store")
        .send(student.resumeData);
});

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
    if (!application.job) {
        throw new ApiError(404, "The job for this application no longer exists");
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
                select: "name"
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
    getApplicantResume,
    updateApplicationStatus,
    getMyApplications
}

