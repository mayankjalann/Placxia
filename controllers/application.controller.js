import { Application } from "../models/application.model.js";
import { Job } from "../models/job.model.js";
import { Student } from "../models/student.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Company } from "../models/company.model.js";
import mongoose from "mongoose";
import { notifyUser } from "../utils/notifications.js";
import { getStudentJobEligibilityReason } from "../utils/jobEligibility.js";

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

    const eligibilityReason = getStudentJobEligibilityReason(job, student);
    if (eligibilityReason) throw new ApiError(403, eligibilityReason);

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

    const company = await Company.findById(job.company).select("user");
    if (company?.user) {
        await notifyUser({
            userId: company.user,
            type: "NEW_APPLICATION",
            title: "New student application",
            message: `${student.name} applied for ${job.title}.`,
            link: "/dashboard",
        });
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

    const responseApplications = applications.map((application) => {
        const result = application.toObject();
        if (result.student?.resumeUrl === "/api/v1/auth/resume") {
            result.student.resumeUrl = "/api/v1/application/resume/" + result.student._id;
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
    const student = await Student.findById(application.student).select("user name");
    if (student?.user) {
        await notifyUser({
            userId: student.user,
            type: "APPLICATION_STATUS",
            title: `Application ${status.toLowerCase()}`,
            message: `Your application for ${application.job.title} is now ${status.toLowerCase()}.`,
            link: "/dashboard",
        });
    }

    return res.status(200).json(
        new ApiResponse(200, application, `Application status updated to ${status}`)
    );
});

const upsertInterviewRound = asyncHandler(async (req, res) => {
    const { applicationId } = req.params;
    const { roundNo, roundType, scheduledAt, interviewerName, result, feedback } = req.body;
    const allowedTypes = ["APTITUDE", "TECHNICAL", "HR", "GD"];
    const allowedResults = ["PASS", "FAIL", "PENDING"];
    if (!Number.isInteger(Number(roundNo)) || Number(roundNo) < 1 || !allowedTypes.includes(roundType)) {
        throw new ApiError(400, "Choose a valid round number and round type");
    }
    if (result !== undefined && !allowedResults.includes(result)) throw new ApiError(400, "Invalid round result");
    if (scheduledAt && Number.isNaN(new Date(scheduledAt).getTime())) throw new ApiError(400, "Choose a valid interview date and time");

    const company = await Company.findOne({ user: req.user._id });
    if (!company) throw new ApiError(404, "Company profile not found");
    const application = await Application.findById(applicationId).populate("job", "company title");
    if (!application?.job) throw new ApiError(404, "Application not found");
    if (application.job.company.toString() !== company._id.toString()) throw new ApiError(403, "You cannot manage interviews for this application");
    if (application.status === "REJECTED") throw new ApiError(400, "Rejected applications cannot be scheduled for interview");

    const existingRound = application.rounds.find((round) => round.roundNo === Number(roundNo));
    const oldSchedule = existingRound?.scheduledAt?.getTime();
    const roundData = {
        roundNo: Number(roundNo),
        roundType,
        ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
        ...(interviewerName !== undefined ? { interviewerName: interviewerName.trim() } : {}),
        ...(result !== undefined ? { result } : {}),
        ...(feedback !== undefined ? { feedback: feedback.trim() } : {}),
    };
    if (existingRound) Object.assign(existingRound, roundData);
    else application.rounds.push(roundData);
    await application.save();

    const newSchedule = scheduledAt ? new Date(scheduledAt).getTime() : null;
    if (newSchedule && oldSchedule !== newSchedule) {
        const student = await Student.findById(application.student).select("user");
        if (student?.user) {
            await notifyUser({
                userId: student.user,
                type: "INTERVIEW_SCHEDULED",
                title: `${roundType.toLowerCase()} interview scheduled`,
                message: `Round ${roundNo} for ${application.job.title} is scheduled for ${new Date(scheduledAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.`,
                link: "/dashboard",
            });
        }
    }

    return res.status(200).json(new ApiResponse(200, application, "Interview round saved"));
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
        .select("job status rounds createdAt")
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
    upsertInterviewRound,
    getMyApplications
}

