import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/admin.model.js";
import { AllowedStudent } from "../models/allowedStudent.model.js";
import { Student } from "../models/student.model.js";
import { Job } from "../models/job.model.js";
import { Application } from "../models/application.model.js";
import { Offer } from "../models/offer.model.js";
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
        $or: [{email: normalizedEmail},{college: admin.college, rollNo: rollNo.trim()}]
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
    const normalizedRows = rows.map((row, index) => ({
        rowNumber: Number(row?.rowNumber) || index + 2,
        email: typeof row?.email === "string" ? row.email.trim().toLowerCase() : "",
        rollNo: typeof row?.rollNo === "string" ? row.rollNo.trim() : "",
        branch: typeof row?.branch === "string" ? row.branch.trim().toUpperCase() : "",
        batch: typeof row?.batch === "string" ? row.batch.trim() : "",
    }));
    const validForLookup = normalizedRows.filter((row) => row.email && row.rollNo);
    const existingRecords = validForLookup.length ? await AllowedStudent.find({
        $or: [
            { email: { $in: validForLookup.map((row) => row.email) } },
            { college: admin.college, rollNo: { $in: validForLookup.map((row) => row.rollNo) } },
        ],
    }).select("email rollNo").lean() : [];
    const existingEmails = new Set(existingRecords.map((record) => record.email));
    const existingRollNos = new Set(existingRecords.map((record) => record.rollNo));
    const seenEmails = new Set();
    const seenRollNos = new Set();
    const pendingRows = [];
    for (const row of normalizedRows) {
        const { email, rollNo, branch, batch, rowNumber } = row;
        if (!email || !/^\S+@\S+\.\S+$/.test(email) || !rollNo || !batch || !allowedBranches.includes(branch)) {
            results.rejected.push({ row: rowNumber, email: email || "", reason: "Check email, roll number, branch, and batch" });
            continue;
        }
        if (existingEmails.has(email) || existingRollNos.has(rollNo) || seenEmails.has(email) || seenRollNos.has(rollNo)) {
            results.rejected.push({ row: rowNumber, email, reason: "Email or roll number already exists" });
            continue;
        }
        seenEmails.add(email);
        seenRollNos.add(rollNo);
        pendingRows.push({ college: admin.college, email, rollNo, branch, batch, isRegistered: false, rowNumber });
    }

    if (pendingRows.length) {
        try {
            await AllowedStudent.insertMany(pendingRows.map(({ rowNumber, ...record }) => record), { ordered: false });
            results.imported = pendingRows.length;
        } catch (error) {
            const writeErrors = error.writeErrors || error.result?.getWriteErrors?.() || [];
            if (!writeErrors.length) throw error;
            const failedIndices = new Set(writeErrors.map((writeError) => writeError.index));
            results.imported = pendingRows.length - failedIndices.size;
            for (const writeError of writeErrors) {
                const row = pendingRows[writeError.index];
                results.rejected.push({ row: row.rowNumber, email: row.email, reason: writeError.code === 11000 ? "Email or roll number already exists" : "Could not import this row" });
            }
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
    const [totalStudents, placedStudents, authorizedStudents, openJobs, pendingCompanies, approvedCompanies, batchStats, rawBranchStats] = await Promise.all([
        Student.countDocuments({ college: collegeId }),
        Student.countDocuments({ college: collegeId, placementStatus: { $in: ["PLACED", "MULTIPLE_OFFERS"] } }),
        AllowedStudent.countDocuments({ college: collegeId }),
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
        Student.aggregate([
            { $match: { college: collegeId } },
            { $group: {
                _id: "$branch",
                students: { $sum: 1 },
                placed: { $sum: { $cond: [{ $in: ["$placementStatus", ["PLACED", "MULTIPLE_OFFERS"]] }, 1, 0] } },
            } },
            { $sort: { _id: 1 } },
        ]),
    ]);
    const jobIds = await Job.find({ eligibleColleges: collegeId }).distinct("_id");
    const [allowedByBranch, applicationGroups, offerGroups, companyStats, monthlyPlacements] = await Promise.all([
        AllowedStudent.aggregate([
            { $match: { college: collegeId } },
            { $group: { _id: "$branch", authorized: { $sum: 1 }, registered: { $sum: { $cond: ["$isRegistered", 1, 0] } } } },
        ]),
        Application.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),
        Offer.aggregate([
            { $match: { job: { $in: jobIds } } },
            { $group: {
                _id: "$status",
                count: { $sum: 1 },
                averagePackage: { $avg: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, "$offeredCtc", null] } },
                highestPackage: { $max: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, "$offeredCtc", null] } },
            } },
        ]),
        Job.aggregate([
            { $match: { eligibleColleges: collegeId } },
            { $group: { _id: "$company", jobs: { $sum: 1 }, jobIds: { $push: "$_id" } } },
            { $lookup: { from: Company.collection.name, localField: "_id", foreignField: "_id", as: "company" } },
            { $unwind: "$company" },
            { $lookup: {
                from: Application.collection.name,
                let: { companyJobIds: "$jobIds" },
                pipeline: [
                    { $match: { $expr: { $in: ["$job", "$$companyJobIds"] } } },
                    { $count: "count" },
                ],
                as: "applicationStats",
            } },
            { $lookup: {
                from: Offer.collection.name,
                let: { companyJobIds: "$jobIds" },
                pipeline: [
                    { $match: { $expr: { $in: ["$job", "$$companyJobIds"] } } },
                    { $group: {
                        _id: null,
                        total: { $sum: 1 },
                        accepted: { $sum: { $cond: [{ $eq: ["$status", "ACCEPTED"] }, 1, 0] } },
                    } },
                ],
                as: "offerStats",
            } },
            { $project: {
                _id: 0,
                companyId: "$_id",
                companyName: "$company.name",
                jobs: 1,
                applicants: { $ifNull: [{ $arrayElemAt: ["$applicationStats.count", 0] }, 0] },
                offers: { $ifNull: [{ $arrayElemAt: ["$offerStats.total", 0] }, 0] },
                acceptedOffers: { $ifNull: [{ $arrayElemAt: ["$offerStats.accepted", 0] }, 0] },
            } },
            { $sort: { applicants: -1, jobs: -1 } },
            { $limit: 10 },
        ]),
        Offer.aggregate([
            { $match: { job: { $in: jobIds }, status: "ACCEPTED", updatedAt: { $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$updatedAt", timezone: "Asia/Kolkata" } }, placements: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        ]),
    ]);
    const applicationCounts = Object.fromEntries(applicationGroups.map(({ _id, count }) => [_id, count]));
    const funnelStatuses = ["APPLIED", "SHORTLISTED", "SELECTED", "REJECTED"];
    const applicationFunnel = funnelStatuses.map((status) => ({ status, count: applicationCounts[status] || 0 }));
    const offerCounts = Object.fromEntries(offerGroups.map(({ _id, count }) => [_id, count]));
    const acceptedOfferStats = offerGroups.find(({ _id }) => _id === "ACCEPTED");
    const authorizedByBranch = Object.fromEntries(allowedByBranch.map(({ _id, authorized, registered }) => [_id, { authorized, registered }]));
    const branchesByCode = new Map(rawBranchStats.map((branch) => [branch._id, branch]));
    allowedByBranch.forEach(({ _id }) => {
        if (!branchesByCode.has(_id)) branchesByCode.set(_id, { _id, students: 0, placed: 0 });
    });
    const branchStats = [...branchesByCode.values()].sort((a, b) => a._id.localeCompare(b._id)).map((branch) => ({
        ...branch,
        authorized: authorizedByBranch[branch._id]?.authorized || 0,
        registeredFromAllowlist: authorizedByBranch[branch._id]?.registered || 0,
        placementRate: branch.students ? Math.round((branch.placed / branch.students) * 100) : 0,
    }));
    return res.status(200).json(new ApiResponse(200, {
        totalStudents,
        authorizedStudents,
        placedStudents,
        placementRate: totalStudents ? Math.round((placedStudents / totalStudents) * 100) : 0,
        openJobs,
        pendingCompanies,
        approvedCompanies,
        applications: applicationFunnel.reduce((sum, item) => sum + item.count, 0),
        applicationFunnel,
        batchStats: batchStats.map((batch) => ({
            ...batch,
            placementRate: batch.students ? Math.round((batch.placed / batch.students) * 100) : 0,
        })),
        branchStats,
        offerStats: {
            total: Object.values(offerCounts).reduce((sum, count) => sum + count, 0),
            pending: offerCounts.PENDING || 0,
            accepted: offerCounts.ACCEPTED || 0,
            declined: offerCounts.DECLINED || 0,
            averageAcceptedPackage: acceptedOfferStats?.averagePackage || 0,
            highestAcceptedPackage: acceptedOfferStats?.highestPackage || 0,
        },
        topCompanies: companyStats,
        monthlyAcceptedOffers: monthlyPlacements,
    }, "Placement analytics fetched"));
});

export { approveCompany, addAllowedStudent, addAllowedStudentsBulk, getUnapprovedCompanies, getPlacementAnalytics };
