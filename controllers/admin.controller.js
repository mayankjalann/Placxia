import { Company } from "../models/company.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Admin } from "../models/admin.model.js";
import { AllowedStudent } from "../models/AllowedStudent.model.js";

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

    // Check if already approved by THIS college
    if (company.approvedColleges.includes(admin.college)) {
        throw new ApiError(400, "Company is already approved for your college");
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
    
    // Fetch companies that have NOT been approved by this admin's college
    const companies = await Company.find({ 
        approvedColleges: { $ne: admin.college } 
    }).sort({ createdAt: 1 });

    return res.status(200).json(
        new ApiResponse(200, companies, "Pending companies fetched successfully")
    );
});

const addAllowedStudent=asyncHandler(async(req,res)=>{
    const {email,rollNo,branch,batch}=req.body;

    if( !email || !rollNo || !branch || !batch){
        throw new ApiError(400, "Email, rollNo, branch, and batch are required");
    }

    const admin=await Admin.findOne({user:req.user._id});

    if(!admin){
        throw new ApiError(404,"Admin profile not found");
    }

    const existingStudent= await AllowedStudent.findOne({
        $or: [{email},{rollNo}]
    });

    if(existingStudent){
        throw new ApiError(409, "A student with this email or roll number is already allowed");
    }

    const allowedStudent = await AllowedStudent.create({
        college: admin.college,
        email,
        rollNo,
        branch,
        batch,
        isRegistered: false
    });

    return res.status(201).json(
        new ApiResponse(201, allowedStudent, "Student successfully authorized to register!")
    );

});

export { approveCompany, addAllowedStudent, getUnapprovedCompanies };
