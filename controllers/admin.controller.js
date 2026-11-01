import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/admin.model.js";
import { AllowedStudent } from "../models/allowedStudent.model.js";
import { Student } from "../models/student.model.js";
import { Job } from "../models/job.model.js";
import { Application } from "../models/application.model.js";
import { notifyUser } from "../utils/notifications.js";

const approveCompany = asyncHandler(async (req, res) => {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company) {
        throw new ApiError(404, "Company not found");
    }

    const admin = await Admin.findOne({ user: req.user._id });
    if (!admin) {
        throw new ApiError(404, "Admin profile not found");
    }

    const requestedByThisCollege = company.requestedColleges.some(
        (collegeId) => collegeId.toString() === admin.college.toString()
    );
    if (!requestedByThisCollege) {
        throw new ApiError(403, "This company did not request approval for your college");
    }

    // Make approval safe to retry if the admin clicks twice or the response is delayed.
    const alreadyApproved = company.approvedColleges.some(
        (collegeId) => collegeId.toString() === admin.college.toString()
    );
    if (alreadyApproved) {
        return res.status(200).json(
            new ApiResponse(200, company, "Company is already approved for your college")
        );
    }

    company.approvedColleges.push(admin.college);
    await company.save();
    await notifyUser({
        userId: company.user,
        type: "COMPANY_APPROVED",
        title: "College partnership approved",
        message: "Your company is approved for the college you requested. You can now create job listings.",
        link: "/dashboard",
    });

    return res.status(200).json(
        new ApiResponse(200, company, "Company has been successfully approved for your college. They can now post jobs to your students.")
    );
});

const getUnapprovedCompanies = asyncHandler(async (req, res) => {
    const admin = await Admin.findOne({ user: req.user._id });
    if (!admin) {
        throw new ApiError(404, "Admin profile not found");
    }
    
    // Fetch companies that requested THIS college but haven't been approved yet
    const companies = await Company.find({ 
        requestedColleges: { $in: [admin.college] },
        approvedColleges: { $nin: [admin.college] } 
    }).sort({ createdAt: 1 });

    return res.status(200).json(
        new ApiResponse(200, companies, "Pending companies fetched successfully")
    );
});

const addAllowedStudent=asyncHandler(async(req,res)=>{
    const {email,rollNo,branch,batch}=req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const allowedBranches = ["CSE", "IT", "ECE", "EE", "ME", "CE", "OTHER"];

    if( !normalizedEmail || !rollNo?.trim() || !branch || !batch?.trim()){
        throw new ApiError(400, "Email, rollNo, branch, and batch are required");
    }
    if (!allowedBranches.includes(branch)) {
        throw new ApiError(400, "Select a valid branch");
    }

    const admin=await Admin.findOne({user:req.user._id});

    if(!admin){
        throw new ApiError(404,"Admin profile not found");
    }

    const existingStudent= await AllowedStudent.findOne({
        $or: [{email: normalizedEmail},{rollNo: rollNo.trim()}]
    });

    if(existingStudent){
        throw new ApiError(409, "A student with this email or roll number is already allowed");
    }

    const allowedStudent = await AllowedStudent.create({
        college: admin.college,
        email: normalizedEmail,
        rollNo: rollNo.trim(),
        branch,
        batch: batch.trim(),
        isRegistered: false
    });

    return res.status(201).json(
        new ApiResponse(201, allowedStudent, "Student successfully authorized to register!")
    );

});

const addAllowedStudentsBulk = asyncHandler(async (req, res) => {
    const rows = req.body?.students;
    if (!Array.isArray(rows) || rows.length === 0) throw new ApiError(400, "Upload at least one student row");
    if (rows.length > 500) throw new ApiError(400, "Import up to 500 students at a time");
    const admin = await Admin.findOne({ user: req.user._id });
    if (!admin) throw new ApiError(404, "Admin profile not found");

    const allowedBranches = ["CSE", "IT", "ECE", "EE", "ME", "CE", "OTHER"];
    const results = { imported: 0, rejected: [] };
    for (const [index, row] of rows.entries()) {
        const email = typeof row?.email === "string" ? row.email.trim().toLowerCase() : "";
        const rollNo = typeof row?.rollNo === "string" ? row.rollNo.trim() : "";
        const branch = typeof row?.branch === "string" ? row.branch.trim().toUpperCase() : "";
        const batch = typeof row?.batch === "string" ? row.batch.trim() : "";
        const rowNumber = Number(row?.rowNumber) || index + 2;
        if (!email || !/^\S+@\S+\.\S+$/.test(email) || !rollNo || !batch || !allowedBranches.includes(branch)) {
            results.rejected.push({ row: rowNumber, email: email || "", reason: "Check email, roll number, branch, and batch" });
            continue;
        }
        try {
            const existing = await AllowedStudent.exists({ $or: [{ email }, { rollNo }] });
            if (existing) {
                results.rejected.push({ row: rowNumber, email, reason: "Email or roll number already exists" });
                continue;
            }
            await AllowedStudent.create({ college: admin.college, email, rollNo, branch, batch, isRegistered: false });
            results.imported += 1;
        } catch (error) {
            results.rejected.push({ row: rowNumber, email, reason: error.code === 11000 ? "Email or roll number already exists" : "Could not import this row" });
        }
    }

    return res.status(200).json(new ApiResponse(200, results, `${results.imported} students imported`));
});

const getPlacementAnalytics = asyncHandler(async (req, res) => {
    const admin = await Admin.findOne({ user: req.user._id });
    if (!admin) throw new ApiError(404, "Admin profile not found");
    const collegeId = admin.college;
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const [totalStudents, placedStudents, openJobs, pendingCompanies, approvedCompanies, batchStats] = await Promise.all([
        Student.countDocuments({ college: collegeId }),
        Student.countDocuments({ college: collegeId, placementStatus: { $in: ["PLACED", "MULTIPLE_OFFERS"] } }),
        Job.countDocuments({ eligibleColleges: collegeId, status: "OPEN", deadline: { $gte: todayStart } }),
        Company.countDocuments({ requestedColleges: collegeId, approvedColleges: { $ne: collegeId } }),
        Company.countDocuments({ approvedColleges: collegeId }),
        Student.aggregate([
            { $match: { college: collegeId } },
            { $group: {
                _id: "$batch",
                students: { $sum: 1 },
                placed: { $sum: { $cond: [{ $in: ["$placementStatus", ["PLACED", "MULTIPLE_OFFERS"]] }, 1, 0] } },
            } },
            { $sort: { _id: 1 } },
        ]),
    ]);
    const jobIds = await Job.find({ eligibleColleges: collegeId }).distinct("_id");
    const applications = await Application.countDocuments({ job: { $in: jobIds } });
    return res.status(200).json(new ApiResponse(200, {
        totalStudents,
        placedStudents,
        placementRate: totalStudents ? Math.round((placedStudents / totalStudents) * 100) : 0,
        openJobs,
        pendingCompanies,
        approvedCompanies,
        applications,
        batchStats,
    }, "Placement analytics fetched"));
});

export { approveCompany, addAllowedStudent, addAllowedStudentsBulk, getUnapprovedCompanies, getPlacementAnalytics };
