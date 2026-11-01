import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/admin.model.js";
import { AllowedStudent } from "../models/allowedStudent.model.js";

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

export { approveCompany, addAllowedStudent, getUnapprovedCompanies };
